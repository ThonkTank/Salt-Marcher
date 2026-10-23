import {createHash,randomUUID} from 'node:crypto';
import type {AtlasRegionSource} from '../atlas-region-contracts';

const kind='atlas-shape-source',geometryKind='atlas-geometry-source';
const geometryTables=new Set(['room','drawing_element','city_document','city_unit','dungeon_volume','drawing_hidden','drawing_floor','atlas_binding']);
// The complete input identity fences snapshots; an independent geometry
// counter avoids rebuilding rooms when a large terrain edit overflows the journal.
const tables=[...geometryTables,'atlas_landscape','location','scope'];
const trackingTriggers=(epoch:string)=>tables.flatMap(table=>['INSERT','UPDATE','DELETE'].map(operation=>{
 const name='atlas_shape_source_'+table+'_'+operation.toLowerCase();
 const owner=operation==='UPDATE'?'campaign_id IN (OLD.campaign_id,NEW.campaign_id)':'campaign_id='+ (operation==='DELETE'?'OLD':'NEW')+'.campaign_id';
 const payload=JSON.stringify({epoch}),trackedKinds=geometryTables.has(table)?[kind,geometryKind]:[kind];
 return {name,sql:`CREATE TRIGGER ${name} AFTER ${operation} ON ${table} BEGIN UPDATE world_record SET revision=revision+1,payload='${payload}',checksum='${hash(payload)}' WHERE ${owner} AND kind IN (${trackedKinds.map(k=>"'"+k+"'").join(',')}); END`};
}));
const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function checked(row:any){
 if(!Number.isSafeInteger(row.revision)||row.revision<0||hash(row.payload)!==row.checksum)throw Error('Objektquellenstand ist beschädigt.');
 const value=JSON.parse(row.payload);
 if(typeof value?.epoch!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.epoch))throw Error('Objektquellenstand ist beschädigt.');
 return value.epoch+':'+row.revision;
}
/** Optional metadata in the existing extensible world-record envelope. No geometry,
 * history or rule state lives here. SQL triggers also observe other connections. */
function trackingIntact(db:any){
 const triggers=new Map<string,string>(db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name LIKE 'atlas_shape_source_%'").all().map((r:any)=>[r.name,r.sql]));
 const epoch=triggers.get('atlas_shape_source_room_insert')?.match(/payload='\{"epoch":"([a-f0-9-]{36})"\}'/)?.[1];
 return !!epoch&&trackingTriggers(epoch).every(t=>triggers.get(t.name)===t.sql);
}
export function atlasProjectionSource(db:any,campaignId:string):{shapeVersion?:string;geometryVersion?:string}{
 if(!trackingIntact(db))return {};
 const result:{shapeVersion?:string;geometryVersion?:string}={};
 for(const row of db.prepare('SELECT kind,revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind IN (?,?)').all(campaignId,kind,geometryKind))result[row.kind===kind?'shapeVersion':'geometryVersion']=checked(row);
 return result;
}
/** Must run inside the caller's pinned canonical read snapshot, including when
 * returning a cached display product without opening any projection index. */
export function assertAtlasProjectionSource(db:any,source:Pick<AtlasRegionSource,'campaignId'|'shapeVersion'|'geometryVersion'>){
 const versions=atlasProjectionSource(db,source.campaignId);
 if(source.shapeVersion!==undefined&&source.shapeVersion!==versions.shapeVersion||source.geometryVersion!==undefined&&source.geometryVersion!==versions.geometryVersion)throw Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
}
export function atlasShapeSource(db:any,campaignId:string){return atlasProjectionSource(db,campaignId).shapeVersion;}

export function ensureAtlasShapeSource(db:any,campaignId:string,reset=false){
 const root=db.prepare('SELECT map_id FROM campaign_atlas WHERE campaign_id=?').get(campaignId);
 if(!root)return;
 for(const recordKind of [kind,geometryKind]){
  const old=db.prepare('SELECT * FROM world_record WHERE campaign_id=? AND kind=?').get(campaignId,recordKind);
  if(old&&!reset){checked(old);if(old.id!==root.map_id)throw Error('Objektquellenstand gehört zu einer anderen Karte.');continue;}
  const payload=JSON.stringify({epoch:randomUUID()});
  db.prepare('DELETE FROM world_record WHERE campaign_id=? AND kind=?').run(campaignId,recordKind);
  db.prepare('INSERT INTO world_record VALUES(?,?,?,?,?,?)').run(campaignId,recordKind,root.map_id,0,payload,hash(payload));
 }
}
/** Missing/replaced tracking triggers revoke every previously persisted cache.
 * Trigger installation and epoch replacement are part of the store transaction. */
export function installAtlasShapeSource(db:any){
 const reset=!trackingIntact(db);
 // Rotate the next-write epoch on opening, without invalidating an unchanged
 // index. A restored backup followed by new edits cannot repeat a cached branch's
 // old counter. Constants keep triggers usable from any SQLite connection.
 for(const {name,sql} of trackingTriggers(randomUUID())){
  db.exec('DROP TRIGGER IF EXISTS '+name);db.exec(sql);
 }
 for(const {campaign_id}of db.prepare('SELECT campaign_id FROM campaign_atlas').all())ensureAtlasShapeSource(db,campaign_id,reset);
}
export function validateAtlasShapeSources(db:any){
 for(const row of db.prepare('SELECT * FROM world_record WHERE kind IN (?,?)').iterate(kind,geometryKind)){
  checked(row);
  if(!db.prepare('SELECT 1 FROM campaign_atlas WHERE campaign_id=? AND map_id=?').get(row.campaign_id,row.id))throw Error('Objektquellenstand gehört zu keinem Atlas.');
 }
}
