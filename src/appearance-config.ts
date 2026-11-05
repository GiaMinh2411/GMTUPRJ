export const faces=[{id:'happy',label:'Nhẹ nhàng'},{id:'curious',label:'Tập trung'},{id:'smile',label:'An hòa'},{id:'calm',label:'Tĩnh tại'}] as const;
export type Face=typeof faces[number]['id'];
export type Gender='male'|'female';
export type Outfit='lam'|'shirt';
export type Appearance={gender:Gender|null;color:string;style:number;face:Face;glasses:boolean;skinColor:string;hairColor:string;outfit:Outfit};
export const robes=[{color:'#87644d',label:'Nâu'},{color:'#8a9290',label:'Xám'},{color:'#b59a74',label:'Be'},{color:'#9aaeb5',label:'Xanh nhạt'}] as const;
export const skinTones=[{color:'#e2bfa4',label:'Sáng ấm'},{color:'#cda78c',label:'Trung tính'},{color:'#a87958',label:'Nâu ấm'}] as const;
export const hairColors=[{color:'#27241f',label:'Đen tự nhiên'},{color:'#493324',label:'Nâu trầm'},{color:'#655f55',label:'Nâu khói'},{color:'#888780',label:'Bạc'}] as const;
export const hairstyles=[{id:0,label:'Tóc ngắn'},{id:1,label:'Tóc rẽ ngôi'},{id:3,label:'Tóc ngang vai'},{id:4,label:'Tóc dài buộc thấp'},{id:2,label:'Búi gọn'}] as const;
export const modelConfig={male:{height:1.75,scale:1,shoulder:1,hip:1,colliderRadius:.28,cameraHeight:1.35},female:{height:1.67,scale:1.67/1.75,shoulder:.91,hip:1.04,colliderRadius:.27,cameraHeight:1.29}} as const;
export function normalizeAppearance(p:Record<string,unknown>):Appearance{
 const legacyColors=['#698879','#8c7186','#52677d'];
 const gender:Gender|null=p.gender==='female'?'female':p.gender==='male'?'male':null;
 return {gender,color:robes.some(r=>r.color===p.color)||legacyColors.includes(p.color as string)?p.color as string:'#b59a74',style:hairstyles.some(h=>h.id===p.style)?p.style as number:0,face:faces.some(f=>f.id===p.face)?p.face as Face:'happy',glasses:p.glasses===true,skinColor:skinTones.some(s=>s.color===p.skinColor)?p.skinColor as string:'#cda78c',hairColor:hairColors.some(c=>c.color===p.hairColor)?p.hairColor as string:p.style===1?'#655f55':'#27241f',outfit:p.outfit==='shirt'?'shirt':'lam'};
}
