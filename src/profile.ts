import { normalizeAppearance, modelConfig, type Appearance, type Gender } from './appearance-config';
import { dialogueTopics } from './dialogue-data';
import type { Quality } from './environment';
import { canWalk, groundHeight, places, type Wish } from './world-data';
import { validBeadTotal } from './rosary-progress';
import { validateDisplayName, normalizeDisplayName } from './name-validation';

export const STORAGE_KEY = 'an-nhien-v1';
export type Position = { x: number; z: number };
export const SPAWN: Position = { x: 0, z: 8.5 };

export type Save = Appearance & {
  guestId: string;
  onboardingCompleted: boolean;
  position: Position;
  metGiaMinh: boolean;
  viewedGuides: string[];
  name: string;
  beadTotal: number;
  beadSound: boolean;
  haptic: boolean;
  quality: Quality;
  chantVolume: number;
  environmentVolume: number;
  effectsVolume: number;
  sound: boolean;
  volume: number;
  low: boolean;
  incense: number;
  flower: string;
  wishes: Wish[];
  completed: string[];
};

function generateGuestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'guest-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function safePosition(value: unknown, radius = 0.28): Position {
  const p = value as Position | null;
  if (p && Number.isFinite(p.x) && Number.isFinite(p.z) && canWalk(p.x, p.z, radius)) return { x: p.x, z: p.z };
  return { ...SPAWN };
}

export function nearbySafePosition(p: Position, radius: number): Position {
  if (canWalk(p.x, p.z, radius)) return { ...p };
  for (const distance of [0.12, 0.25, 0.5, 0.8]) {
    for (let i = 0; i < 16; i++) {
      const x = p.x + Math.cos((i * Math.PI) / 8) * distance;
      const z = p.z + Math.sin((i * Math.PI) / 8) * distance;
      if (canWalk(x, z, radius) && Math.abs(groundHeight(x, z) - groundHeight(p.x, p.z)) < 0.21) {
        return { x, z };
      }
    }
  }
  return { ...SPAWN };
}

const volume = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function normalizeProfile(raw: unknown): Save {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const appearance = normalizeAppearance(p);
  const mobile = typeof matchMedia === 'function' && matchMedia('(max-width: 700px)').matches;
  const oldVolume = volume(p.volume, 0.5);

  const cleanName = typeof p.name === 'string' ? normalizeDisplayName(p.name) : '';
  const nameVal = validateDisplayName(cleanName);
  const hasValidGender = appearance.gender === 'male' || appearance.gender === 'female';
  const radius = appearance.gender ? modelConfig[appearance.gender].colliderRadius : 0.28;

  // Onboarding chỉ hoàn tất khi cả tên và giới tính đều hợp lệ
  const onboardingCompleted = Boolean(p.onboardingCompleted) && nameVal.valid && hasValidGender;

  return {
    ...p,
    ...appearance,
    guestId:
      typeof p.guestId === 'string' && p.guestId.length > 0
        ? p.guestId.slice(0, 100)
        : typeof p.id === 'string' && p.id.length > 0
        ? p.id.slice(0, 100)
        : generateGuestId(),
    onboardingCompleted,
    position: safePosition(p.position, radius),
    metGiaMinh: p.metGiaMinh === true,
    viewedGuides: Array.isArray(p.viewedGuides)
      ? [...new Set(p.viewedGuides.filter((id): id is string => typeof id === 'string' && dialogueTopics.some((t) => t.id === id)))]
      : [],
    name: cleanName,
    beadTotal: validBeadTotal(p.beadTotal),
    beadSound: p.beadSound === true,
    haptic: p.haptic === true,
    quality: ['low', 'medium', 'high'].includes(p.quality as string)
      ? (p.quality as Quality)
      : typeof p.low === 'boolean'
      ? (p.low ? 'low' : 'medium')
      : mobile
      ? 'low'
      : 'medium',
    chantVolume: volume(p.chantVolume, oldVolume),
    environmentVolume: volume(p.environmentVolume, 0.2),
    effectsVolume: volume(p.effectsVolume, 0.45),
    sound: typeof p.sound === 'boolean' ? p.sound : true,
    volume: oldVolume,
    low: typeof p.low === 'boolean' ? p.low : mobile,
    incense: typeof p.incense === 'number' && Number.isFinite(p.incense) ? Math.max(0, Math.min(7, p.incense)) : 0,
    flower: ['#e7a9a4', '#f3d272', '#f7eee0'].includes(p.flower as string) ? (p.flower as string) : '',
    wishes: Array.isArray(p.wishes)
      ? p.wishes
          .filter((w): w is Wish => Boolean(w && typeof w.text === 'string' && typeof w.date === 'string'))
          .slice(-30)
          .map((w) => ({ ...w, text: w.text.slice(0, 150) }))
      : [],
    completed: Array.isArray(p.completed)
      ? p.completed.filter((v): v is string => typeof v === 'string' && places.some((a) => a.id === v))
      : [],
  };
}

export function loadProfile(): Save {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return normalizeProfile(null);
  }
}

function checksum(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function createRecoveryCode(profile: Save): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, profile }));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  }
  return `GMTU1.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.${checksum(bytes)}`;
}

export function readRecoveryCode(code: string): Save {
  try {
    if (code.length > 100000) throw new Error();
    const parts = code.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'GMTU1' || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
      throw new Error();
    }
    const binary = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (checksum(bytes) !== parts[2]) throw new Error();
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (value.version !== 1 || !value.profile || typeof value.profile.guestId !== 'string') {
      throw new Error();
    }
    return normalizeProfile(value.profile);
  } catch {
    throw new Error('Mã khôi phục không hợp lệ hoặc bị thiếu. Hãy sao chép lại toàn bộ mã.');
  }
}

/**
 * Tính mã băm SHA-256 dạng hex chuẩn (dùng cho bảo mật mã khôi phục cloud).
 */
export async function sha256Hex(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
