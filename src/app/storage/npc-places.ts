import {createHash} from 'node:crypto';
import {validateRoom} from '../contracts';
import type {NpcPlaces,NpcPlaceSite} from '../npc-places-contracts';
import {readNpc} from './npcs';
import {npcPosition} from './npc-world';
import {deskContent} from './scene-desk';
import {readCitySite} from './city';
export function readNpcPlaces(db:any,cam:string,id:string,offset:number):NpcPlaces{
 if(typeof id!=='string'||!id||id.length>1000||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new Error('NSC-Schauplatzsuche prüfen.');
 const npc=readNpc(db,cam,id),pose=npcPosition(db,cam,id).dungeon,sites:NpcPlaceSite[]=[];
 const place=npc.locationId?deskContent(db,cam,{kind:'location',id:npc.locationId}):null;
 if(offset===0&&pose){if(!pose.roomId||!pose.scopeId||!pose.floorId||!Number.isFinite(pose.x+pose.y+pose.z))throw new Error('NSC-Raumposition beschädigt.');const room=db.prepare('SELECT * FROM room WHERE campaign_id=? AND id=?').get(cam,pose.roomId);if(room){if(createHash('sha256').update(room.payload).digest('hex')!==room.checksum)throw new Error('NSC-Raum beschädigt.');const body=JSON.parse(room.payload);validateRoom({name:room.name,...body});}const available=!!room&&room.scope_id===pose.scopeId&&room.floor_id===pose.floorId;sites.push({kind:'dungeon',id:'room:'+pose.roomId,roomId:pose.roomId,scopeId:pose.scopeId,floorId:pose.floorId,title:room?room.number+' · '+room.name:'Raum nicht verfügbar',detail:'Aktueller Dungeonraum · '+pose.x+', '+pose.y+', '+pose.z+' m',available});}
 const limit=40-sites.length,rows=db.prepare(`SELECT id,city_id,role FROM (
 SELECT id,city_id,'home' role,json_extract(payload,'$.name') title FROM city_unit WHERE campaign_id=@cam AND kind='building' AND EXISTS(SELECT 1 FROM json_each(payload,'$.residentIds') WHERE value=@id)
 UNION ALL SELECT id,city_id,'work' role,json_extract(payload,'$.name') title FROM city_unit WHERE campaign_id=@cam AND kind='building' AND EXISTS(SELECT 1 FROM json_each(payload,'$.workerIds') WHERE value=@id)
 ) ORDER BY title COLLATE NOCASE,city_id,id,role LIMIT @count OFFSET @offset`).all({cam,id,count:limit+1,offset});
 for(const row of rows.slice(0,limit)){const {header,unit}=readCitySite(db,cam,row.city_id,row.id),home=row.role==='home',members=home?unit.residentIds:unit.workerIds;if(!members?.includes(id))throw new Error('NSC-Gebäudebindung geändert.');const location=deskContent(db,cam,{kind:'location',id:header.locationId}),named=home?(unit.households??[]).filter(h=>h.memberIds.includes(id)).map(h=>h.name):(unit.jobs??[]).filter(j=>j.workerIds.includes(id)).map(j=>j.name);sites.push({kind:home?'home':'work',id:row.role+':'+header.id+':'+unit.id,cityId:header.id,unitId:unit.id,title:unit.name||'Unbenanntes Haus',detail:(home?'Wohnt hier':'Arbeitet hier')+' · '+header.name+' · '+location.title+(named.length?' · '+named.join(', '):''),available:!location.unavailable});}
 return{npcId:id,name:npc.name,locationTitle:place?.title??'Ohne Ortsbindung',sites,next:rows.length>limit?offset+limit:null};
}
