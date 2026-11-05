import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Avatar } from './human';
import { GIA_MINH } from './npc-data';
import { npcInRange } from './npc-range';
import { useLabelOccluders } from './scene-label';
export function GiaMinh({player,entered,talking,quality,onNear,onTalk}:{player:React.RefObject<THREE.Vector3>;entered:boolean;talking:boolean;quality:string;onNear:(near:boolean)=>void;onTalk:()=>void}){
 const group=useRef<THREE.Group>(null),label=useRef<HTMLDivElement>(null),wasNear=useRef(false),greetUntil=useRef(0),poseRef=useRef('idle');const [pose,setPose]=useState('idle');const occluders=useLabelOccluders(quality);
 useFrame(({clock},delta)=>{const near=entered&&npcInRange(player.current);if(near!==wasNear.current){wasNear.current=near;onNear(near);if(near)greetUntil.current=clock.elapsedTime+1.8;}
  if(group.current){const target=near?THREE.MathUtils.clamp(Math.atan2(player.current.x-GIA_MINH.x,player.current.z-GIA_MINH.z),-1.15,1.15):0;group.current.rotation.y+=Math.atan2(Math.sin(target-group.current.rotation.y),Math.cos(target-group.current.rotation.y))*(1-Math.exp(-Math.max(0,delta)*3));}
  const next=talking?'talk':near&&clock.elapsedTime<greetUntil.current?'prayer':'idle';if(next!==poseRef.current){poseRef.current=next;setPose(next);}
  if(label.current){const distance=Math.hypot(player.current.x-GIA_MINH.x,player.current.z-GIA_MINH.z),visible=entered&&distance<10;label.current.style.opacity=visible?String(1-THREE.MathUtils.smoothstep(distance,5,10)):'0';label.current.style.visibility=visible?'visible':'hidden';label.current.setAttribute('aria-hidden',String(!visible));}
 });
 return <group position={[GIA_MINH.x,GIA_MINH.y,GIA_MINH.z]} name="gia-minh-npc">
 <group ref={group} onClick={event=>{event.stopPropagation();if(event.delta<5&&entered&&npcInRange(player.current))onTalk();}}><Avatar color="#a67e35" skinColor="#cda78c" gender="male" role="abbot" face="happy" pose={pose}/><mesh position={[0,.9,0]}><capsuleGeometry args={[.27,1.05,4,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh></group>
 <Html position={[0,2.05,0]} center occlude={occluders} zIndexRange={[2,0]} style={{pointerEvents:'none'}}><div ref={label} className="npc-name"><strong>Gia Minh</strong><small>Trụ trì</small></div></Html>
 </group>;
}
