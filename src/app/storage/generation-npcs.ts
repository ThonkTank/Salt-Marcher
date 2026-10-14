import type {GenerationRequest} from '../generation-contracts';
import {readNpc} from './npcs';
import {searchCreatures,readCreature} from './encounters';
import {readWorldSources} from './world-sources';

/** Named opponents are a finite pool of existing world identities, never a cloning recipe. */
export function generationNpcs(db:any,cam:string,r:GenerationRequest){
 const world=readWorldSources(db,cam),factions=r.factionIds??[],location=r.locationId??null;
 if(!Array.isArray(factions)||factions.length>1000||new Set(factions).size!==factions.length||factions.some(id=>!world.factions.some(f=>f.id===id))||location!==null&&!world.locations.some(l=>l.id===location))throw new Error('NPC-Quellen benötigen verfügbare Orte und Fraktionen.');
 const allowed=new Set<string>();let offset=0;
 do{const page=searchCreatures({...r.filters,text:'',offset,limit:100});for(const c of page.rows)allowed.add(c.id);offset+=100;if(offset>=page.total)break;}while(true);
 const text=(r.filters.text??'').trim().toLocaleLowerCase(),npcs=[];
 for(const row of db.prepare("SELECT n.id FROM world_note n JOIN world_actor a ON a.campaign_id=n.campaign_id AND a.id=n.id WHERE n.campaign_id=? AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' ORDER BY n.id").iterate(cam)){
  const n=readNpc(db,cam,row.id);
  if(!n.creatureId||!allowed.has(n.creatureId)||!n.health||n.health.hp<=0||n.record.lifecycle!=='active'||n.role!=='hostile'||location&&n.locationId!==location||factions.length&&!factions.includes(n.record.factionId??''))continue;
  if(text&&!n.name.toLocaleLowerCase().includes(text)&&!readCreature(n.creatureId).name.toLocaleLowerCase().includes(text))continue;
  npcs.push({id:n.id,name:n.name,creatureId:n.creatureId,noteRevision:n.noteRevision,actorRevision:n.actorRevision,recordRevision:n.record.revision,positionRevision:n.positionRevision,locationId:n.locationId,role:n.role});
 }
 const basis=npcs;
 return{npcs,basis};
}
