import {createHash} from 'node:crypto';
import type {AgendaQuery,AgendaPage,AgendaItem} from '../agenda-contracts';
import type {CalendarEvent} from '../world-contracts';
import {agendaOccurrence,unitMs} from '../agenda-model';
import {readWorldCalendar} from './world';
import {readLiveScene} from './live';
import {checkedLocationDocument} from '../../features/location/location-schema';
const compare=(a:AgendaItem,b:AgendaItem)=>BigInt(a.sortMs)<BigInt(b.sortMs)?-1:BigInt(a.sortMs)>BigInt(b.sortMs)?1:a.event.id.localeCompare(b.event.id);
function location(db:any,cam:string,id:string){const row=db.prepare('SELECT payload,checksum,trashed FROM location WHERE campaign_id=? AND id=?').get(cam,id);if(!row)return{title:'Ort nicht verfügbar',available:false};if(createHash('sha256').update(row.payload).digest('hex')!==row.checksum)throw new Error('Agenda-Ort ist beschädigt.');return{title:checkedLocationDocument(JSON.parse(row.payload)).name,available:!row.trashed};}
// Payload-based filters must only see verified author data. IDs remain SQL metadata.
export function* calendarEvents(db:any,cam:string,eventId?:string):Generator<CalendarEvent>{
 for(const row of db.prepare("SELECT id,revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND (? IS NULL OR id=?) ORDER BY id").iterate(cam,eventId??null,eventId??null)){
  if(createHash('sha256').update(row.payload).digest('hex')!==row.checksum)throw new Error('Kalenderereignis beschädigt.');
  const event:CalendarEvent=JSON.parse(row.payload);
  if(event.id!==row.id||event.revision!==row.revision)throw new Error('Kalenderereignis widerspricht seiner Identität.');
  yield event;
 }
}
export function readAgenda(db:any,cam:string,q:AgendaQuery):AgendaPage{
 if(!q||[q.locationId,q.eventId].some(id=>id!==undefined&&(typeof id!=='string'||!id||id.length>1000))||q.includeTrash!==undefined&&typeof q.includeTrash!=='boolean'||typeof q.search!=='string'||q.search.length>1000||q.sceneId!==null&&(typeof q.sceneId!=='string'||!q.sceneId||q.sceneId.length>1000)||!['all','current'].includes(q.location)||q.horizonDays!==null&&(!Number.isSafeInteger(q.horizonDays)||q.horizonDays<1||q.horizonDays>1000000)||q.after!==null&&(!q.after||typeof q.after.id!=='string'||!q.after.id||q.after.id.length>1000||typeof q.after.sortMs!=='string'||!/^(0|[1-9]\d*)$/.test(q.after.sortMs)||typeof q.after.instantMs!=='string'||!/^(0|[1-9]\d*)$/.test(q.after.instantMs)||!Number.isSafeInteger(q.after.calendarRevision)||q.after.calendarRevision<0))throw new Error('Agenda-Suche, Zeitraum und Cursor prüfen.');
 const calendar=readWorldCalendar(db,cam),focus=q.sceneId??db.prepare('SELECT focus_id FROM live_state WHERE campaign_id=?').get(cam)?.focus_id,source=focus?readLiveScene(db,cam,focus):null,active=source&&!source.retired?source:null,place=active?.locationId?location(db,cam,active.locationId):null,scene=active?{id:active.id,title:active.title,clockRevision:active.clock.revision,instantMs:active.clock.instantMs,locationId:active.locationId,locationTitle:place?.title??''}:null,instant=scene?.instantMs??'0';
 if(q.after&&(q.after.instantMs!==instant||q.after.calendarRevision!==calendar.revision))throw new Error('Zeit oder Kalender hat sich geändert. Agenda ab der ersten Seite aktualisieren.');
 if(q.locationId&&!location(db,cam,q.locationId).available)throw new Error('Agenda-Ort nicht verfügbar.');
 const limit=q.horizonDays===null?null:BigInt(instant)+BigInt(q.horizonDays)*unitMs(calendar,'day'),items:AgendaItem[]=[],query=q.search.toLocaleLowerCase();let total=0;
 // Keep only one page plus its continuation while reading the existing event records.
 for(const event of calendarEvents(db,cam,q.eventId)){
  if(q.locationId&&event.locationId!==q.locationId)continue;
  if(event.trashed&&!q.includeTrash||q.location==='current'&&event.locationId!==null&&event.locationId!==scene?.locationId)continue;
  const occurrence=agendaOccurrence(event,instant);if(!q.includePast&&occurrence.state==='past'||limit!==null&&occurrence.state==='upcoming'&&BigInt(occurrence.startMs)>limit)continue;
  if(query&&![event.name,event.notes].some(s=>s.toLocaleLowerCase().includes(query)))continue;total++;
  if(q.after&&(BigInt(occurrence.sortMs)<BigInt(q.after.sortMs)||occurrence.sortMs===q.after.sortMs&&event.id.localeCompare(q.after.id)<=0))continue;
  items.push({event,...occurrence,locationTitle:'',locationAvailable:true});items.sort(compare);if(items.length>41)items.pop();
 }
 const next=items.length>40?items[39]!:null;items.splice(40);
 for(const item of items)if(item.event.locationId){const place=location(db,cam,item.event.locationId);item.locationTitle=place.title;item.locationAvailable=place.available;}
 return{calendar,scene,items,total,next:next?{sortMs:next.sortMs,id:next.event.id,instantMs:instant,calendarRevision:calendar.revision}:null};
}
