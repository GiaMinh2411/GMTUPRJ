export const GIA_MINH={name:'Gia Minh',title:'Trụ trì',x:-3.15,z:-9.15,y:.5,radius:.32,talkDistance:2.35} as const;
export type Destination={id:string;label:string;x:number;z:number};
export const destinations={incense:{id:'incense',label:'Lư hương',x:0,z:-5.8},flowers:{id:'flowers',label:'Bàn dâng hoa',x:3.6,z:-5.9},meditate:{id:'meditate',label:'Vườn thiền',x:-8.1,z:6},lantern:{id:'lantern',label:'Bờ hồ sen',x:6,z:6},giaMinh:{id:'giaMinh',label:'Trụ trì Gia Minh',x:-3.15,z:-7.8}} satisfies Record<string,Destination>;
