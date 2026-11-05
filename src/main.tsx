import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Volume2, VolumeX, AlertCircle, LoaderCircle, HelpCircle, Settings2,
  DoorOpen, X, Flower2, Leaf, MapPin, Compass, ArrowRight, Check,
  RotateCcw, CircleDot, Hand, Trash2, Cloud, CloudOff, Shield
} from 'lucide-react';
import { places, canWalk, groundHeight, type Place, type Wish } from './world-data';
import { Environment, type Quality } from './environment';
import {
  configureAudio, prepareAudio, playChantFromGesture, syncAudioAfterVisibility,
  useAudioStatus, ring, closeAudio, beadClick, type AudioPreferences
} from './audio-engine';
import { AudioPanel } from './audio-panel';
import { Avatar } from './human';
import { modelConfig, normalizeAppearance, type Appearance, type Gender } from './appearance-config';
import {
  loadProfile, STORAGE_KEY, nearbySafePosition, safePosition, SPAWN,
  type Save, type Position
} from './profile';
import { GiaMinh } from './gia-minh';
import { npcInRange } from './npc-range';
import { destinations, type Destination } from './npc-data';
import { Dialogue } from './dialogue';
import { ProfileTransfer } from './profile-transfer';
import { DestinationMarker, NavigationHud } from './navigation';
import { AppearancePicker } from './appearance';
import { RosaryPanel } from './rosary-panel';
import { beadProgress, validBeadTotal, MAX_BEADS } from './rosary-progress';
import { validateDisplayName, normalizeDisplayName, countUnicodeGraphemes, isValidGender } from './name-validation';
import { syncService, type SyncState } from './sync-service';
import { AdminDashboard } from './admin/AdminDashboard';
import './realism.css';
import './companions.css';

const controls = {
  keys: new Set<string>(),
  stick: { x: 0, y: 0 },
  yaw: 0,
  pitch: 0.35,
  zoom: 6,
  reset: 0,
  run: false,
  relocate: null as Position | null,
};

function Player({
  save,
  entered,
  pose,
  blocked,
  rosary,
  beadTick,
  actor,
  offering,
  onNear,
  onMove,
}: {
  save: Save;
  entered: boolean;
  pose: string;
  blocked: boolean;
  rosary: boolean;
  beadTick: number;
  actor: React.RefObject<THREE.Vector3>;
  offering: 'incense' | 'flowers' | null;
  onNear: (p: Place | null) => void;
  onMove: (x: number, z: number) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const position = useRef(new THREE.Vector3(save.position.x, 0, save.position.z));
  const lastReset = useRef(0);
  const walking = useRef(false);
  const previousHeading = useRef<number | null>(null);
  const gait = useRef(0);
  const cameraObjects = useRef<THREE.Object3D[]>([]);
  const ray = useRef(new THREE.Raycaster());
  const refresh = useRef(0);
  const [walk, setWalk] = useState(false);
  const nearest = useRef('');

  useFrame(({ camera, size, scene }, delta) => {
    const dt = Math.max(0, Math.min(delta, 0.1));
    const p = position.current;
    const activeGender: Gender = save.gender === 'female' ? 'female' : 'male';
    const model = modelConfig[activeGender];

    if (lastReset.current !== controls.reset) {
      p.set(SPAWN.x, 0, SPAWN.z);
      controls.yaw = 0;
      lastReset.current = controls.reset;
    }
    if (controls.relocate) {
      p.set(controls.relocate.x, 0, controls.relocate.z);
      controls.relocate = null;
    }
    if (pose === 'meditate') p.set(-9, 0, 6);

    const k = controls.keys;
    let dx = controls.stick.x + (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let dz = controls.stick.y + (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const moving = entered && !blocked && pose !== 'meditate' && (dx !== 0 || dz !== 0);
    const oldX = p.x;
    const oldZ = p.z;
    const speed = controls.run || k.has('shift') ? 2.7 : 1.65;

    if (moving) {
      const len = Math.max(1, Math.hypot(dx, dz));
      dx /= len;
      dz /= len;
      const x = (dx * Math.cos(controls.yaw) + dz * Math.sin(controls.yaw)) * dt * speed;
      const z = (-dx * Math.sin(controls.yaw) + dz * Math.cos(controls.yaw)) * dt * speed;
      if (canWalk(p.x + x, p.z, model.colliderRadius) && Math.abs(groundHeight(p.x + x, p.z) - groundHeight(p.x, p.z)) < 0.21) {
        p.x += x;
      }
      if (canWalk(p.x, p.z + z, model.colliderRadius) && Math.abs(groundHeight(p.x, p.z + z) - groundHeight(p.x, p.z)) < 0.21) {
        p.z += z;
      }
      if (ref.current) ref.current.rotation.y = Math.atan2(x, z);
    }

    gait.current += Math.hypot(p.x - oldX, p.z - oldZ);
    p.y = groundHeight(p.x, p.z);
    actor.current.copy(p);

    if (walking.current !== moving) {
      walking.current = moving;
      setWalk(moving);
    }
    if (ref.current) ref.current.position.copy(p);

    if (ref.current && rosary) {
      if (previousHeading.current === null) previousHeading.current = ref.current.rotation.y;
      const turn = Math.atan2(Math.sin(controls.yaw - ref.current.rotation.y), Math.cos(controls.yaw - ref.current.rotation.y));
      ref.current.rotation.y += turn * (1 - Math.exp(-dt * 8));
    } else if (ref.current && previousHeading.current !== null) {
      ref.current.rotation.y = previousHeading.current;
      previousHeading.current = null;
    }

    const offset = rosary && size.width <= 760 ? 0.7 : 0;
    const distance = rosary && size.width <= 760 ? 7 : controls.zoom;
    const focusX = p.x + Math.cos(controls.yaw) * offset;
    const focusZ = p.z - Math.sin(controls.yaw) * offset;
    const target = entered
      ? new THREE.Vector3(
          focusX + Math.sin(controls.yaw) * distance * Math.cos(controls.pitch),
          p.y + 1.6 * model.scale + Math.sin(controls.pitch) * distance,
          focusZ + Math.cos(controls.yaw) * distance * Math.cos(controls.pitch)
        )
      : new THREE.Vector3(19, 17, 24);
    const focus = new THREE.Vector3(focusX, p.y + (pose === 'meditate' ? 0.95 * model.scale : model.cameraHeight), focusZ);

    function avoidObstructions(point: THREE.Vector3) {
      let fraction = 1;
      for (const height of [0, 0.45]) {
        const origin = focus.clone().add(new THREE.Vector3(0, height, 0));
        const direction = point.clone().sub(origin);
        const length = direction.length();
        ray.current.set(origin, direction.normalize());
        ray.current.far = length;
        const hit = ray.current.intersectObjects(cameraObjects.current, false)[0];
        if (hit) fraction = Math.min(fraction, Math.max(0.12, (hit.distance - 0.3) / length));
      }
      if (fraction < 1) point.lerpVectors(focus, point, fraction);
    }

    if (entered) {
      refresh.current += dt;
      if (!cameraObjects.current.length || refresh.current > 1) {
        cameraObjects.current = [];
        scene.traverse((o) => {
          if (o.userData.cameraCollider) cameraObjects.current.push(o);
        });
        refresh.current = 0;
      }
      avoidObstructions(target);
    }

    camera.position.lerp(target, 1 - Math.exp(-dt * 6));
    if (entered) avoidObstructions(camera.position);
    camera.lookAt(entered ? focus : new THREE.Vector3(0, 1, -3));

    const near = entered ? places.find((q) => Math.hypot(p.x - q.x, p.z - q.z) < 2.8) || null : null;
    if (nearest.current !== (near?.id || '')) {
      nearest.current = near?.id || '';
      onNear(near);
    }
    onMove(p.x, p.z);
  });

  return (
    <group ref={ref}>
      <Avatar
        color={save.color}
        style={save.style}
        face={save.face}
        glasses={save.glasses}
        gender={save.gender}
        skinColor={save.skinColor}
        hairColor={save.hairColor}
        outfit={save.outfit}
        offering={offering}
        pose={pose}
        walking={walk}
        gait={gait}
        rosary={rosary}
        beadTick={beadTick}
        reducedMotion={matchMedia('(prefers-reduced-motion: reduce)').matches}
      />
    </group>
  );
}

class SceneError extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        <Leaf size={40} />
        <h2>Chưa thể mở không gian 3D</h2>
        <p>Thiết bị cần hỗ trợ WebGL. Hãy bật tăng tốc đồ họa hoặc thử trình duyệt mới hơn.</p>
        <button onClick={() => location.reload()}>Thử lại</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const webgl = supportsWebGL();

function App() {
  const [route, setRoute] = useState<'temple' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'temple'
  );
  const [save, setSave] = useState<Save>(loadProfile);
  const [entered, setEntered] = useState(false);
  const [near, setNear] = useState<Place | null>(null);
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState('');
  const [pose, setPose] = useState('idle');
  const [bellAt, setBellAt] = useState(0);
  const [wish, setWish] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [soundPanel, setSoundPanel] = useState(false);
  const [rosary, setRosary] = useState(false);
  const [beadTick, setBeadTick] = useState(0);
  const [npcNear, setNpcNear] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance | null>(null);
  const [offering, setOffering] = useState<'incense' | 'flowers' | null>(null);
  const [running, setRunning] = useState(false);

  // Form validation & onboarding state
  const [nameTouched, setNameTouched] = useState(false);
  const [genderTouched, setGenderTouched] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [editProfile, setEditProfile] = useState(false);

  // Sync state
  const [syncState, setSyncState] = useState<SyncState>(syncService.getStatus());

  const playerDot = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const endAt = useRef(0);
  const prayerEnd = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeGender: Gender = save.gender === 'female' ? 'female' : 'male';
  const playerPosition = useRef(new THREE.Vector3(save.position.x, 0, save.position.z));
  const saveRef = useRef(save);
  saveRef.current = save;

  const audioState = useAudioStatus();
  const scenePointers = useRef(new Map<number, { x: number; y: number }>());

  // Lắng nghe thay đổi routing
  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'temple');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Đăng ký listener đồng bộ
  useEffect(() => {
    return syncService.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  // Di trú hồ sơ cũ lên Supabase khi mở app có mạng
  useEffect(() => {
    void syncService.migrateLocalProfileIfNeeded(save);
  }, []);

  // Validation calculations
  const nameValidation = useMemo(() => validateDisplayName(save.name), [save.name]);
  const isGenderValid = isValidGender(save.gender);
  const isProfileValid = nameValidation.valid && isGenderValid;
  const isReturningVisitor = Boolean(save.onboardingCompleted) && isProfileValid;

  function updateAudio(p: Partial<AudioPreferences>) {
    configureAudio({ ...save, ...p });
    update(p);
  }

  function update(p: Partial<Save>) {
    setSave((s) => {
      const next = { ...s, ...p };
      syncService.queueSave(next);
      return next;
    });
  }

  function notify(text: string) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4200);
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [save]);

  useEffect(() => {
    if (!entered) return;
    const timer = setInterval(() => {
      const g = saveRef.current.gender === 'female' ? 'female' : 'male';
      const p = safePosition(playerPosition.current, modelConfig[g].colliderRadius);
      setSave((previous) => {
        if (Math.hypot(previous.position.x - p.x, previous.position.z - p.z) < 0.05) {
          return previous;
        }
        const next = { ...previous, position: p };
        syncService.queueSave(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [entered]);

  useEffect(() => {
    const flush = () => {
      try {
        const current = saveRef.current;
        const g = current.gender === 'female' ? 'female' : 'male';
        const finalSave = {
          ...current,
          position: safePosition(playerPosition.current, modelConfig[g].colliderRadius),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalSave));
        syncService.queueSave(finalSave, true);
      } catch {
        setStorageError(true);
      }
    };
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  useEffect(() => () => {
    closeAudio();
    clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    void prepareAudio();
    const sync = () => syncAudioAfterVisibility();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    configureAudio(save);
  }, [save.sound, save.chantVolume, save.environmentVolume, save.effectsVolume]);

  async function enterTemple() {
    setNameTouched(true);
    setGenderTouched(true);

    const nVal = validateDisplayName(save.name);
    if (!nVal.valid) {
      notify(nVal.error || 'Vui lòng nhập tên hiển thị hợp lệ.');
      return;
    }

    if (!isValidGender(save.gender)) {
      notify('Vui lòng chọn giới tính (Nam hoặc Nữ).');
      return;
    }

    setIsEntering(true);
    controls.yaw = 0;
    controls.pitch = 0.35;
    controls.zoom = 6;
    controls.keys.clear();
    controls.stick = { x: 0, y: 0 };

    const entrySound = { ...save, sound: true, chantVolume: save.chantVolume > 0 ? save.chantVolume : 0.5 };
    configureAudio(entrySound);
    playChantFromGesture();

    const finalizedSave: Save = {
      ...save,
      name: nVal.normalized,
      onboardingCompleted: true,
      sound: true,
      chantVolume: entrySound.chantVolume,
    };

    setSave(finalizedSave);
    saveRef.current = finalizedSave;
    syncService.queueSave(finalizedSave, true);

    setEntered(true);
    setIsEntering(false);
    notify('Chào ' + nVal.normalized + '. Dùng WASD hoặc joystick để dạo bước.');
  }

  function cancelInteraction() {
    endAt.current = 0;
    prayerEnd.current = 0;
    setDuration(0);
    setSeconds(0);
    setRosary(false);
    setPose('idle');
    setOffering(null);
    controls.keys.clear();
    controls.stick = { x: 0, y: 0 };
    scenePointers.current.clear();
  }

  function openAppearance() {
    cancelInteraction();
    setAppearanceDraft(normalizeAppearance(save));
    setModal('appearance');
  }

  function applyAppearance() {
    if (!appearanceDraft) return;
    const g: Gender = appearanceDraft.gender === 'female' ? 'female' : 'male';
    const position = nearbySafePosition(playerPosition.current, modelConfig[g].colliderRadius);
    controls.relocate = position;
    playerPosition.current.set(position.x, groundHeight(position.x, position.z), position.z);
    const nextSave = { ...save, ...appearanceDraft, position };
    setSave(nextSave);
    syncService.queueSave(nextSave, true);
    setModal('');
    notify('Đã cập nhật ngoại hình. Tiến trình và hồ sơ được giữ nguyên.');
  }

  function openNpc() {
    if (!entered || modal || rosary || duration || pose !== 'idle' || !npcInRange(playerPosition.current)) return;
    controls.keys.clear();
    controls.stick = { x: 0, y: 0 };
    const next = save.metGiaMinh ? save : { ...save, metGiaMinh: true };
    setSave(next);
    syncService.queueSave(next);
    setModal('npc');
  }

  function showRoute(target: Destination) {
    setDestination(target);
    setModal('');
    controls.keys.clear();
    notify('Đã đánh dấu ' + target.label.toLowerCase() + '. Hãy đi tới dấu vàng.');
  }

  function restoreProfile(profile: Save) {
    cancelInteraction();
    controls.relocate = profile.position;
    playerPosition.current.set(profile.position.x, groundHeight(profile.position.x, profile.position.z), profile.position.z);
    saveRef.current = profile;
    setSave(profile);
    syncService.queueSave(profile, true);
    setDestination(null);
    setModal('');
    notify('Đã khôi phục hồ sơ, ngoại hình và tiến trình.');
  }

  function complete(id: string) {
    setSave((s) => {
      const next = { ...s, completed: [...new Set([...s.completed, id])] };
      syncService.queueSave(next, true);
      return next;
    });
  }

  function interact() {
    if (!entered || modal || duration || rosary) return;
    if (npcNear) {
      openNpc();
      return;
    }
    if (!near) return;
    if (near.id === 'incense') {
      const nextSave = { ...save, incense: Math.min(7, save.incense + 1) };
      setSave(nextSave);
      syncService.queueSave(nextSave, true);
      setOffering('incense');
      setPose('prayer');
      prayerEnd.current = Date.now() + 2400;
      complete(near.id);
      notify('Đã thắp một nén hương. Dừng lại một chút, thở thật nhẹ.');
    } else if (near.id === 'bell') {
      if (Date.now() - bellAt < 4000) {
        notify('Xin chờ tiếng chuông ngân hết.');
        return;
      }
      setBellAt(Date.now());
      ring();
      complete(near.id);
      notify(save.sound ? 'Một tiếng chuông, một khoảng lặng.' : 'Chuông đã được thỉnh · Âm thanh đang tắt.');
    } else {
      setModal(near.id);
    }
  }

  function stepBead(delta = 1) {
    if (!rosary || modal || !entered) return;
    const nextTotal = Math.max(0, Math.min(MAX_BEADS, save.beadTotal + delta));
    setSave((s) => ({ ...s, beadTotal: nextTotal }));
    setBeadTick((n) => n + 1);
    if (save.beadSound && save.sound) beadClick();
    if (save.haptic && 'vibrate' in navigator) navigator.vibrate(8);
  }

  const totalBefore = useRef(save.beadTotal);
  useEffect(() => {
    if (save.beadTotal > totalBefore.current && beadProgress(save.beadTotal).rounds > beadProgress(totalBefore.current).rounds) {
      notify('Bạn đã hoàn thành một vòng 108 hạt.');
    }
    totalBefore.current = save.beadTotal;
  }, [save.beadTotal]);

  const sessionRef = useRef({ rosary, modal });
  sessionRef.current = { rosary, modal };
  const interactRef = useRef(interact);
  interactRef.current = interact;

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) return;
      const key = e.key.toLowerCase();
      if (sessionRef.current.modal) return;
      if (key === ' ' && sessionRef.current.rosary) return;
      if (key === 'Escape' && sessionRef.current.rosary && !sessionRef.current.modal) {
        setRosary(false);
        return;
      }
      if (sessionRef.current.rosary) return;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
      controls.keys.add(key);
      if (key === 'e' && !e.repeat) interactRef.current();
    };
    const keyup = (e: KeyboardEvent) => controls.keys.delete(e.key.toLowerCase());
    const clear = () => {
      controls.keys.clear();
      controls.stick = { x: 0, y: 0 };
      drag.current = null;
      scenePointers.current.clear();
      if (knob.current) knob.current.style.transform = 'translate(0,0)';
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (prayerEnd.current && Date.now() > prayerEnd.current) {
        setPose('idle');
        setOffering(null);
        prayerEnd.current = 0;
      }
      if (endAt.current) {
        const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
        setSeconds(left);
        if (!left) {
          endAt.current = 0;
          setDuration(0);
          setPose('idle');
          complete('meditate');
          notify('Buổi thiền đã hoàn thành. Mang sự bình yên theo bạn.');
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    controls.keys.clear();
    if (modal || !entered || duration || rosary) {
      scenePointers.current.clear();
    }
    controls.stick = { x: 0, y: 0 };
    if (knob.current) knob.current.style.transform = 'translate(0,0)';
  }, [modal, entered, duration, rosary]);

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal('');
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        document.querySelectorAll<HTMLElement>('.modal button:not(:disabled), .modal input, .modal textarea, .modal select, .modal summary')
      );
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [modal]);

  function finishMeditation() {
    endAt.current = 0;
    setDuration(0);
    setSeconds(0);
    setPose('idle');
    notify('Đã kết thúc buổi thiền. Cảm ơn bạn đã dành thời gian cho mình.');
  }

  function returnGate() {
    if (duration) finishMeditation();
    controls.reset++;
    setRosary(false);
    setModal('');
    setPose('idle');
    notify('Bạn đã trở về cổng tam quan.');
  }

  function stickMove(e: React.PointerEvent<HTMLDivElement>) {
    if (rosary || modal || duration) return;
    const rect = stick.current!.getBoundingClientRect();
    let x = e.clientX - rect.left - rect.width / 2;
    let y = e.clientY - rect.top - rect.height / 2;
    const len = Math.hypot(x, y);
    const max = rect.width * 0.3;
    if (len > max) {
      x = (x / len) * max;
      y = (y / len) * max;
    }
    controls.stick = { x: x / max, y: y / max };
    if (knob.current) knob.current.style.transform = `translate(${x}px,${y}px)`;
  }

  const closeModal = () => {
    setModal('');
    controls.keys.clear();
  };

  async function handleReleaseWish() {
    if (!wish.trim()) return;
    const trimmed = wish.trim();
    const newWish = { text: trimmed, date: new Date().toISOString() };
    const nextWishes = [...save.wishes, newWish].slice(-30);
    const nextSave: Save = {
      ...save,
      wishes: nextWishes,
      completed: [...new Set([...save.completed, 'lantern'])],
    };
    setSave(nextSave);
    saveRef.current = nextSave;
    syncService.queueSave(nextSave, true);
    void syncService.addWish(save, trimmed, save.flower);
    setWish('');
    closeModal();
    notify('Hoa đăng đã thả. Lời chúc được gửi an toàn.');
  }

  async function handleDeleteWish(wishDate: string) {
    if (!confirm('Bạn có chắc muốn xóa lời chúc này?')) return;
    const nextWishes = save.wishes.filter((w) => w.date !== wishDate);
    const nextSave: Save = { ...save, wishes: nextWishes };
    setSave(nextSave);
    saveRef.current = nextSave;
    syncService.queueSave(nextSave, true);
    void syncService.deleteWish(save, wishDate);
    notify('Đã xóa lời chúc.');
  }

  // Nếu route là admin, hiển thị AdminDashboard
  if (route === 'admin') {
    return (
      <AdminDashboard
        onExit={() => {
          history.pushState({}, '', '/');
          setRoute('temple');
        }}
      />
    );
  }

  return (
    <main
      className={`${rosary ? 'rosary-open' : ''} ${entered ? 'in-temple' : 'at-entry'} ${soundPanel ? 'sound-open' : ''}`}
      data-avatar-pose={pose}
      data-avatar-beads={rosary}
      data-avatar-gender={save.gender || 'unselected'}
      data-npc-near={npcNear}
    >
      <div
        className="scene"
        tabIndex={-1}
        onPointerDown={(e) => {
          if (!entered || rosary || modal || e.button !== 0) return;
          e.currentTarget.focus();
          scenePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!entered || rosary || modal) return;
          const map = scenePointers.current;
          const old = map.get(e.pointerId);
          if (!old) return;
          const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
          if (other) {
            const before = Math.hypot(old.x - other.x, old.y - other.y);
            const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
            if (after > 1) controls.zoom = THREE.MathUtils.clamp((controls.zoom * before) / after, 3, 9);
          } else {
            controls.yaw -= (e.clientX - old.x) * 0.005;
            controls.pitch = Math.max(0.08, Math.min(0.95, controls.pitch + (e.clientY - old.y) * 0.003));
          }
          map.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => scenePointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => scenePointers.current.delete(e.pointerId)}
        onLostPointerCapture={(e) => scenePointers.current.delete(e.pointerId)}
        onWheel={(e) => {
          if (!rosary && !modal) controls.zoom = THREE.MathUtils.clamp(controls.zoom + e.deltaY * 0.004, 3, 9);
        }}
      >
        {webgl ? (
          <SceneError>
            <Suspense fallback={<div className="loading">Đang mở lối vào GM TỰ…</div>}>
              <Canvas
                shadows={save.quality !== 'low'}
                dpr={save.quality === 'low' ? 1 : save.quality === 'medium' ? [1, 1.25] : [1, 1.75]}
                camera={{ position: [19, 17, 24], fov: 48, near: 0.1, far: 100 }}
                onCreated={() => setLoaded(true)}
                gl={{ antialias: save.quality !== 'low', powerPreference: save.quality === 'low' ? 'low-power' : 'high-performance' }}
              >
                <Environment quality={save.quality} incense={save.incense} flower={save.flower} wishes={save.wishes} bellAt={bellAt} />
                <Player
                  save={save}
                  entered={entered}
                  pose={pose}
                  blocked={!!modal || rosary || pose === 'prayer'}
                  rosary={rosary}
                  beadTick={beadTick}
                  actor={playerPosition}
                  offering={offering}
                  onNear={setNear}
                  onMove={(x, z) => {
                    if (playerDot.current) {
                      playerDot.current.style.left = `${((x + 15) / 30) * 100}%`;
                      playerDot.current.style.top = `${((z + 14) / 30) * 100}%`;
                    }
                  }}
                />
                <GiaMinh player={playerPosition} entered={entered} talking={modal === 'npc'} quality={save.quality} onNear={setNpcNear} onTalk={openNpc} />
                {entered && destination && <DestinationMarker target={destination} quality={save.quality} />}
              </Canvas>
            </Suspense>
          </SceneError>
        ) : (
          <div className="webgl-error">
            <h2>Thiết bị chưa hỗ trợ WebGL</h2>
            <p>Hãy bật tăng tốc đồ họa hoặc mở bằng trình duyệt hỗ trợ WebGL.</p>
          </div>
        )}
      </div>

      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (entered) setModal('info');
          }}
        >
          <span className="brand-symbol">
            <Flower2 />
          </span>
          <span>
            GM TỰ<small>ĐI CHÙA ONLINE</small>
          </span>
        </a>
        <div className="header-right">
          <span className={`sync-badge ${syncState}`} title={syncState === 'synced' ? 'Đã đồng bộ đám mây Supabase' : 'Lưu trên thiết bị'}>
            {syncState === 'synced' ? <Cloud size={12} /> : <CloudOff size={12} />}
            <span>{syncState === 'synced' ? 'Đã đồng bộ' : syncState === 'saving' ? 'Đang lưu…' : syncState === 'offline' ? 'Chưa đồng bộ' : 'Lưu trên thiết bị'}</span>
          </span>
          <span className="quiet">
            <i /> Không gian của riêng bạn
          </span>
          {entered && (
            <div className="tools">
              <button
                className={`speaker ${audioState.status}`}
                aria-label={`${audioState.kind === 'music' ? 'Nhạc nền' : 'Kinh'}: ${audioState.message}`}
                title={audioState.message}
                onClick={() => {
                  setSoundPanel(true);
                  if (audioState.status === 'playing' && save.sound) {
                    updateAudio({ sound: false });
                  } else {
                    if (!save.sound) updateAudio({ sound: true });
                    else configureAudio(save);
                    playChantFromGesture();
                  }
                }}
              >
                {['error', 'blocked', 'missing'].includes(audioState.status) ? (
                  <AlertCircle />
                ) : ['loading', 'waiting'].includes(audioState.status) ? (
                  <LoaderCircle className="spin" />
                ) : !save.sound || audioState.status !== 'playing' ? (
                  <VolumeX />
                ) : (
                  <Volume2 />
                )}
                <span>
                  {audioState.status === 'playing'
                    ? 'Đang phát'
                    : audioState.status === 'missing'
                    ? 'Thiếu bản ghi'
                    : audioState.status === 'error'
                    ? 'Lỗi âm thanh'
                    : 'Âm thanh'}
                </span>
              </button>
              <button aria-label="Cài đặt" title="Cài đặt" onClick={() => setModal('settings')}>
                <Settings2 />
              </button>
              <button aria-label="Hướng dẫn" title="Hướng dẫn" onClick={() => setModal('help')}>
                <HelpCircle />
              </button>
              <button aria-label="Về cổng" title="Về cổng" onClick={returnGate}>
                <DoorOpen />
              </button>
            </div>
          )}
        </div>
      </header>

      {!entered ? (
        <>
          <section className="welcome">
            <span className="eyebrow">MỘT CHÚT TĨNH LẶNG, GIỮA ĐỜI VỘI VÃ</span>
            <h1>
              Trở về tĩnh lặng.<br />
              <em>Giữa lòng chùa Việt.</em>
            </h1>
            <p>Bước qua cổng chùa, để những bộn bề ở lại.</p>

            <div className="entry-card">
              <div className="card-title">
                <Leaf size={17} />
                <span>Chuẩn bị cho chuyến ghé thăm</span>
              </div>

              {isReturningVisitor && (
                <div className="welcome-returning-pill">
                  <span>Chào mừng trở lại, <strong>{save.name}</strong>!</span>
                </div>
              )}

              <div className="input-header">
                <label htmlFor="name">Tên của bạn *</label>
                <span className="char-counter">{countUnicodeGraphemes(save.name)}/30</span>
              </div>
              <input
                id="name"
                maxLength={30}
                value={save.name}
                onBlur={() => setNameTouched(true)}
                onChange={(e) => {
                  setNameTouched(true);
                  update({ name: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isProfileValid && webgl && loaded && audioState.status !== 'loading') {
                      void enterTemple();
                    } else {
                      setNameTouched(true);
                      setGenderTouched(true);
                    }
                  }
                }}
                placeholder="Nhập tên hiển thị của bạn…"
              />
              {nameTouched && !nameValidation.valid ? (
                <small className="field-error" role="alert">
                  {nameValidation.error}
                </small>
              ) : (
                <small className="field-hint">Nhập tên từ 2 đến 30 ký tự (hỗ trợ tiếng Việt có dấu).</small>
              )}

              <SceneError>
                <AppearancePicker
                  value={save}
                  onChange={(patch) => {
                    setGenderTouched(true);
                    update(patch);
                  }}
                  webgl={webgl}
                />
              </SceneError>
              {genderTouched && !isGenderValid && (
                <small className="field-error" role="alert">
                  Vui lòng chọn giới tính (Nam hoặc Nữ).
                </small>
              )}

              <button
                className="primary enter"
                aria-label={!webgl ? 'Thiết bị cần hỗ trợ WebGL' : 'Vào chùa'}
                disabled={!isProfileValid || !webgl || !loaded || audioState.status === 'loading' || isEntering}
                onClick={enterTemple}
              >
                {!webgl
                  ? 'Thiết bị cần hỗ trợ WebGL'
                  : !loaded
                  ? 'Đang chuẩn bị cảnh…'
                  : audioState.status === 'loading'
                  ? 'Đang chuẩn bị nhạc…'
                  : isEntering
                  ? 'Đang vào chùa…'
                  : isReturningVisitor
                  ? 'Tiếp tục'
                  : 'Vào chùa'}
                <ArrowRight size={18} />
              </button>

              <small className="guest-note">
                Vào với tư cách khách · Không cần đăng ký
                {!isProfileValid && (
                  <span style={{ display: 'block', color: '#8a6c3f', marginTop: 2 }}>
                    (Yêu cầu nhập tên từ 2–30 ký tự và chọn Nam hoặc Nữ)
                  </span>
                )}
              </small>
            </div>
          </section>

          <div className="scene-caption">
            <span>01 / GM TỰ</span>
            <h2>Một chốn về bình yên.</h2>
            <p>Chùa Việt trong không gian 3D</p>
          </div>

          <footer>
            <span>Không gian mô phỏng văn hóa chùa Việt</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="text-action"
                style={{ fontSize: 11, color: '#8c7654' }}
                onClick={() => setModal('profile')}
              >
                Khôi phục tiến trình
              </button>
              <button
                className="text-action"
                style={{ fontSize: 11, color: '#8c7654' }}
                onClick={() => {
                  history.pushState({}, '', '/admin');
                  setRoute('admin');
                }}
              >
                <Shield size={12} /> Quản trị
              </button>
              <button onClick={() => setModal('info')}>
                Về GM TỰ <ArrowRight size={13} />
              </button>
            </div>
          </footer>
        </>
      ) : (
        <>
          <div className="location">
            <span className="eyebrow">GM TỰ</span>
            <h2>{npcNear ? 'Trụ trì Gia Minh' : near?.area || 'Dạo bước trong sân chùa'}</h2>
            <p>
              <MapPin size={13} />
              {save.name.trim() || 'Khách ghé chùa'} · {save.completed.length}/5 trải nghiệm
            </p>
          </div>

          <aside className="map">
            <div>
              <Compass size={15} /> Khuôn viên
            </div>
            <div className="map-inner">
              <span className="map-hall">CHÍNH ĐIỆN</span>
              <span className="map-path" />
              <span className="map-pond" />
              {places.map((p) => (
                <span key={p.id} title={p.area} className="map-place" style={{ left: `${((p.x + 15) / 30) * 100}%`, top: `${((p.z + 14) / 30) * 100}%` }}>
                  {save.completed.includes(p.id) ? '✓' : '·'}
                </span>
              ))}
              {destination && <span className="map-destination" title={destination.label} style={{ left: `${((destination.x + 15) / 30) * 100}%`, top: `${((destination.z + 14) / 30) * 100}%` }} />}
              <span ref={playerDot} className="player-dot" />
            </div>
            <small>● Bạn đang ở đây</small>
          </aside>

          <nav className="activities" aria-label="Các hoạt động">
            {places.map((p, i) => (
              <button
                key={p.id}
                className={near?.id === p.id ? 'active' : ''}
                onClick={() =>
                  notify(`Đến ${p.area.toLowerCase()} ${['phía trước chính điện', 'bên phải chính điện', 'bên trái sân chùa', 'góc trái phía cổng', 'bên phải sân chùa'][i]} để ${p.name.toLowerCase()}.`)
                }
              >
                <span className="activity-icon">{save.completed.includes(p.id) ? <Check size={17} /> : p.icon}</span>
                <span>{p.name}</span>
              </button>
            ))}
            <button
              className={rosary ? 'active' : ''}
              aria-pressed={rosary}
              onClick={() => {
                setRosary((v) => !v);
                controls.keys.clear();
                controls.stick = { x: 0, y: 0 };
              }}
            >
              <span className="activity-icon">
                <CircleDot size={21} />
              </span>
              <span>Tràng hạt</span>
            </button>
            <button
              disabled={rosary || pose !== 'idle' || !!duration || !!modal}
              onClick={() => {
                setPose('wave');
                prayerEnd.current = Date.now() + 2300;
                notify('Chào bạn, chúc bạn một ngày nhẹ nhàng!');
              }}
            >
              <span className="activity-icon">
                <Hand size={21} />
              </span>
              <span>Chào</span>
            </button>
          </nav>

          {destination && <NavigationHud target={destination} player={playerPosition} onClose={() => setDestination(null)} />}

          {!duration && !rosary && !modal && (
            <div className="interaction">
              {npcNear ? (
                <button className="primary npc-interact" disabled={pose !== 'idle'} aria-label="Trò chuyện với trụ trì Gia Minh" onClick={openNpc}>
                  <span className="key">E</span>
                  <span className="desktop-talk">Trò chuyện với trụ trì Gia Minh</span>
                  <span className="mobile-talk">Trò chuyện</span>
                </button>
              ) : near ? (
                <button className="primary" onClick={interact}>
                  <span className="key">E</span>
                  {near.name}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <span className="walk-hint">Dạo bước, tìm một khoảng bình yên.</span>
              )}
            </div>
          )}

          {soundPanel && <AudioPanel value={save} onChange={updateAudio} onClose={() => setSoundPanel(false)} />}

          <div className="desktop-help">
            <span>W A S D</span> di chuyển <i /> Kéo để nhìn quanh · Shift để chạy <i /> <span>E</span> tương tác
          </div>

          <button
            className="run-toggle"
            aria-pressed={running}
            disabled={!!modal || rosary || !!duration}
            onClick={() => {
              controls.run = !running;
              setRunning(!running);
            }}
          >
            {running ? 'Đi bộ' : 'Chạy'}
          </button>

          <div
            className="joystick"
            ref={stick}
            aria-label="Joystick di chuyển"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              stickMove(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) stickMove(e);
            }}
            onPointerUp={() => {
              controls.stick = { x: 0, y: 0 };
              if (knob.current) knob.current.style.transform = 'translate(0,0)';
            }}
            onPointerCancel={() => {
              controls.stick = { x: 0, y: 0 };
              if (knob.current) knob.current.style.transform = 'translate(0,0)';
            }}
            onLostPointerCapture={() => {
              controls.stick = { x: 0, y: 0 };
              if (knob.current) knob.current.style.transform = 'translate(0,0)';
            }}
            onTouchEnd={() => {
              controls.stick = { x: 0, y: 0 };
              if (knob.current) knob.current.style.transform = 'translate(0,0)';
            }}
            onTouchCancel={() => {
              controls.stick = { x: 0, y: 0 };
              if (knob.current) knob.current.style.transform = 'translate(0,0)';
            }}
          >
            <div ref={knob} />
          </div>

          {rosary && (
            <RosaryPanel
              total={save.beadTotal}
              sound={save.beadSound}
              haptic={save.haptic}
              onHaptic={(v) => update({ haptic: v })}
              low={save.quality === 'low'}
              paused={!!modal}
              onSound={(on) => update({ beadSound: on })}
              onDelta={stepBead}
              onReset={() => {
                update({ beadTotal: 0 });
                notify('Đã đặt lại tiến trình tràng hạt.');
              }}
              onClose={() => setRosary(false)}
            />
          )}

          {duration > 0 && (
            <section className="meditation">
              <span className="breath-orb">
                <Leaf size={28} />
              </span>
              <span className="eyebrow">MỘT KHOẢNG LẶNG CHO MÌNH</span>
              <h2>
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
              </h2>
              <p>{(duration * 60 - seconds) % 10 < 4 ? 'Hít vào thật nhẹ…' : 'Thở ra chậm rãi…'}</p>
              <button onClick={finishMeditation}>Kết thúc buổi thiền</button>
            </section>
          )}
        </>
      )}

      {toast && (
        <div className="toast" role="status">
          <Leaf size={16} />
          {toast}
        </div>
      )}

      {storageError && (
        <div className="storage-warning" role="alert">
          Không thể lưu trên thiết bị này. Tiến trình chỉ giữ trong phiên hiện tại.
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <section
            className={`modal ${modal === 'npc' ? 'npc-modal' : modal === 'appearance' ? 'appearance-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button className="close" aria-label="Đóng" autoFocus onClick={closeModal}>
              <X />
            </button>
            <Flower2 className="modal-symbol" />
            <span className="eyebrow">GM TỰ</span>
            <h2 id="dialog-title">
              {
                {
                  flowers: 'Một chút hương sắc',
                  lantern: 'Gửi một lời an lành',
                  meditate: 'Trở về với hơi thở',
                  settings: 'Theo cách của bạn',
                  help: 'Dạo bước thật thong thả',
                  info: 'Về GM TỰ',
                  npc: 'Trụ trì Gia Minh',
                  appearance: 'Ngoại hình của bạn',
                  profile: 'Lưu và khôi phục',
                }[modal]
              }
            </h2>

            {modal === 'npc' && (
              <Dialogue
                name={save.name}
                viewed={save.viewedGuides}
                onViewed={(id) => update({ viewedGuides: [...new Set([...save.viewedGuides, id])] })}
                onRoute={showRoute}
                onClose={closeModal}
              />
            )}

            {modal === 'appearance' && appearanceDraft && (
              <>
                <p className="subtle">
                  Đổi ngoại hình tại chỗ, giữ tên và toàn bộ tiến trình. Hoạt động đang thực hiện đã được dừng an toàn.
                </p>
                <SceneError>
                  <AppearancePicker
                    value={appearanceDraft}
                    onChange={(patch) => setAppearanceDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
                    webgl={webgl}
                  />
                </SceneError>
                <div className="appearance-actions">
                  <button onClick={closeModal}>Hủy thay đổi</button>
                  <button className="primary" onClick={applyAppearance}>
                    Áp dụng ngoại hình
                  </button>
                </div>
              </>
            )}

            {modal === 'profile' && (
              <ProfileTransfer
                profile={{
                  ...save,
                  position: safePosition(playerPosition.current, modelConfig[activeGender].colliderRadius),
                }}
                onRestore={restoreProfile}
                notify={notify}
              />
            )}

            {modal === 'flowers' && (
              <>
                <p>Chọn loài hoa đặt lên bàn dâng lễ.</p>
                <div className="flower-options">
                  {[
                    ['Sen hồng', '#e7a9a4'],
                    ['Cúc vàng', '#f3d272'],
                    ['Hoa trắng', '#f7eee0'],
                  ].map(([label, c]) => (
                    <button
                      key={c}
                      onClick={() => {
                        update({ flower: c });
                        complete('flowers');
                        setOffering('flowers');
                        setPose('prayer');
                        prayerEnd.current = Date.now() + 2000;
                        closeModal();
                        notify(`Đã đặt ${label.toLowerCase()} lên bàn dâng lễ.`);
                      }}
                    >
                      <Flower2 size={36} color={c} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modal === 'lantern' && (
              <>
                <div className="wish-privacy-note">
                  Lời chúc sẽ được gửi đến ban quản trị GM TỰ và không hiển thị công khai.
                </div>
                <label htmlFor="wish">Lời chúc của bạn</label>
                <textarea
                  id="wish"
                  maxLength={150}
                  rows={4}
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  placeholder="Mong những ngày tới luôn nhẹ nhàng…"
                />
                <small className="counter">{wish.length}/150</small>
                <button className="primary" disabled={!wish.trim()} onClick={handleReleaseWish}>
                  Thả hoa đăng <Flower2 size={17} />
                </button>
                {save.wishes.length > 0 && (
                  <details style={{ marginTop: 14 }}>
                    <summary>Lời chúc đã gửi ({save.wishes.length})</summary>
                    <div className="wish-list">
                      {save.wishes
                        .slice()
                        .reverse()
                        .map((w, i) => (
                          <div key={i} className="wish-item">
                            <div className="wish-item-content">
                              <p>{w.text}</p>
                              <small>{new Date(w.date).toLocaleDateString('vi-VN')}</small>
                            </div>
                            <button
                              className="wish-delete-btn"
                              title="Xóa lời chúc"
                              onClick={() => handleDeleteWish(w.date)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </>
            )}

            {modal === 'meditate' && (
              <>
                <p>Ngồi thoải mái. Thả lỏng vai và chọn thời gian cho mình.</p>
                <div className="time-options">
                  {[1, 3, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => {
                        setDuration(n);
                        setSeconds(n * 60);
                        endAt.current = Date.now() + n * 60000;
                        setPose('meditate');
                        closeModal();
                      }}
                    >
                      <strong>{n}</strong> phút
                    </button>
                  ))}
                </div>
                <small>Bạn có thể kết thúc bất cứ lúc nào.</small>
              </>
            )}

            {modal === 'settings' && (
              <>
                <label htmlFor="settings-name">Tên hiển thị</label>
                <input
                  id="settings-name"
                  maxLength={30}
                  value={save.name}
                  onChange={(e) => {
                    const nextVal = validateDisplayName(e.target.value);
                    if (nextVal.valid) {
                      update({ name: nextVal.normalized });
                    } else {
                      setSave((s) => ({ ...s, name: e.target.value }));
                    }
                  }}
                  placeholder="Tên của bạn…"
                />
                {!validateDisplayName(save.name).valid && (
                  <small className="field-error">
                    {validateDisplayName(save.name).error}
                  </small>
                )}

                <label htmlFor="quality" style={{ marginTop: 10 }}>Chất lượng đồ họa</label>
                <select
                  id="quality"
                  value={save.quality}
                  onChange={(e) => {
                    update({ quality: e.target.value as Quality, low: e.target.value === 'low' });
                    notify('Đã cập nhật chất lượng đồ họa.');
                  }}
                >
                  <option value="low">Thấp · Tiết kiệm pin</option>
                  <option value="medium">Vừa · Cân bằng</option>
                  <option value="high">Cao · Bóng và bề mặt chi tiết</option>
                </select>

                <button
                  className="text-action"
                  onClick={() => {
                    closeModal();
                    setSoundPanel(true);
                  }}
                >
                  Âm lượng bản ghi, môi trường và hiệu ứng
                </button>

                <p className="subtle">
                  Tiến trình được đồng bộ đám mây và lưu an toàn cục bộ. Bạn có thể tạo mã khôi phục để chuyển thiết bị.
                </p>

                <button className="text-action" onClick={openAppearance}>
                  Chỉnh sửa ngoại hình
                </button>
                <button
                  className="text-action"
                  onClick={() => {
                    cancelInteraction();
                    setModal('profile');
                  }}
                >
                  Lưu và khôi phục
                </button>
                <button
                  className="text-action"
                  onClick={() => {
                    cancelInteraction();
                    closeModal();
                    setEntered(false);
                  }}
                >
                  <RotateCcw size={15} /> Đổi nhân vật
                </button>
              </>
            )}

            {modal === 'help' && (
              <>
                <p>Máy tính: WASD hoặc phím mũi tên để di chuyển. Giữ và kéo chuột để xoay góc nhìn.</p>
                <p>Điện thoại: dùng joystick góc trái, kéo trên cảnh để nhìn quanh.</p>
                <p>Đến gần một địa điểm, nhấn E hoặc nút tương tác trên màn hình.</p>
                <p>
                  Giữ Shift để chạy; điện thoại có nút Chạy. Trụ trì Gia Minh đứng bên trái tượng Phật: đến gần rồi nhấn E hoặc Trò chuyện.
                </p>
                <div className="help-list">
                  {places.map((p) => (
                    <div key={p.id}>
                      <span>
                        {p.icon} {p.name}
                      </span>
                      <small>{p.area}</small>
                    </div>
                  ))}
                </div>
                <button className="primary" onClick={closeModal}>
                  Đã hiểu <Check size={16} />
                </button>
              </>
            )}

            {modal === 'info' && (
              <>
                <p>Không gian mô phỏng để thư giãn và trải nghiệm văn hóa chùa Việt.</p>
                <p>
                  Một trải nghiệm một người chơi. Không cần tài khoản. Lời chúc và tiến trình được bảo vệ an toàn.
                </p>
                <p className="subtle">
                  Hình học và vật liệu được dựng bằng mã nguồn. Nhạc nền sử dụng bản ghi được cấu hình trong website. Các hoạt động mang tính mô phỏng văn hóa.
                </p>
                <button className="primary" onClick={closeModal}>
                  Tiếp tục <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
