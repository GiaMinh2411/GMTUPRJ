import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BeadCurve, beadPoint, hollowBeadGeometry, physicalPhase, SLOT_ANGLE } from './bead-geometry';
import { useSurface } from './materials';
export type RosaryMotion = { total:number; fraction:number; dragging:boolean; yaw:number; pitch:number; view:boolean };
export function RosaryObject({motion,low=false}:{motion:React.RefObject<RosaryMotion>;low?:boolean}) {
 const beads=useRef<THREE.InstancedMesh>(null),master=useRef<THREE.Group>(null),root=useRef<THREE.Group>(null),phase=useRef(physicalPhase(motion.current.total)%109);
 const material=useSurface('wood','#68452e',low?128:256),geometry=useMemo(()=>hollowBeadGeometry(low?12:20),[low]);
 const cord=useMemo(()=>new THREE.TubeGeometry(new BeadCurve(),160,.008,6,true),[]);
 const {camera,size}=useThree();
 useEffect(()=>{const cam=camera as THREE.OrthographicCamera;cam.zoom=Math.min(size.width/3.8,size.height/4.4);cam.updateProjectionMatrix();},[camera,size]);
 useEffect(()=>()=>{geometry.dispose();cord.dispose();},[geometry,cord]);
 const object=useMemo(()=>new THREE.Object3D(),[]),up=useMemo(()=>new THREE.Vector3(0,1,0),[]),p=useMemo(()=>new THREE.Vector3(),[]),tangent=useMemo(()=>new THREE.Vector3(),[]);
 useFrame((_,delta)=>{
  const m=motion.current,total=m.total,base=physicalPhase(total),next=physicalPhase(Math.max(0,total+(m.fraction<0?-1:1)));
  const desired=(base+Math.abs(m.fraction)*(next-base))%109;
  const difference=THREE.MathUtils.euclideanModulo(desired-phase.current+54.5,109)-54.5;
  phase.current+=difference*(m.dragging?1:1-Math.exp(-Math.max(0,delta)*16));phase.current=THREE.MathUtils.euclideanModulo(phase.current,109);
  for(let i=0;i<108;i++) {
   const angle=(i+1-phase.current)*SLOT_ANGLE;beadPoint(angle,p);beadPoint(angle+.003,tangent).sub(p).normalize();object.position.copy(p);object.quaternion.setFromUnitVectors(up,tangent);object.scale.setScalar(.045);object.updateMatrix();beads.current!.setMatrixAt(i,object.matrix);
  }
  beads.current!.instanceMatrix.needsUpdate=true;
  beadPoint(-phase.current*SLOT_ANGLE,p);if(master.current){master.current.position.copy(p);master.current.rotation.z=Math.sin(phase.current*.07)*.04;}
  if(root.current){root.current.rotation.y=m.view?m.yaw:0;root.current.rotation.x=m.view?m.pitch:0;}
 });
 return <><color attach="background" args={['#e7e0d2']}/><ambientLight intensity={1.2}/><hemisphereLight args={['#fff5df','#756b5b',1.2]}/><directionalLight position={[-3,4,6]} intensity={3} castShadow={!low} shadow-mapSize={[1024,1024]} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3}/>
 <mesh position={[0,0,-.16]} receiveShadow><planeGeometry args={[20,20]}/><meshStandardMaterial color="#e7e0d2" roughness={1}/></mesh>
 <group ref={root} position={[0,.2,0]}><mesh geometry={cord}><meshStandardMaterial color="#ad8b56" roughness={1}/></mesh><instancedMesh ref={beads} args={[geometry,material,108]} castShadow dispose={null}/>
 <group ref={master}><mesh geometry={geometry} material={material} scale={.068} castShadow dispose={null}/><mesh position={[0,-.09,0]}><torusGeometry args={[.035,.009,6,16]}/><meshStandardMaterial color="#9d7b44" metalness={.7} roughness={.6}/></mesh>{Array.from({length:16},(_,i)=><mesh key={i} position={[(i%4-1.5)*.013,-.32,(Math.floor(i/4)-1.5)*.012]} rotation={[0,0,(i%4-1.5)*.035]}><cylinderGeometry args={[.004,.003,.4,4]}/><meshStandardMaterial color={i%2?'#70533a':'#a17e4f'} roughness={1}/></mesh>)}</group></group>
 {!motion.current.view&&<mesh position={[0,-1.71,.06]} rotation={[0,0,Math.PI]}><torusGeometry args={[.08,.008,6,18,Math.PI]}/><meshStandardMaterial color="#a38349" metalness={.5} roughness={.5}/></mesh>}</>;
}
