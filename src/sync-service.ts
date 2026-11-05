import { supabase, isSupabaseConfigured, getOrCreateGuestSession } from './supabase';
import { type Save, STORAGE_KEY, normalizeProfile, safePosition } from './profile';
import { validateDisplayName } from './name-validation';

export type SyncState = 'saving' | 'saved_local' | 'synced' | 'offline' | 'error';

type SyncListener = (state: SyncState, message?: string) => void;

class SyncService {
  private syncState: SyncState = 'saved_local';
  private listeners: Set<SyncListener> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Save | null = null;
  private isSyncing = false;
  private hasMigrated = false;

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.syncState);
    return () => this.listeners.delete(listener);
  }

  private notify(state: SyncState, message?: string) {
    this.syncState = state;
    for (const listener of this.listeners) {
      try {
        listener(state, message);
      } catch (err) {
        console.error('[SyncService] Listener error:', err);
      }
    }
  }

  public getStatus(): SyncState {
    return this.syncState;
  }

  /**
   * Lưu cục bộ ngay lập tức và lập lịch đồng bộ lên Supabase nếu có mạng.
   */
  public queueSave(save: Save, immediate = false): void {
    this.pendingSave = save;

    // 1. Luôn lưu vào LocalStorage ngay lập tức
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      this.notify(navigator.onLine && isSupabaseConfigured ? 'saving' : 'saved_local');
    } catch {
      this.notify('error', 'Không thể ghi vào bộ nhớ cục bộ');
      return;
    }

    if (!isSupabaseConfigured || !navigator.onLine) {
      this.notify(navigator.onLine ? 'saved_local' : 'offline', 'Tiến trình đang lưu trên thiết bị');
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      void this.flush();
    } else {
      this.debounceTimer = setTimeout(() => {
        void this.flush();
      }, 1200);
    }
  }

  /**
   * Đẩy dữ liệu đang chờ lên Supabase qua RPC nguyên tử sync_player_bundle.
   */
  public async flush(): Promise<boolean> {
    if (!this.pendingSave || this.isSyncing) return false;
    if (!isSupabaseConfigured || !supabase || !navigator.onLine) {
      this.notify('saved_local', 'Đã lưu trên thiết bị');
      return false;
    }

    const dataToSync = { ...this.pendingSave };
    this.isSyncing = true;
    this.notify('saving', 'Đang đồng bộ với đám mây…');

    try {
      const { user } = await getOrCreateGuestSession();
      if (!user) {
        this.notify('saved_local', 'Tiến trình đang lưu trên thiết bị');
        this.isSyncing = false;
        return false;
      }

      // Chỉ đồng bộ khi tên và giới tính đã được xác thực hợp lệ
      const nameVal = validateDisplayName(dataToSync.name);
      if (!nameVal.valid || !dataToSync.gender) {
        this.notify('saved_local', 'Đã lưu trên thiết bị');
        this.isSyncing = false;
        return false;
      }

      // Gọi RPC nguyên tử sync_player_bundle
      const { data, error } = await supabase.rpc('sync_player_bundle', {
        p_display_name: nameVal.normalized,
        p_gender: dataToSync.gender,
        p_onboarding_completed: Boolean(dataToSync.onboardingCompleted),
        p_appearance: {
          style: dataToSync.style,
          outfit: dataToSync.outfit,
          color: dataToSync.color,
          skinColor: dataToSync.skinColor,
          hairColor: dataToSync.hairColor,
          face: dataToSync.face,
          glasses: dataToSync.glasses,
        },
        p_progress: {
          x: dataToSync.position.x,
          z: dataToSync.position.z,
          completed: dataToSync.completed,
          metGiaMinh: dataToSync.metGiaMinh,
          viewedGuides: dataToSync.viewedGuides,
        },
        p_rosary: {
          beadTotal: dataToSync.beadTotal,
          beadSound: dataToSync.beadSound,
          haptic: dataToSync.haptic,
        },
        p_stats: {
          incense: dataToSync.incense,
          flower: dataToSync.flower,
          bell: 0,
          lantern: dataToSync.wishes.length,
          playTime: 0,
        },
        p_settings: {
          sound: dataToSync.sound,
          chantVolume: dataToSync.chantVolume,
          environmentVolume: dataToSync.environmentVolume,
          effectsVolume: dataToSync.effectsVolume,
          quality: dataToSync.quality,
        },
      });

      if (error) {
        console.warn('[SyncService] Lỗi khi đồng bộ lên Supabase:', error.message);
        this.notify('error', 'Chưa thể đồng bộ đám mây');
        this.isSyncing = false;
        return false;
      }

      this.notify('synced', 'Đã đồng bộ');
      this.isSyncing = false;
      return true;
    } catch (err) {
      console.warn('[SyncService] Ngoại lệ khi đồng bộ:', err);
      this.notify('offline', 'Chưa đồng bộ (Ngoại tuyến)');
      this.isSyncing = false;
      return false;
    }
  }

  /**
   * Gửi một lời chúc mới lên Supabase và lưu bản sao cục bộ.
   */
  public async addWish(save: Save, text: string, flowerColor: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 150) return false;

    // Lưu cục bộ trước
    const newWish = { text: trimmed, date: new Date().toISOString() };
    const updatedSave: Save = {
      ...save,
      wishes: [...save.wishes, newWish].slice(-30),
    };
    this.queueSave(updatedSave, true);

    // Gửi lên bảng wishes nếu có Supabase
    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { user } = await getOrCreateGuestSession();
        if (user) {
          const { error } = await supabase.from('wishes').insert({
            profile_id: user.id,
            sender_name: save.name.trim() || 'Khách ghé chùa',
            content: trimmed,
            flower_color: flowerColor,
          });
          if (error) {
            console.warn('[SyncService] Gửi lời chúc lên bảng wishes thất bại:', error.message);
          }
        }
      } catch (err) {
        console.warn('[SyncService] Lỗi gửi lời chúc:', err);
      }
    }

    return true;
  }

  /**
   * Xóa một lời chúc (soft delete).
   */
  public async deleteWish(save: Save, wishDate: string): Promise<Save> {
    const filteredWishes = save.wishes.filter((w) => w.date !== wishDate);
    const updatedSave: Save = {
      ...save,
      wishes: filteredWishes,
    };
    this.queueSave(updatedSave, true);

    if (isSupabaseConfigured && supabase && navigator.onLine) {
      try {
        const { user } = await getOrCreateGuestSession();
        if (user) {
          await supabase
            .from('wishes')
            .update({ is_deleted: true })
            .eq('profile_id', user.id)
            .eq('created_at', wishDate);
        }
      } catch (err) {
        console.warn('[SyncService] Lỗi xóa lời chúc trên cloud:', err);
      }
    }

    return updatedSave;
  }

  /**
   * Di trú dữ liệu từ LocalStorage cũ lên Supabase khi mở ứng dụng lần đầu có kết nối mạng.
   */
  public async migrateLocalProfileIfNeeded(currentSave: Save): Promise<void> {
    if (this.hasMigrated || !isSupabaseConfigured || !supabase || !navigator.onLine) return;
    this.hasMigrated = true;

    // Chỉ di trú khi hồ sơ đã có tên hợp lệ và giới tính đã chọn
    const nameVal = validateDisplayName(currentSave.name);
    if (!nameVal.valid || !currentSave.gender) return;

    try {
      const { user } = await getOrCreateGuestSession();
      if (!user) return;

      // Kiểm tra xem trên cloud đã có profile chưa
      const { data: cloudProfile, error } = await supabase
        .from('profiles')
        .select('id, version, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[SyncService] Kiểm tra profile cloud:', error.message);
        return;
      }

      // Nếu trên cloud chưa có thì flush dữ liệu cục bộ lên
      if (!cloudProfile) {
        this.queueSave(currentSave, true);
      }
    } catch (err) {
      console.warn('[SyncService] Lỗi kiểm tra di trú:', err);
    }
  }
}

export const syncService = new SyncService();

