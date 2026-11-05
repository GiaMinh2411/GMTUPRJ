import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function TempleSign() {
  const sign = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
    const context = canvas.getContext('2d')!, texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      context.fillStyle = '#33291e'; context.fillRect(0, 0, 768, 160);
      context.strokeStyle = '#a18451'; context.lineWidth = 5; context.strokeRect(10, 10, 748, 140);
      context.fillStyle = '#cfbb87'; context.textAlign = 'center'; context.font = '600 83px "Noto Serif Variable", serif';
      context.fillText('GM TỰ', 384, 110); texture.needsUpdate = true;
    };
    draw(); return { texture, draw };
  }, []);
  useEffect(() => {
    let active = true;
    void document.fonts.load('600 83px "Noto Serif Variable"', 'GM TỰ').then(() => { if (active) sign.draw(); }).catch(() => {});
    return () => { active = false; sign.texture.dispose(); };
  }, [sign]);
  return <mesh position={[0, 3.25, 12.27]}><planeGeometry args={[2.7, .56]} /><meshStandardMaterial map={sign.texture} roughness={1} /></mesh>;
}
