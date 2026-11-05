import * as THREE from 'three';
export const PHYSICAL_SLOTS=109;
export const SLOT_ANGLE=Math.PI*2/PHYSICAL_SLOTS;
export function physicalPhase(total:number) { return total<=0?0:total+Math.floor((total-1)/108); }
export function beadPoint(angle:number,target=new THREE.Vector3()) { return target.set(Math.sin(angle)*1.6,-Math.cos(angle)*1.78+.08*Math.sin(angle*2),.07*Math.sin(angle*3)); }
export function hollowBeadGeometry(detail=16) {
 const points:THREE.Vector2[]=[];
 for(let i=0;i<=detail;i++){const theta=Math.PI-.18-i/detail*(Math.PI-.36);points.push(new THREE.Vector2(Math.sin(theta),Math.cos(theta)));}
 points.push(new THREE.Vector2(.179,-Math.cos(.18)));points.push(points[0].clone());
 return new THREE.LatheGeometry(points,detail);
}
export class BeadCurve extends THREE.Curve<THREE.Vector3> { constructor(){super();} getPoint(t:number,target=new THREE.Vector3()){return beadPoint(t*Math.PI*2,target);} }
