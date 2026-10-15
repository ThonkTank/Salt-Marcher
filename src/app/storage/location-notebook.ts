import type {LocationMaterialsQuery,LocationMaterialsPage} from '../location-notebook-contracts';
import {calendarDate} from '../world-model';
import {readWorldCalendar} from './world';
import {readWorldSources} from './world-sources';
import {readClockEvent} from './time-plan';
import {deskContent} from './scene-desk';
import {readNarrative} from './narrative';
import {readPreparedGroup} from './session';
import {readShop} from './items';
import {readNpc} from './npcs';
const npcAt=`(p.location_id=@location OR p.actor_id IS NULL AND EXISTS(SELECT 1 FROM prepared_group g,json_each(g.payload,'$.actors') a WHERE g.campaign_id=n.campaign_id AND g.location_id=@location AND json_extract(a.value,'$.id')=n.id))`;
function locationContent(db:any,cam:string,id:string){const content=deskContent(db,cam,{kind:'location',id});if(content.unavailable)throw new Error('Ort im Papierkorb. Material bleibt erhalten.');if(content.location?.id!==id)throw new Error('Ortsmaterialquelle beschädigt.');return content;}
function npcAtLocation(db:any,cam:string,id:string,locationId:string){
 const position=db.prepare('SELECT location_id FROM npc_position WHERE campaign_id=? AND actor_id=?').get(cam,id);if(position)return position.location_id===locationId;
 for(const row of db.prepare("SELECT id FROM prepared_group WHERE campaign_id=? AND location_id=? AND CASE WHEN json_valid(payload) THEN EXISTS(SELECT 1 FROM json_each(payload,'$.actors') a WHERE json_extract(a.value,'$.id')=?) ELSE 0 END").iterate(cam,locationId,id)){const group=readPreparedGroup(db,cam,row.id);if(group.id!==row.id||group.locationId!==locationId)throw new Error('Ortsmaterialquelle beschädigt.');if(group.actors.some(actor=>actor.id===id))return true;}
 return false;
}
export function readLocationMaterials(db:any,cam:string,q:LocationMaterialsQuery):LocationMaterialsPage{
 if(!q||q.scope!==undefined&&!['location','campaign'].includes(q.scope)||q.scope==='campaign'&&!['npc','narrative','shop','group'].includes(q.kind)||!['directory','npc','narrative','group','shop','faction','event'].includes(q.kind)||typeof q.text!=='string'||q.text.length>1000||!Number.isSafeInteger(q.offset)||q.offset<0||q.offset>1000000||q.kind!=='directory'&&(typeof q.locationId!=='string'||!q.locationId||q.locationId.length>1000))throw new Error('Ortsmaterialsuche prüfen.');
 const location=q.kind==='directory'?null:locationContent(db,cam,q.locationId!);
 const all=q.scope==='campaign';
 const placeName=(id:string|null|undefined)=>id?deskContent(db,cam,{kind:'location',id}).title:'Ohne Ortsbindung';
 const where="instr(lower(title||char(10)||detail),lower(@text))>0";
 const queries={
 faction:`SELECT n.id,json_extract(n.payload,'$.title') title,'Fraktion am Ort' detail FROM world_note n WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='faction' AND EXISTS(SELECT 1 FROM world_source s,json_each(s.payload,'$.factionIds') f WHERE s.campaign_id=n.campaign_id AND s.kind='location' AND s.id=@location AND f.value=n.id)`,
 event:`SELECT id,json_extract(payload,'$.name') title,CASE WHEN json_extract(payload,'$.repeatMs') IS NULL THEN 'Einmaliges Ereignis' ELSE 'Wiederkehrendes Ereignis' END detail,json_extract(payload,'$.startMs') startMs FROM world_record WHERE campaign_id=@cam AND kind='calendar-event' AND json_extract(payload,'$.trashed')=0 AND json_extract(payload,'$.locationId')=@location`,
 directory:`SELECT id,json_extract(payload,'$.name') title,CASE json_extract(payload,'$.type') WHEN 'city' THEN 'Stadt' ELSE 'Interessanter Ort' END detail FROM location WHERE campaign_id=@cam AND trashed=0`,
 npc:`SELECT n.id,json_extract(n.payload,'$.title') title,'NSC am Ort' detail FROM world_note n LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND (@all=1 OR ${npcAt})`,
 narrative:`SELECT n.id,json_extract(n.payload,'$.title') title,CASE json_extract(s.payload,'$.status') WHEN 'closed' THEN 'Abgeschlossen' ELSE 'Offen' END detail FROM world_note n LEFT JOIN narrative_state s ON n.campaign_id=s.campaign_id AND n.id=s.note_id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind') IN ('quest','rumor') AND (@all=1 OR json_extract(s.payload,'$.locationId')=@location)`,
 group:`SELECT id,json_extract(payload,'$.title') title,json_array_length(payload,'$.actors')||' Figuren' detail FROM prepared_group WHERE campaign_id=@cam AND (@all=1 OR location_id=@location)`,
 shop:`SELECT s.id,json_extract(s.payload,'$.name') title,'Shop · '||COALESCE(json_extract(n.payload,'$.title'),'Ort') detail FROM shop s LEFT JOIN world_note n ON n.campaign_id=s.campaign_id AND n.id=json_extract(s.payload,'$.owner.id') LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE s.campaign_id=@cam AND json_extract(s.payload,'$.trashed')=0 AND (@all=1 OR json_extract(s.payload,'$.owner.kind')='location' AND json_extract(s.payload,'$.owner.id')=@location OR json_extract(s.payload,'$.owner.kind')='npc' AND n.trashed=0 AND ${npcAt})`
 };
 const rows=db.prepare('SELECT * FROM ('+queries[q.kind]+') WHERE '+where+' ORDER BY title COLLATE NOCASE,id LIMIT 41 OFFSET @offset').all({cam,location:q.locationId,text:q.text,offset:q.offset,all:all?1:0});
 const factionSource=q.kind==='faction'?readWorldSources(db,cam).sources.find(entry=>entry.kind==='location'&&entry.id===q.locationId):null,calendar=q.kind==='event'?readWorldCalendar(db,cam):null;
 const item=(r:any)=>{
  if(q.kind==='directory'){const content=locationContent(db,cam,r.id);return{id:r.id,title:content.title,detail:content.location!.type==='city'?'Stadt':'Interessanter Ort',ref:{kind:'location' as const,id:r.id}};}
  if(q.kind==='npc'){const content=deskContent(db,cam,{kind:'note',id:r.id});if(content.unavailable||content.note?.kind!=='npc'||content.note.id!==r.id||!all&&!npcAtLocation(db,cam,r.id,q.locationId!))throw new Error('Ortsmaterialquelle beschädigt.');const npc=all?readNpc(db,cam,r.id):null;return{id:r.id,title:content.title,detail:all?'NSC · '+placeName(npc?.locationId):'NSC am Ort',...(all?{locationId:npc?.locationId??null}:{}),ref:{kind:'note' as const,id:r.id}};}
  if(q.kind==='narrative'){const content=deskContent(db,cam,{kind:'note',id:r.id}),view=readNarrative(db,cam,r.id);if(content.unavailable||!['quest','rumor'].includes(content.note?.kind??'')||content.note?.id!==r.id||view.state.noteId!==r.id||!all&&view.state.locationId!==q.locationId)throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:content.title,detail:(view.state.status==='closed'?'Abgeschlossen':'Offen')+(all?' · '+placeName(view.state.locationId):''),locationId:view.state.locationId??null,ref:{kind:'note' as const,id:r.id}};}
  if(q.kind==='group'){const group=readPreparedGroup(db,cam,r.id);if(group.id!==r.id||!all&&group.locationId!==q.locationId)throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:group.title,detail:group.actors.length+' Figuren'+(all?' · '+placeName(group.locationId):''),locationId:group.locationId};}
  if(q.kind==='shop'){const view=readShop(db,cam,r.id),shop=view.shop;if(shop.id!==r.id||!all&&(view.unavailable||(shop.owner.kind==='location'?shop.owner.id!==q.locationId:!npcAtLocation(db,cam,shop.owner.id,q.locationId!))))throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:shop.name,detail:'Shop · '+(shop.owner.kind==='npc'?'NSC: ':'Ort: ')+view.ownerName,locationId:shop.owner.kind==='location'?shop.owner.id:null};}
  if(q.kind==='faction'){const content=deskContent(db,cam,{kind:'note',id:r.id});if(content.unavailable||content.note?.kind!=='faction'||content.note.id!==r.id||!factionSource?.factionIds.includes(r.id))throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:content.title,detail:'Fraktion am Ort',ref:{kind:'note' as const,id:r.id}};}
  const event=readClockEvent(db,cam,r.id);if(event.locationId!==q.locationId)throw new Error('Ortsmaterialquelle beschädigt.');return{id:event.id,title:event.name,detail:(event.repeatMs===null?'Einmaliges Ereignis':'Wiederkehrendes Ereignis')+' · Ab '+calendarDate(calendar!,event.startMs)};
 };
 return{locationRevision:location?.revision??null,next:rows.length>40?q.offset+40:null,items:rows.slice(0,40).map(item)};
}
