import { useSyncExternalStore } from 'react';
export type AudioPreferences = { sound: boolean; chantVolume: number; environmentVolume: number; effectsVolume: number };
export type AudioStatus = 'loading' | 'missing' | 'ready' | 'playing' | 'waiting' | 'paused' | 'blocked' | 'error' | 'silent';
type TrackKind = 'music' | 'chant';
type Snapshot = { status: AudioStatus; message: string; title: string; kind: TrackKind };
type Manifest = { available: boolean; src: string; title: string; language: string; credit: string; license: string; sourceUrl: string; kind?: TrackKind };
const base = `${import.meta.env.BASE_URL}audio/`;
let snapshot: Snapshot = { status: 'loading', message: 'Đang kiểm tra bản ghi…', title: '', kind: 'chant' };
const subscribers = new Set<() => void>();
function publish(status: AudioStatus, message: string) { snapshot = { ...snapshot, status, message }; subscribers.forEach(fn => fn()); }
const playLabel = () => snapshot.kind === 'music' ? 'Phát nhạc' : 'Phát kinh';
const volumeLabel = () => snapshot.kind === 'music' ? 'nhạc nền' : 'kinh';
const missingMessage = () => snapshot.kind === 'music' ? 'Chưa có tệp nhạc nền' : 'Chưa có bản ghi kinh tiếng Phạn';
export function useAudioStatus() { return useSyncExternalStore(fn => { subscribers.add(fn); return () => subscribers.delete(fn); }, () => snapshot); }
let player: HTMLAudioElement | undefined, manifest: Manifest | undefined, manifestRequest: Promise<void> | undefined;
let context: AudioContext | undefined, ambientGain: GainNode | undefined, effectsGain: GainNode | undefined, chantGain: GainNode | undefined, mediaSource: MediaElementAudioSourceNode | undefined, nature: AudioBufferSourceNode | undefined;
let prefs: AudioPreferences = { sound: true, chantVolume: .5, environmentVolume: .2, effectsVolume: .45 };
let unlocked = false, requestId = 0, lastBead = -Infinity;
const listeners: Array<[string, EventListener]> = [];
export function prepareAudio() {
 if (manifestRequest) return manifestRequest;
 manifestRequest = (async () => {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
  try {
   const response = await fetch(`${base}chant.json`, { cache: 'no-cache', signal: controller.signal });
   if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error('Không đọc được cấu hình bản ghi.');
   const data = await response.json() as Manifest;
   const kind = data.kind ?? 'chant';
   if (kind !== 'music' && kind !== 'chant') throw new Error('Loại bản ghi âm thanh không hợp lệ.');
   snapshot = { ...snapshot, kind, title: '' };
   if (!data.available) { publish('missing', missingMessage()); return; }
   if ((kind === 'chant' && data.language !== 'sa') || !data.src || !data.title || !data.credit || !data.license || !data.sourceUrl) throw new Error('Bản ghi chưa có thông tin ngôn ngữ, nguồn hoặc giấy phép.');
   const src = new URL(data.src, new URL(base, location.href));
   if (src.origin !== location.origin || !src.pathname.startsWith(new URL(base, location.href).pathname)) throw new Error('Hãy đặt bản ghi trong thư mục audio của website.');
   manifest = { ...data, src: src.href }; snapshot = { ...snapshot, title: data.title }; publish('ready', 'Sẵn sàng · Nhấn để phát');
  } catch (error) { publish('error', controller.signal.aborted ? 'Tải cấu hình âm thanh quá lâu. Hãy thử lại.' : error instanceof Error ? error.message : 'Không tải được cấu hình âm thanh.'); }
  finally { clearTimeout(timeout); }
 })();
 return manifestRequest;
}
function getPlayer() {
 if (player) return player;
 const media = new Audio(); player = media; media.preload = 'metadata'; media.loop = true; media.src = manifest!.src;
 if(context){try{mediaSource=context.createMediaElementSource(media);chantGain=context.createGain();chantGain.gain.value=prefs.sound?prefs.chantVolume:0;mediaSource.connect(chantGain);chantGain.connect(context.destination);}catch{mediaSource=undefined;chantGain=undefined;}}
 const on = (name: string, handler: EventListener) => { media.addEventListener(name, handler); listeners.push([name, handler]); };
 on('playing', () => { if(mediaSource&&context?.state!=='running'){media.pause();publish('blocked',`Hệ thống âm thanh bị tạm khóa · Nhấn ${playLabel()} để tiếp tục`);return;}if (!media.paused && prefs.sound && prefs.chantVolume > 0) publish('playing', 'Đang phát'); });
 on('pause', () => { if (!['error','blocked','silent'].includes(snapshot.status)) publish('paused', 'Đã tạm dừng'); });
 on('waiting', () => { if (!media.paused) publish('waiting', 'Đang tải âm thanh…'); });
 on('stalled', () => { if (!media.paused) publish('waiting', 'Đang chờ dữ liệu âm thanh…'); });
 on('error', () => { void diagnoseSource(media); });
 on('ended', () => publish('paused', 'Đã kết thúc'));
 return media;
}
async function diagnoseSource(media: HTMLAudioElement) {
 const id = ++requestId; let message = 'Không phát được bản ghi. Kiểm tra tệp hoặc định dạng âm thanh.';
 try {
  const response = await fetch(manifest!.src, { method: 'HEAD', cache: 'no-cache' });
  if (!response.ok) message = `Không tải được tệp âm thanh (HTTP ${response.status}).`;
  else if (response.headers.get('content-type')?.includes('html')) message = 'Đường dẫn đang trả về trang HTML, không phải tệp âm thanh.';
  else if (response.headers.get('content-length') === '0') message = 'Tệp âm thanh trống. Hãy thay bằng bản ghi hợp lệ.';
  else if (media.error?.code === 3) message = 'Không giải mã được bản ghi. Hãy dùng MP3 hoặc AAC được trình duyệt hỗ trợ.';
 } catch { message = 'Không kết nối được tới bản ghi. Hãy kiểm tra mạng và thử lại.'; }
 if (id === requestId && player === media) publish('error', message);
}
export function configureAudio(next: AudioPreferences) {
 prefs = next;
 if (player) {
  player.muted = !next.sound; player.volume = mediaSource?1:next.chantVolume;
  if (!next.sound || next.chantVolume === 0) { player.pause(); if (manifest) publish('silent', !next.sound ? 'Đã tắt toàn bộ âm thanh' : `Âm lượng ${volumeLabel()} đang ở 0%`); }
 }
 if (context) { ambientGain!.gain.setTargetAtTime(next.sound ? next.environmentVolume * .18 : 0, context.currentTime, .08); effectsGain!.gain.setTargetAtTime(next.sound ? next.effectsVolume * .3 : 0, context.currentTime, .03);chantGain?.gain.setTargetAtTime(next.sound?next.chantVolume:0,context.currentTime,.04); }
}
// Call synchronously in the user's gesture. Do not await fetch before media.play().
export function unlockAudioFromGesture() {
 unlocked = true;
 try {
  if (!context) {
   context = new AudioContext(); ambientGain = context.createGain(); effectsGain = context.createGain(); ambientGain.connect(context.destination); effectsGain.connect(context.destination);
   context.onstatechange=()=>{if(context?.state==='suspended'&&player&&!player.paused&&snapshot.status==='playing')publish('paused',`Âm thanh bị gián đoạn · Nhấn ${playLabel()} để tiếp tục`);};
   const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), samples = buffer.getChannelData(0); let previous = 0;
   for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .018) / 1.018; samples[i] = previous * .35; }
   nature = context.createBufferSource(); nature.buffer = buffer; nature.loop = true;
   const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520; nature.connect(filter); filter.connect(ambientGain); nature.start();
  }
  void context.resume().catch(() => {}); configureAudio(prefs);
 } catch { /* HTML audio remains usable without Web Audio. */ }
}
export function playChantFromGesture() {
 unlockAudioFromGesture();
 if (!manifest) { if (snapshot.status === 'missing') publish('missing', missingMessage()); return; }
 if (!prefs.sound || prefs.chantVolume === 0) { publish('silent', !prefs.sound ? 'Đã tắt toàn bộ âm thanh' : `Âm lượng ${volumeLabel()} đang ở 0%`); return; }
 const media = getPlayer(); media.muted = false; media.volume = mediaSource?1:prefs.chantVolume;
 if (!media.paused && snapshot.status === 'playing') return;
 if (media.error) { ++requestId; media.load(); }
 publish('loading', 'Đang mở bản ghi…'); const attempt = ++requestId;
 void media.play().catch(error => {
  if (attempt !== requestId) return;
  if (error?.name === 'NotAllowedError') publish('blocked', `Trình duyệt chưa cho phát. Nhấn ${playLabel()} để thử lại.`);
  else if (error?.name !== 'AbortError') { publish('error', 'Không mở được bản ghi. Kiểm tra nguồn và thử lại.'); void diagnoseSource(media); }
 });
}
export function pauseChant() { ++requestId; player?.pause(); if (manifest) publish('paused', 'Đã tạm dừng'); }
export function retryChantFromGesture() { if (manifest) { playChantFromGesture(); return; } manifestRequest = undefined; void prepareAudio(); }
export function syncAudioAfterVisibility() { if (player && manifest && unlocked && player.paused && prefs.sound && snapshot.status === 'playing') publish('paused', `Âm thanh bị gián đoạn · Nhấn ${playLabel()} để tiếp tục`); }
export function ring() {
 if (!context || !effectsGain || !prefs.sound) return;
 [196, 392.8, 529, 793, 1057].forEach((frequency, i) => {
  const osc = context!.createOscillator(), gain = context!.createGain(); osc.frequency.value = frequency; gain.gain.setValueAtTime(.5 / (i + 1), context!.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context!.currentTime + 6);
  osc.connect(gain); gain.connect(effectsGain!); osc.start(); osc.stop(context!.currentTime + 6); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
 });
}
export function beadClick() {
 if (!context || !effectsGain || !prefs.sound || context.state !== 'running' || context.currentTime - lastBead < .025) return;
 lastBead = context.currentTime;
 const osc = context.createOscillator(), gain = context.createGain(); osc.frequency.setValueAtTime(1050, context.currentTime); osc.frequency.exponentialRampToValueAtTime(530, context.currentTime + .035); gain.gain.setValueAtTime(.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .07);
 osc.connect(gain); gain.connect(effectsGain); osc.start(); osc.stop(context.currentTime + .08); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
export function closeAudio() {
 ++requestId;
 if (player) { listeners.forEach(([name, handler]) => player!.removeEventListener(name, handler)); player.pause(); player.removeAttribute('src'); player.load(); }
 listeners.length = 0; player = undefined; mediaSource?.disconnect();chantGain?.disconnect();nature?.stop();if(context)context.onstatechange=null;void context?.close(); context = undefined; nature = undefined; ambientGain = undefined; effectsGain = undefined;mediaSource=undefined;chantGain=undefined;
}
