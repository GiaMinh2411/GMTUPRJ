import { MAX_BEADS } from './rosary-progress';
import { SLOT_ANGLE } from './bead-geometry';
export type DragCount = { base:number; counted:number; distance:number; lastAngle:number };
export function dragSample(session:DragCount,angle:number) {
 session.distance-=Math.atan2(Math.sin(angle-session.lastAngle),Math.cos(angle-session.lastAngle));session.lastAngle=angle;
 const units=session.distance/SLOT_ANGLE;
 const total=Math.max(0,Math.min(MAX_BEADS,session.base+Math.trunc(units+Math.sign(units)*1e-8)));
 const delta=total-session.counted;session.counted=total;
 const fraction=total===0&&units<0?0:units-Math.trunc(units);
 return {total,delta,fraction};
}
