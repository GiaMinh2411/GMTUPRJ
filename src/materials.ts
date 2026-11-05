import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
export type Surface = 'wood'|'stone'|'tile'|'bronze'|'cloth'|'leaf'|'plaster';
function noise(x:number,y:number) { const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n); }
// Original, deterministic surface maps. No remote images or licensed model dependency.
export function surfaceMaps(kind:Surface,size=256) {
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!,data=ctx.createImageData(size,size),height=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const u=x/size,v=y/size,n=noise(x,y),b=noise(Math.floor(x/6),Math.floor(y/6));let h=.5;
  if(kind==='wood')h=.5+.17*Math.sin(u*120+Math.sin(v*15)*2+Math.sin(v*43)*.5)+.06*Math.sin(u*550+v*10)+n*.08;
  if(kind==='stone')h=.35+n*.2+b*.18+(x%128<2||y%128<2?-.24:0);
  if(kind==='tile')h=.4+n*.16+.1*Math.sin(u*10)*Math.sin(v*13)+b*.07;
  if(kind==='bronze')h=.5+n*.12+(b>.8?-.17:0);
  if(kind==='cloth')h=.45+.09*Math.sin(x*Math.PI*.5)+.09*Math.sin(y*Math.PI*.5)+n*.04;
  if(kind==='leaf')h=.4+.12*Math.sin(v*50+Math.abs(u-.5)*80)+(Math.abs(u-.5)<.01?.2:0);
  if(kind==='plaster')h=.5+n*.06+b*.06;
  height[y*size+x]=h;const shade=Math.max(0,Math.min(255,170+h*75));const i=(y*size+x)*4;data.data[i]=shade;data.data[i+1]=shade;data.data[i+2]=shade;data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;
 const normals=new Uint8Array(size*size*4),rough=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const i=(y*size+x)*4,h=height[y*size+x],dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
  normals[i]=128-dx*110;normals[i+1]=128-dy*110;normals[i+2]=250;normals[i+3]=255;
  rough[i]=rough[i+1]=rough[i+2]=kind==='bronze'?125+h*55:190+h*45;rough[i+3]=255;
 }
 const normalMap=new THREE.DataTexture(normals,size,size),roughnessMap=new THREE.DataTexture(rough,size,size);for(const tex of [normalMap,roughnessMap]){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.needsUpdate=true;}
 return {map,normalMap,roughnessMap};
}
export function makeMaterial(kind:Surface,color:string,size=256) {
 const maps=surfaceMaps(kind,size);const material=new THREE.MeshStandardMaterial({...maps,color,roughness:kind==='bronze'?.65:.92,metalness:kind==='bronze'?.75:0,normalScale:new THREE.Vector2(.28,.28),side:kind==='tile'?THREE.DoubleSide:THREE.FrontSide});
 return {material,dispose:()=>{Object.values(maps).forEach(t=>t.dispose());material.dispose();}};
}
export function useSurface(kind:Surface,color:string,size=256) { const resource=useMemo(()=>makeMaterial(kind,color,size),[kind,color,size]);useEffect(()=>()=>resource.dispose(),[resource]);return resource.material; }
