import type {LocationMaterialsQuery,LocationMaterialsPage} from '../location-notebook-contracts';
import {calendarDate} from '../world-model';
import {readWorldCalendar} from './world';
import {deskContent} from './scene-desk';
const npcAt=`(p.location_id=@location OR p.actor_id IS NULL AND EXISTS(SELECT 1 FROM prepared_group g,json_each(g.payload,'$.actors') a WHERE g.campaign_id=n.campaign_id AND g.location_id=@location AND json_extract(a.value,'$.id')=n.id))`;
export function readLocationMaterials(db:any,cam:string,q:LocationMaterialsQuery):LocationMaterialsPage{
 if(!q||!['directory','npc','narrative','group','shop','faction','event'].includes(q.kind)||typeof q.text!=='string'||q.text.length>1000||!Number.isSafeInteger(q.offset)||q.offset<0||q.offset>1000000||q.kind!=='directory'&&(typeof q.locationId!=='string'||!q.locationId||q.locationId.length>1000))throw new Error('Ortsmaterialsuche prüfen.');
 const location=q.kind==='directory'?null:deskContent(db,cam,{kind:'location',id:q.locationId!});if(location?.unavailable)throw new Error('Ort im Papierkorb. Material bleibt erhalten.');
 const where="instr(lower(title||char(10)||detail),lower(@text))>0";
 const queries={
 faction:`SELECT n.id,json_extract(n.payload,'$.title') title,'Fraktion am Ort' detail FROM world_note n WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='faction' AND EXISTS(SELECT 1 FROM world_source s,json_each(s.payload,'$.factionIds') f WHERE s.campaign_id=n.campaign_id AND s.kind='location' AND s.id=@location AND f.value=n.id)`,
 event:`SELECT id,json_extract(payload,'$.name') title,CASE WHEN json_extract(payload,'$.repeatMs') IS NULL THEN 'Einmaliges Ereignis' ELSE 'Wiederkehrendes Ereignis' END detail,json_extract(payload,'$.startMs') startMs FROM world_record WHERE campaign_id=@cam AND kind='calendar-event' AND json_extract(payload,'$.trashed')=0 AND json_extract(payload,'$.locationId')=@location`,
 directory:`SELECT id,json_extract(payload,'$.name') title,CASE json_extract(payload,'$.type') WHEN 'city' THEN 'Stadt' ELSE 'Interessanter Ort' END detail FROM location WHERE campaign_id=@cam AND trashed=0`,
 npc:`SELECT n.id,json_extract(n.payload,'$.title') title,'NSC am Ort' detail FROM world_note n LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND ${npcAt}`,
 narrative:`SELECT n.id,json_extract(n.payload,'$.title') title,CASE json_extract(s.payload,'$.status') WHEN 'closed' THEN 'Abgeschlossen' ELSE 'Offen' END detail FROM narrative_state s JOIN world_note n ON n.campaign_id=s.campaign_id AND n.id=s.note_id WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(s.payload,'$.locationId')=@location`,
 group:`SELECT id,json_extract(payload,'$.title') title,json_array_length(payload,'$.actors')||' Figuren' detail FROM prepared_group WHERE campaign_id=@cam AND location_id=@location`,
 shop:`SELECT s.id,json_extract(s.payload,'$.name') title,'Shop · '||COALESCE(json_extract(n.payload,'$.title'),'Ort') detail FROM shop s LEFT JOIN world_note n ON n.campaign_id=s.campaign_id AND n.id=json_extract(s.payload,'$.owner.id') LEFT JOIN npc_position p ON p.campaign_id=n.campaign_id AND p.actor_id=n.id WHERE s.campaign_id=@cam AND json_extract(s.payload,'$.trashed')=0 AND (json_extract(s.payload,'$.owner.kind')='location' AND json_extract(s.payload,'$.owner.id')=@location OR json_extract(s.payload,'$.owner.kind')='npc' AND n.trashed=0 AND ${npcAt})`
 };
 const rows=db.prepare('SELECT * FROM ('+queries[q.kind]+') WHERE '+where+' ORDER BY title COLLATE NOCASE,id LIMIT 41 OFFSET @offset').all({cam,location:q.locationId,text:q.text,offset:q.offset});
 const calendar=q.kind==='event'?readWorldCalendar(db,cam):null;
 return{locationRevision:location?.revision??null,next:rows.length>40?q.offset+40:null,items:rows.slice(0,40).map((r:any)=>({id:r.id,title:r.title,detail:r.detail+(calendar?' · Ab '+calendarDate(calendar,r.startMs):''),...(q.kind==='directory'?{ref:{kind:'location',id:r.id}}:q.kind==='npc'||q.kind==='narrative'||q.kind==='faction'?{ref:{kind:'note',id:r.id}}:{})}))};
}
