import { GIA_MINH } from './npc-data';
import { blocks, groundHeight } from './world-data';
export function npcInRange(p:{x:number;z:number}){
 if(Math.hypot(p.x-GIA_MINH.x,p.z-GIA_MINH.z)>GIA_MINH.talkDistance||Math.abs(groundHeight(p.x,p.z)-GIA_MINH.y)>.7)return false;
 for(let i=1;i<20;i++){const t=i/20,x=p.x+(GIA_MINH.x-p.x)*t,z=p.z+(GIA_MINH.z-p.z)*t;if(blocks.slice(0,3).some(w=>Math.abs(x-w.x)<w.w/2&&Math.abs(z-w.z)<w.d/2))return false;}
 return true;
}
