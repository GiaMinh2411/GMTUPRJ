import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gmtu-auth-session',
      },
    })
  : null;

let pendingAuthPromise: Promise<{ user: User | null; session: Session | null }> | null = null;

/**
 * Đảm bảo danh tính khách Anonymous Auth:
 * - Khôi phục phiên làm việc đã lưu trong storage nếu còn hiệu lực.
 * - Nếu chưa có phiên, tự động đăng nhập ẩn danh (signInAnonymously).
 * - Sử dụng khóa đồng thời (pendingAuthPromise) để chống gọi trùng lặp giữa các component.
 */
export async function getOrCreateGuestSession(): Promise<{ user: User | null; session: Session | null }> {
  if (!supabase) {
    return { user: null, session: null };
  }

  if (pendingAuthPromise) {
    return pendingAuthPromise;
  }

  pendingAuthPromise = (async () => {
    try {
      // 1. Kiểm tra session hiện có
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && sessionData?.session?.user) {
        return { user: sessionData.session.user, session: sessionData.session };
      }

      // 2. Chưa có session, đăng nhập ẩn danh
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        console.warn('[GM TỰ] Không thể khởi tạo Anonymous Auth:', authError.message);
        return { user: null, session: null };
      }

      return { user: authData.user, session: authData.session };
    } catch (err) {
      console.warn('[GM TỰ] Ngoại lệ khi xác thực khách ẩn danh:', err);
      return { user: null, session: null };
    } finally {
      pendingAuthPromise = null;
    }
  })();

  return pendingAuthPromise;
}

/**
 * Lấy user ID hiện tại (nếu có).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { user } = await getOrCreateGuestSession();
  return user?.id ?? null;
}

