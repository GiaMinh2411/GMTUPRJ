import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CircleDot, RotateCcw, X, Move, Rotate3D } from 'lucide-react';
import { beadProgress } from './rosary-progress';
import { dragSample, type DragCount } from './rosary-gesture';
import { RosaryObject, type RosaryMotion } from './rosary-object';
type Session=DragCount&{id:number;x:number;y:number;moved:boolean};
export function RosaryPanel({total,sound,haptic,paused,low,onSound,onHaptic,onDelta,onReset,onClose}:{total:number;sound:boolean;haptic:boolean;paused:boolean;low:boolean;onSound:(v:boolean)=>void;onHaptic:(v:boolean)=>void;onDelta:(n:number)=>void;onReset:()=>void;onClose:()=>void}) {
 const [confirm,setConfirm]=useState(false),[view,setView]=useState(false),[loading,setLoading]=useState(true);
 const motion=useRef<RosaryMotion>({total,fraction:0,dragging:false,yaw:0,pitch:0,view:false});motion.current.total=total;motion.current.view=view;
 const drag=useRef<Session|null>(null),surface=useRef<HTMLDivElement>(null);const {current,rounds}=beadProgress(total);
 function finish(){drag.current=null;motion.current.dragging=false;motion.current.fraction=0;}
 useEffect(()=>{if(paused||confirm)finish();},[paused,confirm]);
 useEffect(()=>{const clear=()=>finish();window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.code!=='Space'||paused||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;const button=(e.target as HTMLElement).closest('button');if(button&&!button.matches('.bead-step'))return;e.preventDefault();if(!e.repeat&&!confirm&&!drag.current)onDelta(1);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[paused,confirm,onDelta]);
 function polar(x:number,y:number){const r=surface.current!.getBoundingClientRect(),scale=Math.min(r.width/3.8,r.height/4.4),nx=(x-r.left-r.width/2)/(1.6*scale),ny=(y-r.top-r.height/2+.2*scale)/(1.78*scale);return {angle:Math.atan2(nx,ny),radius:Math.hypot(nx,ny)};}
 return <aside className="rosary-panel" aria-label="Bảng tràng hạt" onKeyDownCapture={e=>{if(e.key==='Enter'&&e.repeat)e.preventDefault();}}>
 <div className="panel-heading"><h2><CircleDot size={19}/> Tràng hạt</h2><button aria-label="Đóng tràng hạt" onClick={onClose}><X size={20}/></button></div>
 <div className="bead-mode" role="group" aria-label="Chế độ tràng hạt"><button aria-pressed={!view} onClick={()=>{finish();setView(false);}}><Move size={14}/> Lần hạt</button><button aria-pressed={view} onClick={()=>{finish();setView(true);}}><Rotate3D size={14}/> Xoay góc nhìn</button></div>
 <div ref={surface} className="bead-viewport" role="application" aria-label={view?'Kéo để xoay góc nhìn tràng hạt':'Kéo dọc vòng để lần hạt, kéo ngược để lùi'} data-mode={view?'view':'count'}
 onPointerDown={e=>{if(paused||confirm||e.button!==0||drag.current)return;const p=polar(e.clientX,e.clientY);if(!view&&(p.radius<.72||p.radius>1.25))return;e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,base:total,counted:total,distance:0,lastAngle:p.angle,x:e.clientX,y:e.clientY,moved:false};motion.current.dragging=true;}}
 onPointerMove={e=>{const s=drag.current;if(!s||s.id!==e.pointerId||paused)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(view){motion.current.yaw+=dx*.008;motion.current.pitch=Math.max(-.8,Math.min(.8,motion.current.pitch+dy*.008));s.x=e.clientX;s.y=e.clientY;return;}if(!s.moved&&Math.hypot(dx,dy)<4)return;s.moved=true;const p=polar(e.clientX,e.clientY);if(p.radius<.55||p.radius>1.5){s.lastAngle=p.angle;return;}const result=dragSample(s,p.angle);motion.current.fraction=result.fraction;if(result.delta){motion.current.total=result.total;onDelta(result.delta);}}}
 onPointerUp={e=>{if(drag.current?.id===e.pointerId){finish();e.currentTarget.releasePointerCapture(e.pointerId);}}} onPointerCancel={finish} onLostPointerCapture={finish} tabIndex={-1}>
 <Canvas orthographic dpr={low?1:[1,1.5]} shadows={!low} camera={{position:[0,0,8],zoom:75,near:.1,far:30}} gl={{antialias:!low}} onCreated={()=>setLoading(false)}><RosaryObject motion={motion} low={low}/></Canvas>{loading&&<span className="bead-loading">Đang dựng tràng hạt…</span>}<span className="bead-instruction">{view?'Kéo để nhìn · Không thay đổi số hạt':'Kéo dọc vòng · Kéo ngược để lùi'}</span></div>
 <div className="bead-stats" aria-live="polite"><p data-testid="bead-progress"><span>Vòng hiện tại</span><strong>{current}/108</strong></p><p><span>Vòng hoàn thành</span><strong data-testid="bead-rounds">{rounds}</strong></p><p><span>Tổng số hạt</span><strong data-testid="bead-total">{total}</strong></p></div>
 <button className="primary bead-step" autoFocus aria-label="Lần một hạt" disabled={confirm||paused} onClick={()=>{finish();onDelta(1);}}>Lần một hạt <kbd aria-hidden="true">Space</kbd></button>
 <div className="bead-options"><label><input type="checkbox" checked={sound} onChange={e=>onSound(e.target.checked)}/> Tiếng hạt</label><label><input type="checkbox" checked={haptic} onChange={e=>onHaptic(e.target.checked)}/> Rung nhẹ</label><button onClick={()=>{finish();setConfirm(true);}}><RotateCcw size={14}/> Đặt lại</button></div>
 {confirm&&<div className="bead-confirm" role="alertdialog" aria-label="Xác nhận đặt lại tràng hạt"><p>Xóa toàn bộ số hạt và số vòng đã lưu?</p><div><button autoFocus onClick={()=>setConfirm(false)}>Giữ tiến trình</button><button onClick={()=>{finish();onReset();setConfirm(false);}} className="reset-confirm">Xác nhận đặt lại</button></div></div>}
 <small>108 hạt đếm · Hạt chủ và tua dây không tính lượt. Lưu riêng trên trình duyệt.</small></aside>;
}
