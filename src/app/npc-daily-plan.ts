import type {NpcDailySlot} from './npc-contracts';
export const dailyTime=(minutes:number)=>Math.floor(minutes/60).toString().padStart(2,'0')+':'+(minutes%60).toString().padStart(2,'0');
export function dailyMinute(text:string){if(!/^\d{1,3}:[0-5]\d$/.test(text))throw new Error('Tagesplan: Uhrzeiten als Stunden:Minuten eingeben.');return Number(text.split(':')[0])*60+Number(text.split(':')[1]);}
export interface NpcDailyRaw {id:string;start:string;end:string;activity:string;place:NpcDailySlot['place'];notes:string}
export function rawDailyPlan(plan:NpcDailySlot[]=[]):NpcDailyRaw[]{return plan.map(s=>({id:s.id,start:dailyTime(s.startMinute),end:dailyTime(s.endMinute),activity:s.activity,place:s.place,notes:s.notes}));}
export function parseDailyPlan(text:string):NpcDailySlot[]{const raw:NpcDailyRaw[]=JSON.parse(text||'[]');if(!Array.isArray(raw))throw new Error('Tagesplanentwurf prüfen.');return checkedDailyPlan(raw.map(s=>({id:s.id,startMinute:dailyMinute(s.start),endMinute:dailyMinute(s.end),activity:s.activity,place:s.place,notes:s.notes})));}
export function checkedDailyPlan(value:unknown,daySeconds?:number):NpcDailySlot[]{
 if(!Array.isArray(value)||value.length>48)throw new Error('Tagesplan: höchstens 48 Aktivitäten.');const ids=new Set<string>();
 for(const s of value){if(!s||typeof s.id!=='string'||!s.id||s.id.length>1000||ids.has(s.id)||!Number.isSafeInteger(s.startMinute)||!Number.isSafeInteger(s.endMinute)||s.startMinute<0||s.startMinute>=10080||s.endMinute<0||s.endMinute>10080||s.startMinute===s.endMinute||typeof s.activity!=='string'||!s.activity.trim()||s.activity.length>2000||!['home','work','other'].includes(s.place)||typeof s.notes!=='string'||s.notes.length>20000)throw new Error('Tagesplan: Aktivität, unterschiedliche Uhrzeiten und Ziel prüfen.');ids.add(s.id);}
 if(daySeconds!==undefined){const day=daySeconds/60,ranges:{start:number;end:number}[]=[];for(const s of value){if(s.startMinute>=day||s.endMinute>day)throw new Error('Tagesplan: Uhrzeit liegt außerhalb des Kampagnentags.');if(s.startMinute<s.endMinute)ranges.push({start:s.startMinute,end:s.endMinute});else ranges.push({start:s.startMinute,end:day},{start:0,end:s.endMinute});}const nonempty=ranges.filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start);for(let i=1;i<nonempty.length;i++)if(nonempty[i]!.start<nonempty[i-1]!.end)throw new Error('Tagesplan: Aktivitäten überschneiden sich.');}
 return value as NpcDailySlot[];
}
export function dailyPlanAt(plan:NpcDailySlot[]|undefined,instantMs:string,daySeconds:number){
 const slots=plan??[];try{checkedDailyPlan(slots,daySeconds);}catch(e){return{current:null,next:null,secondsUntilNext:null,problem:(e as Error).message};}
 const dayMs=BigInt(daySeconds)*1000n,second=Number((BigInt(instantMs)%dayMs+dayMs)%dayMs)/1000;
 const current=slots.find(s=>s.startMinute<s.endMinute?second>=s.startMinute*60&&second<s.endMinute*60:second>=s.startMinute*60||second<s.endMinute*60)??null;
 const upcoming=slots.map(slot=>({slot,wait:(slot.startMinute*60-second+daySeconds)%daySeconds||daySeconds})).filter(s=>s.wait>0).sort((a,b)=>a.wait-b.wait)[0];
 return{current,next:upcoming?.slot??null,secondsUntilNext:upcoming?.wait??null,problem:null};
}
