import {createHash,randomUUID} from 'node:crypto';
import type {WorldSource,WorldSources,EncounterTable,GenerationRequest} from '../generation-contracts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function installWorldSources(db:any){db.exec(`CREATE TABLE IF NOT EXISTS world_source(campaign_id TEXT NOT NULL REFERENCES campaign(id),kind TEXT NOT NULL CHECK(kind IN ('faction','location')),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,kind,id)) STRICT;`);}
function records(db:any,cam:string):WorldSource[]{return db.prepare('SELECT * FROM world_source WHERE campaign_id=? ORDER BY kind,id').all(cam).map((r:any)=>{if(hash(r.payload)!==r.checksum)throw new Error('Weltquelle beschädigt.');return JSON.parse(r.payload);});}
export function readWorldSources(db:any,cam:string):WorldSources{
 return{sources:records(db,cam),factions:db.prepare("SELECT id,json_extract(payload,'$.title') name FROM world_note WHERE campaign_id=? AND trashed=0 AND json_extract(payload,'$.kind')='faction' ORDER BY name,id").all(cam),locations:db.prepare("SELECT id,json_extract(payload,'$.name') name FROM location WHERE campaign_id=? AND trashed=0 ORDER BY name,id").all(cam)};
}
function put(db:any,cam:string,s:WorldSource){const p=JSON.stringify(s);db.prepare('INSERT INTO world_source VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,kind,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,s.kind,s.id,s.revision,p,hash(p));}
export function saveWorldSource(db:any,cam:string,input:WorldSource,expected:number|null,tables:EncounterTable[]){
 const view=readWorldSources(db,cam),s=structuredClone(input),old=view.sources.find(x=>x.kind===s.kind&&x.id===s.id);
 if((old?.revision??null)!==expected)throw new Error('Weltquelle geändert. Gespeicherten Stand neu öffnen.');
 if(!['faction','location'].includes(s.kind)||!(s.kind==='faction'?view.factions:view.locations).some(x=>x.id===s.id)||!Array.isArray(s.tableIds)||!Array.isArray(s.factionIds)||!Array.isArray(s.stock)||s.tableIds.length>1000||s.factionIds.length>1000||s.stock.length>1000||new Set(s.tableIds).size!==s.tableIds.length||new Set(s.factionIds).size!==s.factionIds.length||new Set(s.stock.map(x=>x.creatureId)).size!==s.stock.length)throw new Error('Weltquelle und Verknüpfungen prüfen.');
 if(s.disposition!==undefined&&(!Number.isSafeInteger(s.disposition)||Math.abs(s.disposition)>100))throw new Error('Fraktionshaltung benötigt −100 bis 100.');
 if(s.kind==='faction'&&(s.tableIds.length>1||s.factionIds.length)||s.kind==='location'&&s.stock.length)throw new Error('Fraktionen besitzen eine Haupttabelle; Orte verknüpfen Tabellen und Fraktionen.');
 for(const id of s.tableIds)if(!tables.some(t=>t.id===id&&(!t.trashed||old?.tableIds.includes(id))))throw new Error('Quelltabelle fehlt oder liegt im Papierkorb.');
 for(const id of s.factionIds)if(!view.factions.some(f=>f.id===id))throw new Error('Verknüpfte Fraktion fehlt.');
 const allowed=new Set(tables.find(t=>t.id===s.tableIds[0])?.entries.map(e=>e.creatureId)??[]);
 for(const e of s.stock)if(!allowed.has(e.creatureId)||!Number.isSafeInteger(e.limit)||e.limit<0||e.limit>1000000)throw new Error('Bestand benötigt eine ganze Anzahl 0–1000000 aus der Haupttabelle. Leer bedeutet unbegrenzt.');
 s.revision=(old?.revision??0)+1;put(db,cam,s);
 const name=(s.kind==='faction'?view.factions:view.locations).find(x=>x.id===s.id)!.name,payload=JSON.stringify({text:(s.kind==='faction'?'Fraktionsquelle und Bestand aktualisiert: ':'Ortsquellen aktualisiert: ')+name,recordedAt:new Date().toISOString(),facts:{before:old??null,after:s}});db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(cam,randomUUID(),null,payload,hash(payload));
}
/** Table membership owns eligible stock; prune removed entries in the same transaction. */
export function pruneWorldStock(db:any,table:EncounterTable){const allowed=new Set(table.entries.map(e=>e.creatureId));for(const row of db.prepare("SELECT * FROM world_source WHERE kind='faction'").all()){if(hash(row.payload)!==row.checksum)throw new Error('Weltquelle beschädigt.');const s:WorldSource=JSON.parse(row.payload);if(!s.tableIds.includes(table.id))continue;const stock=s.stock.filter(e=>allowed.has(e.creatureId));if(stock.length!==s.stock.length)put(db,row.campaign_id,{...s,revision:s.revision+1,stock});}}
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
