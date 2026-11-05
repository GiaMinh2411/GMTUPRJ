import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar } from './human';
import { faces, robes, hairColors, hairstyles, skinTones, type Appearance, type Face, type Outfit } from './appearance-config';
import { Check } from 'lucide-react';
export type { Appearance } from './appearance-config';

function PreviewRig({ value, angle }: { value: Appearance; angle: React.RefObject<number> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = angle.current;
  });
  return (
    <group ref={ref} position={[0, -0.84, 0]}>
      <Avatar {...value} />
    </group>
  );
}

export function AppearancePicker({
  value,
  onChange,
  webgl,
  hideGenderChoice = false,
}: {
  value: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
  webgl: boolean;
  hideGenderChoice?: boolean;
}) {
  const angle = useRef(-0.18);
  const drag = useRef<{ id: number; x: number } | null>(null);

  return (
    <div className="appearance-picker">
      {!hideGenderChoice && (
        <fieldset className="gender-options">
          <legend>Mẫu nhân vật *</legend>
          <div className="gender-button-group">
            <button
              type="button"
              className={`gender-btn ${value.gender === 'male' ? 'active' : ''}`}
              aria-pressed={value.gender === 'male'}
              onClick={() => onChange({ gender: 'male' })}
            >
              {value.gender === 'male' && <Check size={16} className="gender-check" />}
              <span>Nam</span>
            </button>
            <button
              type="button"
              className={`gender-btn ${value.gender === 'female' ? 'active' : ''}`}
              aria-pressed={value.gender === 'female'}
              onClick={() => onChange({ gender: 'female' })}
            >
              {value.gender === 'female' && <Check size={16} className="gender-check" />}
              <span>Nữ</span>
            </button>
          </div>
          {!value.gender && (
            <small className="field-hint warning-text">Vui lòng chọn Nam hoặc Nữ để tạo nhân vật.</small>
          )}
        </fieldset>
      )}

      <div
        className="avatar-preview"
        role="img"
        aria-label={
          value.gender
            ? `Xem trước nhân vật ${value.gender === 'female' ? 'nữ' : 'nam'} 3D · ${
                faces.find((f) => f.id === value.face)?.label
              }${value.glasses ? ' · kính tròn' : ''}`
            : 'Chưa chọn mẫu nhân vật'
        }
        data-gender={value.gender || 'unselected'}
        data-face={value.face}
        data-hair={value.style}
        data-color={value.color}
        data-glasses={value.glasses}
        tabIndex={0}
        onPointerDown={(e) => {
          if (drag.current) return;
          drag.current = { id: e.pointerId, x: e.clientX };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          angle.current += (e.clientX - drag.current.x) * 0.012;
          drag.current.x = e.clientX;
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onLostPointerCapture={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            angle.current += e.key === 'ArrowLeft' ? -0.2 : 0.2;
          }
        }}
      >
        {webgl && value.gender ? (
          <Canvas dpr={1} camera={{ position: [0, 1.25, 3.7], fov: 34 }} gl={{ antialias: true, powerPreference: 'low-power' }}>
            <ambientLight intensity={1.8} />
            <directionalLight position={[2, 4, 4]} intensity={2} />
            <PreviewRig value={value} angle={angle} />
          </Canvas>
        ) : (
          <div className="preview-placeholder">
            <span>Chọn Nam hoặc Nữ để xem trước 3D</span>
          </div>
        )}
        <span>{value.gender ? `Kéo để xoay · ${value.gender === 'female' ? 'Nữ' : 'Nam'}` : 'Chưa chọn giới tính'}</span>
      </div>

      <div className="appearance-fields">
        <label htmlFor="hair">Kiểu tóc</label>
        <select id="hair" value={value.style} onChange={(e) => onChange({ style: Number(e.target.value) })}>
          {hairstyles.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>

        <label htmlFor="face">Khuôn mặt</label>
        <select id="face" value={value.face} onChange={(e) => onChange({ face: e.target.value as Face })}>
          {faces.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        <label className="glasses-option">
          <input type="checkbox" checked={value.glasses} onChange={(e) => onChange({ glasses: e.target.checked })} /> Kính tròn
        </label>

        <div className="robe-options" aria-label="Màu trang phục">
          {robes.map((r) => (
            <button
              key={r.color}
              type="button"
              aria-pressed={value.color === r.color}
              onClick={() => onChange({ color: r.color })}
            >
              <i style={{ background: r.color }} />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <details className="appearance-advanced">
        <summary>Thêm tùy chỉnh</summary>
        <div>
          <label htmlFor="skin">Màu da</label>
          <select id="skin" value={value.skinColor} onChange={(e) => onChange({ skinColor: e.target.value })}>
            {skinTones.map((s) => (
              <option key={s.color} value={s.color}>
                {s.label}
              </option>
            ))}
          </select>
          <label htmlFor="hair-color">Màu tóc</label>
          <select id="hair-color" value={value.hairColor} onChange={(e) => onChange({ hairColor: e.target.value })}>
            {hairColors.map((h) => (
              <option key={h.color} value={h.color}>
                {h.label}
              </option>
            ))}
          </select>
          <label htmlFor="outfit">Trang phục</label>
          <select id="outfit" value={value.outfit} onChange={(e) => onChange({ outfit: e.target.value as Outfit })}>
            <option value="lam">Áo lam và quần dài</option>
            <option value="shirt">Áo dài tay và quần dài</option>
          </select>
        </div>
      </details>
    </div>
  );
}
