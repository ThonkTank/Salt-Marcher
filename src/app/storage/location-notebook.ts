import type {LocationMaterial,LocationMaterialsQuery,LocationMaterialsPage} from '../location-notebook-contracts';
import {calendarDate} from '../world-model';
import {calendarEvents} from './agenda';
import {readWorldCalendar} from './world';
import {readWorldSources} from './world-sources';
import {deskContent} from './scene-desk';
import {readNarrative} from './narrative';
import {readPreparedGroup} from './session';
import {readShop} from './items';
const npcAt=`(p.location_id=@location OR p.actor_id IS NULL AND EXISTS(SELECT 1 FROM prepared_group g,json_each(g.payload,'$.actors') a WHERE g.campaign_id=n.campaign_id AND g.location_id=@location AND json_extract(a.value,'$.id')=n.id))`;
function locationContent(db:any,cam:string,id:string){const content=deskContent(db,cam,{kind:'location',id});if(content.unavailable)throw new Error('Ort im Papierkorb. Material bleibt erhalten.');if(content.location?.id!==id)throw new Error('Ortsmaterialquelle beschädigt.');return content;}
function npcAtLocation(db:any,cam:string,id:string,locationId:string){
 const position=db.prepare('SELECT location_id FROM npc_position WHERE campaign_id=? AND actor_id=?').get(cam,id);if(position)return position.location_id===locationId;
 for(const row of db.prepare("SELECT id FROM prepared_group WHERE campaign_id=? AND location_id=? AND CASE WHEN json_valid(payload) THEN EXISTS(SELECT 1 FROM json_each(payload,'$.actors') a WHERE json_extract(a.value,'$.id')=?) ELSE 0 END").iterate(cam,locationId,id)){const group=readPreparedGroup(db,cam,row.id);if(group.id!==row.id||group.locationId!==locationId)throw new Error('Ortsmaterialquelle beschädigt.');if(group.actors.some(actor=>actor.id===id))return true;}
 return false;
}
export function readLocationMaterials(db:any,cam:string,q:LocationMaterialsQuery):LocationMaterialsPage{
 if(!q||!['directory','npc','narrative','group','shop','faction','event'].includes(q.kind)||typeof q.text!=='string'||q.text.length>1000||!Number.isSafeInteger(q.offset)||q.offset<0||q.offset>1000000||q.kind!=='directory'&&(typeof q.locationId!=='string'||!q.locationId||q.locationId.length>1000))throw new Error('Ortsmaterialsuche prüfen.');
 const location=q.kind==='directory'?null:locationContent(db,cam,q.locationId!);
 if(q.kind==='event'){
  const calendar=readWorldCalendar(db,cam),items:LocationMaterial[]=[],text=q.text.toLocaleLowerCase();
  for(const event of calendarEvents(db,cam)){
   if(event.trashed||event.locationId!==q.locationId)continue;
   const detail=(event.repeatMs===null?'Einmaliges Ereignis':'Wiederkehrendes Ereignis')+' · Ab '+calendarDate(calendar,event.startMs);
   if((event.name+'\n'+detail).toLocaleLowerCase().includes(text))items.push({id:event.id,title:event.name,detail});
  }
  items.sort((a,b)=>a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase())||a.id.localeCompare(b.id));
  return{locationRevision:location!.revision,next:items.length>q.offset+40?q.offset+40:null,items:items.slice(q.offset,q.offset+40)};
 }
 const where="instr(lower(title||char(10)||detail),lower(@text))>0";
 const queries={
 faction:`SELECT n.id,json_extract(n.payload,'$.title') title,'Fraktion am Ort' detail FROM world_note n WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='faction' AND EXISTS(SELECT 1 FROM world_source s,json_each(s.payload,'$.factionIds') f WHERE s.campaign_id=n.campaign_id AND s.kind='location' AND s.id=@location AND f.value=n.id)`,
 directory:`SELECT id,json_extract(payload,'$.name') title,CASE json_extract(payload,'$.type') WHEN 'city' THEN 'Stadt' ELSE 'Interessanter Ort' END detail FROM location WHERE campaign_id=@cam AND trashed=0`,
 npc:`SELECT n.id,json_extract(n.payload,'$.title') title,'NSC am Ort' detail FROM world_note n LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND ${npcAt}`,
 narrative:`SELECT n.id,json_extract(n.payload,'$.title') title,CASE json_extract(s.payload,'$.status') WHEN 'closed' THEN 'Abgeschlossen' ELSE 'Offen' END detail FROM narrative_state s JOIN world_note n ON n.campaign_id=s.campaign_id AND n.id=s.note_id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(s.payload,'$.locationId')=@location`,
 group:`SELECT id,json_extract(payload,'$.title') title,json_array_length(payload,'$.actors')||' Figuren' detail FROM prepared_group WHERE campaign_id=@cam AND location_id=@location`,
 shop:`SELECT s.id,json_extract(s.payload,'$.name') title,'Shop · '||COALESCE(json_extract(n.payload,'$.title'),'Ort') detail FROM shop s LEFT JOIN world_note n ON n.campaign_id=s.campaign_id AND n.id=json_extract(s.payload,'$.owner.id') LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE s.campaign_id=@cam AND json_extract(s.payload,'$.trashed')=0 AND (json_extract(s.payload,'$.owner.kind')='location' AND json_extract(s.payload,'$.owner.id')=@location OR json_extract(s.payload,'$.owner.kind')='npc' AND n.trashed=0 AND ${npcAt})`
 };
 const rows=db.prepare('SELECT * FROM ('+queries[q.kind]+') WHERE '+where+' ORDER BY title COLLATE NOCASE,id LIMIT 41 OFFSET @offset').all({cam,location:q.locationId,text:q.text,offset:q.offset});
 const factionSource=q.kind==='faction'?readWorldSources(db,cam).sources.find(entry=>entry.kind==='location'&&entry.id===q.locationId):null;
 const item=(r:any)=>{
  if(q.kind==='directory'){const content=locationContent(db,cam,r.id);return{id:r.id,title:content.title,detail:content.location!.type==='city'?'Stadt':'Interessanter Ort',ref:{kind:'location' as const,id:r.id}};}
  if(q.kind==='npc'){const content=deskContent(db,cam,{kind:'note',id:r.id});if(content.unavailable||content.note?.kind!=='npc'||content.note.id!==r.id||!npcAtLocation(db,cam,r.id,q.locationId!))throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:content.title,detail:'NSC am Ort',ref:{kind:'note' as const,id:r.id}};}
  if(q.kind==='narrative'){const content=deskContent(db,cam,{kind:'note',id:r.id}),view=readNarrative(db,cam,r.id);if(content.unavailable||!['quest','rumor'].includes(content.note?.kind??'')||content.note?.id!==r.id||view.state.noteId!==r.id||view.state.locationId!==q.locationId)throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:content.title,detail:view.state.status==='closed'?'Abgeschlossen':'Offen',ref:{kind:'note' as const,id:r.id}};}
  if(q.kind==='group'){const group=readPreparedGroup(db,cam,r.id);if(group.id!==r.id||group.locationId!==q.locationId)throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:group.title,detail:group.actors.length+' Figuren'};}
  if(q.kind==='faction'){const content=deskContent(db,cam,{kind:'note',id:r.id});if(content.unavailable||content.note?.kind!=='faction'||content.note.id!==r.id||!factionSource?.factionIds.includes(r.id))throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:content.title,detail:r.detail,ref:{kind:'note' as const,id:r.id}};}
  const view=readShop(db,cam,r.id),shop=view.shop;if(shop.id!==r.id||view.unavailable||(shop.owner.kind==='location'?shop.owner.id!==q.locationId:!npcAtLocation(db,cam,shop.owner.id,q.locationId!)))throw new Error('Ortsmaterialquelle beschädigt.');return{id:r.id,title:shop.name,detail:'Shop · '+view.ownerName};
 };
 return{locationRevision:location?.revision??null,next:rows.length>40?q.offset+40:null,items:rows.slice(0,40).map(item)};
}
