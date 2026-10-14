import {createHash} from 'node:crypto';
import type {AgendaQuery,AgendaPage,AgendaItem} from '../agenda-contracts';
import type {CalendarEvent} from '../world-contracts';
import {agendaOccurrence,unitMs} from '../agenda-model';
import {readWorldCalendar} from './world';
import {readLiveScene} from './live';
const compare=(a:AgendaItem,b:AgendaItem)=>BigInt(a.sortMs)<BigInt(b.sortMs)?-1:BigInt(a.sortMs)>BigInt(b.sortMs)?1:a.event.id.localeCompare(b.event.id);
export function readAgenda(db:any,cam:string,q:AgendaQuery):AgendaPage{
 if(!q||typeof q.search!=='string'||q.search.length>1000||!['all','current'].includes(q.location)||q.horizonDays!==null&&(!Number.isSafeInteger(q.horizonDays)||q.horizonDays<1||q.horizonDays>1000000))throw new Error('Agenda-Suche und Zeitraum prüfen.');
 const calendar=readWorldCalendar(db,cam),focus=q.sceneId??db.prepare('SELECT focus_id FROM live_state WHERE campaign_id=?').get(cam)?.focus_id,source=focus?readLiveScene(db,cam,focus):null,scene=source&&!source.retired?{id:source.id,title:source.title,clockRevision:source.clock.revision,instantMs:source.clock.instantMs,locationId:source.locationId,locationTitle:source.locationId?db.prepare("SELECT json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND id=?").get(cam,source.locationId)?.name??'Ort nicht verfügbar':''}:null,instant=scene?.instantMs??'0';
 if(q.after&&(q.after.instantMs!==instant||q.after.calendarRevision!==calendar.revision))throw new Error('Zeit oder Kalender hat sich geändert. Agenda ab der ersten Seite aktualisieren.');
 const limit=q.horizonDays===null?null:BigInt(instant)+BigInt(q.horizonDays)*unitMs(calendar,'day'),items:AgendaItem[]=[],query=q.search.toLocaleLowerCase();let total=0;
 // Keep only one page plus its continuation while reading the existing event records.
 for(const row of db.prepare("SELECT id,revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind='calendar-event' ORDER BY id").iterate(cam)){
  if(createHash('sha256').update(row.payload).digest('hex')!==row.checksum)throw new Error('Kalenderereignis beschädigt.');const event:CalendarEvent=JSON.parse(row.payload);if(event.id!==row.id||event.revision!==row.revision)throw new Error('Kalenderereignis widerspricht seiner Identität.');
  if(event.trashed||q.location==='current'&&event.locationId!==null&&event.locationId!==scene?.locationId)continue;
  const occurrence=agendaOccurrence(event,instant);if(!q.includePast&&occurrence.state==='past'||limit!==null&&occurrence.state==='upcoming'&&BigInt(occurrence.startMs)>limit)continue;
  if(query&&![event.name,event.notes].some(s=>s.toLocaleLowerCase().includes(query)))continue;total++;
  if(q.after&&(BigInt(occurrence.sortMs)<BigInt(q.after.sortMs)||occurrence.sortMs===q.after.sortMs&&event.id.localeCompare(q.after.id)<=0))continue;
  items.push({event,...occurrence,locationTitle:'',locationAvailable:true});items.sort(compare);if(items.length>41)items.pop();
 }
 const next=items.length>40?items[39]!:null;items.splice(40);
 for(const item of items)if(item.event.locationId){const row=db.prepare('SELECT payload,trashed FROM location WHERE campaign_id=? AND id=?').get(cam,item.event.locationId);item.locationTitle=row?JSON.parse(row.payload).name:'Ort nicht verfügbar';item.locationAvailable=!!row&&!row.trashed;}
 return{calendar,scene,items,total,next:next?{sortMs:next.sortMs,id:next.event.id,instantMs:instant,calendarRevision:calendar.revision}:null};
}
