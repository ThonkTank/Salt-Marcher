import {createHash,randomUUID} from 'node:crypto';
import type {WorldSource,WorldSources,EncounterTable,GenerationRequest} from '../generation-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function installWorldSources(db:any){db.exec(`CREATE TABLE IF NOT EXISTS world_source(campaign_id TEXT NOT NULL REFERENCES campaign(id),kind TEXT NOT NULL CHECK(kind IN ('faction','location')),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,id)) STRICT;`);}
function checkedSource(value:unknown):WorldSource{
 const s=value as WorldSource,id=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=1000,ids=(v:unknown)=>Array.isArray(v)&&v.length<=1000&&v.every(id)&&new Set(v).size===v.length;
 if(!s||typeof s!=='object'||Array.isArray(s)||!['faction','location'].includes(s.kind)||!id(s.id)||!Number.isSafeInteger(s.revision)||s.revision<0||!ids(s.tableIds)||!ids(s.factionIds)||!Array.isArray(s.stock)||s.stock.length>1000||s.stock.some(e=>!e||typeof e!=='object'||Array.isArray(e)||!id(e.creatureId)||!Number.isSafeInteger(e.limit)||e.limit<0||e.limit>1000000)||new Set(s.stock.map(e=>e.creatureId)).size!==s.stock.length||s.kind==='faction'&&(s.tableIds.length>1||s.factionIds.length>0)||s.kind==='location'&&s.stock.length>0)throw new Error('Weltquelle benötigt eindeutige Verknüpfungen und gültige Bestände.');
 return s;
}
function sourceRow(row:any):WorldSource{
 if(!row||typeof row.payload!=='string'||hash(row.payload)!==row.checksum)throw new Error('Weltquelle beschädigt.');const s=checkedSource(JSON.parse(row.payload));
 if(s.id!==row.id||s.kind!==row.kind||s.revision!==row.revision||s.revision<1)throw new Error('Weltquelle besitzt eine widersprüchliche Identität oder Revision.');return s;
}
function sourceReferences(db:any,cam:string,s:WorldSource){
 const faction=(id:string)=>db.prepare("SELECT 1 FROM world_note WHERE campaign_id=? AND id=? AND json_extract(payload,'$.kind')='faction'").get(cam,id);
 if(!(s.kind==='faction'?faction(s.id):db.prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=?').get(cam,s.id)))throw new Error('Weltquelle besitzt kein Ziel in dieser Kampagne.');
 for(const id of s.factionIds)if(!faction(id))throw new Error('Weltquelle verweist auf eine fehlende Fraktion.');
 let allowed=new Set<string>();
 for(const id of s.tableIds){const row=db.prepare('SELECT * FROM encounter_table WHERE id=? AND (campaign_id IS NULL OR campaign_id=?)').get(id,cam);if(!row||hash(row.payload)!==row.checksum)throw new Error('Encounter-Quelle fehlt oder ist beschädigt.');if(s.kind==='faction')allowed=new Set(JSON.parse(row.payload).entries.map((e:any)=>e.creatureId));}
 if(s.stock.some(e=>!allowed.has(e.creatureId)))throw new Error('Fraktionsbestand enthält Kreaturen außerhalb seiner Haupttabelle.');
}
function records(db:any,cam:string):WorldSource[]{return db.prepare('SELECT * FROM world_source WHERE campaign_id=? ORDER BY kind,id').all(cam).map((row:any)=>{const s=sourceRow(row);sourceReferences(db,cam,s);return s;});}
export function validateWorldSources(db:any){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_source'").get()){if(db.pragma('user_version',{simple:true})>=42)throw new Error('Weltquellenspeicher fehlt.');return;}
 for(const row of db.prepare('SELECT * FROM world_source').iterate()){const s=sourceRow(row);sourceReferences(db,row.campaign_id,s);}
}
export function readWorldSources(db:any,cam:string):WorldSources{
 return{sources:records(db,cam),factions:db.prepare("SELECT id,json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.kind')='faction' ORDER BY name,id").all(cam),locations:db.prepare("SELECT id,json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND trashed=0 ORDER BY name,id").all(cam)};
}
function put(db:any,cam:string,s:WorldSource){checkedSource(s);if(s.revision<1)throw new Error('Ungültige Weltquellenrevision.');const p=JSON.stringify(s);db.prepare('INSERT INTO world_source VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,s.kind,s.id,s.revision,p,hash(p));}
export function saveWorldSource(db:any,cam:string,input:WorldSource,expected:number|null,tables:EncounterTable[]){
 const s=structuredClone(checkedSource(input)),view=readWorldSources(db,cam),old=view.sources.find(x=>x.kind===s.kind&&x.id===s.id);
 if(s.revision!==(old?.revision??0)||(old?.revision??null)!==expected)throw new Error('Weltquelle geändert. Gespeicherten Stand neu öffnen.');
 if(!(s.kind==='faction'?view.factions:view.locations).some(x=>x.id===s.id))throw new Error('Ziel der Weltquelle fehlt oder liegt im Papierkorb.');
 for(const id of s.tableIds)if(!tables.some(t=>t.id===id&&(!t.trashed||old?.tableIds.includes(id))))throw new Error('Quelltabelle fehlt oder liegt im Papierkorb.');
 for(const id of s.factionIds)if(!view.factions.some(f=>f.id===id)&&!old?.factionIds.includes(id))throw new Error('Verknüpfte Fraktion fehlt.');
 const allowed=new Set(tables.find(t=>t.id===s.tableIds[0])?.entries.map(e=>e.creatureId)??[]);
 for(const e of s.stock)if(!allowed.has(e.creatureId)||!Number.isSafeInteger(e.limit)||e.limit<0||e.limit>1000000)throw new Error('Bestand benötigt eine ganze Anzahl 0–1000000 aus der Haupttabelle. Leer bedeutet unbegrenzt.');
 sourceReferences(db,cam,s);s.revision=(old?.revision??0)+1;put(db,cam,s);
 const name=(s.kind==='faction'?view.factions:view.locations).find(x=>x.id===s.id)!.name,payload=JSON.stringify({text:(s.kind==='faction'?'Fraktionsquelle und Bestand aktualisiert: ':'Ortsquellen aktualisiert: ')+name,recordedAt:new Date().toISOString(),facts:{before:old??null,after:s}});db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(cam,randomUUID(),null,payload,hash(payload));
}
/** Table membership owns eligible stock; prune removed entries in the same transaction. */
export function pruneWorldStock(db:any,table:EncounterTable){const allowed=new Set(table.entries.map(e=>e.creatureId));for(const row of db.prepare("SELECT * FROM world_source WHERE kind='faction'").all()){const s=sourceRow(row);if(!s.tableIds.includes(table.id))continue;const stock=s.stock.filter(e=>allowed.has(e.creatureId));if(stock.length!==s.stock.length)put(db,row.campaign_id,{...s,revision:s.revision+1,stock});}}
export function resolveWorldSources(db:any,cam:string,r:Pick<GenerationRequest,'factionIds'|'locationId'|'tableIds'>,tables:EncounterTable[]){
 const factionIds=r.factionIds??[],locationId=r.locationId??null;
 if(!Array.isArray(factionIds)||factionIds.length>1000||new Set(factionIds).size!==factionIds.length||locationId!==null&&typeof locationId!=='string')throw new Error('Ungültige Weltfilter.');
 if(!factionIds.length&&!locationId)return{tableIds:r.tableIds,caps:new Map<string,number>(),basis:null};
 const view=readWorldSources(db,cam);for(const id of factionIds)if(!view.factions.some(f=>f.id===id))throw new Error('Gewählte Fraktion nicht verfügbar.');if(locationId&&!view.locations.some(l=>l.id===locationId))throw new Error('Gewählter Ort nicht verfügbar.');
 const source=(kind:WorldSource['kind'],id:string)=>view.sources.find(s=>s.kind===kind&&s.id===id)??{kind,id,revision:0,tableIds:[],factionIds:[],stock:[]};
 const factionTables=(ids:string[])=>ids.flatMap(id=>source('faction',id).tableIds);
 const location=locationId?source('location',locationId):null,linked=location?.factionIds.filter(id=>view.factions.some(f=>f.id===id))??[];
 let ids=tables.filter(t=>!t.trashed).map(t=>t.id);
 for(const dimension of [r.tableIds.length?r.tableIds:null,factionIds.length?factionTables(factionIds):null,location?[...location.tableIds,...factionTables(linked)]:null])if(dimension)ids=ids.filter(id=>dimension.includes(id));
 if(!ids.length)throw new Error('Keine gemeinsame Encounter-Tabelle für diese Weltfilter. Verknüpfe zuerst die gewünschten Quellen.');
 const capacity=(creatureId:string,owners:string[],direct:string[])=>{
  if(direct.some(id=>ids.includes(id)&&tables.find(t=>t.id===id)?.entries.some(e=>e.creatureId===creatureId)))return Infinity;
  let total=0;for(const id of owners){const f=source('faction',id);if(!f.tableIds.some(tid=>ids.includes(tid)&&tables.find(t=>t.id===tid)?.entries.some(e=>e.creatureId===creatureId)))continue;total+=f.stock.find(e=>e.creatureId===creatureId)?.limit??Infinity;}return total;
 };
 const caps=new Map<string,number>();for(const creatureId of new Set(tables.filter(t=>ids.includes(t.id)).flatMap(t=>t.entries.map(e=>e.creatureId)))){const cap=Math.min(factionIds.length?capacity(creatureId,factionIds,[]):Infinity,location?capacity(creatureId,linked,location.tableIds):Infinity);if(Number.isFinite(cap))caps.set(creatureId,cap);}
 const involved=[...new Set([...factionIds,...linked])].sort().map(id=>source('faction',id));
 return{tableIds:ids,caps,basis:hash(JSON.stringify({location,involved,tableIds:ids,caps:[...caps]}))};
}
