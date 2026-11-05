import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
export function useLabelOccluders(version:string){const scene=useThree(state=>state.scene),[objects,setObjects]=useState<React.RefObject<THREE.Object3D>[]>([]);useEffect(()=>{const refs:React.RefObject<THREE.Object3D>[]=[];scene.traverse(object=>{if(object.userData.cameraCollider)refs.push({current:object});});setObjects(refs);},[scene,version]);return objects;}
