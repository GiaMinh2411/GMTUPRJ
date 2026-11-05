import { useEffect, useRef, useState } from 'react';
import { Compass, MessageCircle } from 'lucide-react';
import { dialogueTopics } from './dialogue-data';
import type { Destination } from './npc-data';
export function Dialogue({name,viewed,onViewed,onRoute,onClose}:{name:string;viewed:string[];onViewed:(id:string)=>void;onRoute:(destination:Destination)=>void;onClose:()=>void}){
 const [topic,setTopic]=useState<string>(''),answerRef=useRef<HTMLElement>(null);const answer=dialogueTopics.find(t=>t.id===topic);
 useEffect(()=>{answerRef.current?.scrollIntoView({block:'nearest'});},[topic]);
 return <div className="npc-dialogue">
 <p className="npc-disclaimer">Nhân vật hư cấu · Hội thoại theo kịch bản</p>
 <div className="npc-greeting"><MessageCircle size={20}/><p>Chào {name.trim()||'bạn'}, mời bạn ghé thăm GM TỰ. Bạn muốn tìm hiểu điều gì?</p></div>
 {answer&&<section ref={answerRef} className="npc-answer" aria-live="polite" aria-atomic="true"><h3>{answer.question}</h3><p>{answer.answer}</p>{answer.destinations&&<div className="route-options">{answer.destinations.map(d=><button key={d.id} onClick={()=>onRoute(d)} aria-label={`Chỉ đường tới ${d.label.toLowerCase()}`}><Compass size={16}/>Chỉ đường · {d.label}</button>)}</div>}</section>}
 <div className="dialogue-options">{dialogueTopics.map(t=><button key={t.id} aria-pressed={topic===t.id} onClick={()=>{onViewed(t.id);if(t.id==='bye'){onClose();return;}setTopic(t.id);}}><span>{t.question}</span>{viewed.includes(t.id)&&<small>Đã xem</small>}</button>)}</div>
 </div>;
}
