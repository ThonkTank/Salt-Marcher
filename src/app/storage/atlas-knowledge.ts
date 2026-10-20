import {createHash} from 'node:crypto';
import type {AtlasMap,Hex,Terrain} from '../world-contracts';
import {cellAt,terrainNames} from '../world-model';
export interface RememberedHex extends Hex {terrain:Terrain;elevationM?:number;road:boolean;river:boolean;mapRevision?:number}
const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');
export function installAtlasMemory(db:any){db.exec(`CREATE TABLE IF NOT EXISTS player_hex_memory(campaign_id TEXT NOT NULL,character_id TEXT NOT NULL,map_id TEXT NOT NULL,q INTEGER NOT NULL,r INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,character_id,map_id,q,r),FOREIGN KEY(campaign_id,character_id) REFERENCES roster_member(campaign_id,id)) STRICT;`);}
export function checkedMemory(row:any):RememberedHex {
 if(!row||hash(row.payload)!==row.checksum)throw new Error('Erinnerte Landschaftsdaten fehlen oder sind beschädigt.');
 const v=JSON.parse(row.payload);
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['q','r','terrain','road','river','mapRevision','elevationM'].includes(k))||v.q!==row.q||v.r!==row.r||![v.q,v.r].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1e9)||typeof v.terrain!=='string'||!Object.hasOwn(terrainNames,v.terrain)||typeof v.road!=='boolean'||typeof v.river!=='boolean'||v.elevationM!==undefined&&(!Number.isFinite(v.elevationM)||Math.abs(v.elevationM)>1e6)||v.mapRevision!==undefined&&(!Number.isSafeInteger(v.mapRevision)||v.mapRevision<1))throw new Error('Erinnerte Landschaftsdaten sind ungültig.');
 return v;
}
/** Called within the confirming World/GM writer transaction, never on a read or reopen. */
export function rememberAtlasHex(db:any,cam:string,characterId:string,map:AtlasMap,hex:Hex){
 const old=db.prepare('SELECT * FROM player_hex_memory WHERE campaign_id=? AND character_id=? AND map_id=? AND q=? AND r=?').get(cam,characterId,map.id,hex.q,hex.r);
 if(old&&(checkedMemory(old).mapRevision??0)>map.revision)throw new Error('Erinnerte Kartenrevision liegt vor dem verfügbaren Kartenstand.');
 const cell=cellAt(map,hex),payload=JSON.stringify({q:hex.q,r:hex.r,terrain:cell.terrain,elevationM:cell.elevationM,road:cell.road,river:cell.river,mapRevision:map.revision});
 checkedMemory({q:hex.q,r:hex.r,payload,checksum:hash(payload)});
 db.prepare('INSERT OR IGNORE INTO atlas_knowledge VALUES(?,?,?,?,?)').run(cam,characterId,map.id,hex.q,hex.r);
 db.prepare('INSERT INTO player_hex_memory VALUES(?,?,?,?,?,?,?) ON CONFLICT(campaign_id,character_id,map_id,q,r) DO UPDATE SET payload=excluded.payload,checksum=excluded.checksum').run(cam,characterId,map.id,hex.q,hex.r,payload,hash(payload));
}
export function validateAtlasMemory(db:any){
 const maps=new Map<string,number>(),mapRow=db.prepare("SELECT revision FROM world_record WHERE campaign_id=? AND kind='map' AND id=?"),known=db.prepare('SELECT 1 FROM atlas_knowledge WHERE campaign_id=? AND character_id=? AND map_id=? AND q=? AND r=?');
 for(const row of db.prepare('SELECT * FROM player_hex_memory').iterate()){
  const v=checkedMemory(row),key=JSON.stringify([row.campaign_id,row.map_id]);let revision=maps.get(key);
  if(revision===undefined){revision=mapRow.get(row.campaign_id,row.map_id)?.revision;if(revision===undefined)throw new Error('Erinnerte Landschaft besitzt keine Karte.');maps.set(key,revision!);}
  if((v.mapRevision??0)>revision!||!known.get(row.campaign_id,row.character_id,row.map_id,row.q,row.r))throw new Error('Erinnerte Landschaftsbindung ist widersprüchlich.');
 }
}

interface MemoryUnion {best:RememberedHex;legacy:string|null;legacyConflict:boolean;conflict:boolean}
const facts=(value:RememberedHex)=>JSON.stringify([value.terrain,value.road,value.river,value.elevationM??null]);
export function addMemory(union:Map<string,MemoryUnion>,key:string,value:RememberedHex){
 const state=union.get(key);if(!state){union.set(key,{best:value,legacy:value.mapRevision===undefined?facts(value):null,legacyConflict:false,conflict:false});return;}
 if(value.mapRevision===undefined){const signature=facts(value);if(state.legacy!==null&&state.legacy!==signature)state.legacyConflict=true;else state.legacy=signature;return;}
 if(state.best.mapRevision===undefined||value.mapRevision>state.best.mapRevision){state.best=value;state.conflict=false;}
 else if(value.mapRevision===state.best.mapRevision&&facts(value)!==facts(state.best))state.conflict=true;
}
export function unionMemory(state:MemoryUnion):RememberedHex|undefined {
 return state.conflict||state.legacyConflict||state.legacy!==null&&state.legacy!==facts(state.best)?undefined:state.best;
}
