import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// Locally generated, neutral daylight for PBR reflections. No HDR download.
export function SkyLighting(){const {gl,scene}=useThree();useEffect(()=>{
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#9daebc');gradient.addColorStop(.48,'#d6ddd7');gradient.addColorStop(.54,'#a4a78e');gradient.addColorStop(1,'#565b43');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,128);ctx.fillStyle='#fff2d2';ctx.beginPath();ctx.arc(69,33,5,0,Math.PI*2);ctx.fill();
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;const generator=new THREE.PMREMGenerator(gl),target=generator.fromEquirectangular(texture);scene.environment=target.texture;scene.environmentIntensity=.4;texture.dispose();generator.dispose();
 return()=>{if(scene.environment===target.texture)scene.environment=null;target.dispose();};
 },[gl,scene]);return null;}
