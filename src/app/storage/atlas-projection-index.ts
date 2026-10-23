import Database from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,rm,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import {AtlasTileCache} from './atlas-tile-cache';

// Bump when metadata columns, bounds, validation or derivation semantics change.
const FORMAT=1,APPLICATION=0x534d5049,LIMIT=96*1024*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ownedTables=/\btemp\.(?=(?:region_|landscape_))/g;
type Part='geometry'|'geometry-core'|'landscape';
const version=(part:Part,source:AtlasRegionSource)=>part==='landscape'?source.shapeVersion:source.geometryVersion;
export const projectionKey=(filename:string,campaignId:string)=>createHash('sha256').update(JSON.stringify([filename,campaignId])).digest('hex');
export const PROJECTION_CACHE_KEY='projection-index',PROJECTION_CACHE_SOURCE='projection-sqlite-v1';

/** Source stays readonly. Only this worker's private, disposable index is writable.
 * Sync reads canonical values from the pinned source snapshot, commits the index,
 * then query readers pin the attached index snapshot. Other workers own other files. */
export class AtlasProjectionIndex {
 private statements=new Map<string,any>();
 private generation=0;
 private published=0;
 private scheduledGeneration=0;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private saving:Promise<boolean>|undefined;
 private closed=false;
 private separate:boolean;
 private ownsTransaction=false;
 readonly persistent:boolean;
 private constructor(readonly source:any,readonly writer:any,readonly workingDirectory?:string,private cache?:AtlasTileCache){
  if(!source.readonly)throw Error('Atlasprojektion benötigt eine readonly Datenbank.');
  source.pragma('cache_size = -8192');source.pragma('temp_store = FILE');source.pragma('temp.cache_size = -8192');
  this.separate=source!==writer;this.persistent=!!cache?.enabled;
  if(this.persistent)this.writer.exec('CREATE '+(this.separate?'':'TEMP ')+'TABLE IF NOT EXISTS projection_meta(part TEXT PRIMARY KEY,source TEXT NOT NULL) WITHOUT ROWID');
 }
 static temporary(source:any){return new AtlasProjectionIndex(source,source);}
 static async open(source:any,snapshot:AtlasRegionSource,directory?:string,workId=randomUUID()):Promise<AtlasProjectionIndex>{
  if(!directory||snapshot.shadow||!snapshot.shapeVersion)return this.temporary(source);
  if(!uuid.test(workId))throw Error('Ungültige Index-Arbeitskennung.');
  const key=projectionKey(snapshot.filename,snapshot.campaignId),working=join(directory,key+'.work-'+workId),file=join(working,'index.sqlite');
  let owned=false,loaded=false,writer:any,cache:AtlasTileCache|undefined;
  try{
   await mkdir(directory,{recursive:true});await mkdir(working);owned=true;
   cache=AtlasTileCache.open(directory,key);
   try{
    if(!cache.getFile(PROJECTION_CACHE_KEY,PROJECTION_CACHE_SOURCE,file))throw Error('Projektionscache fehlt.');
    const checked=new Database(file,{readonly:true});
    try{
     if(checked.pragma('application_id',{simple:true})!==APPLICATION||checked.pragma('user_version',{simple:true})!==FORMAT)throw Error('Cacheformat passt nicht.');
     if((await stat(file)).size!==checked.pragma('page_size',{simple:true})*checked.pragma('page_count',{simple:true}))throw Error('Cachedatei ist unvollständig.');
     if(!checked.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='projection_meta'").get())throw Error('Cachemarkierung fehlt.');
     if(!checked.prepare('SELECT 1 FROM projection_meta WHERE source IN (?,?) LIMIT 1').get(snapshot.shapeVersion,snapshot.geometryVersion??''))throw Error('Cachequelle überholt.');
    }finally{checked.close();}
    loaded=true;
   }catch{await rm(file,{force:true});}
   // Cold construction keeps SQLite's fast INSERT SELECT path. Its TEMP
   // snapshot is published through the same backup/lifecycle below.
   if(!loaded)return new AtlasProjectionIndex(source,source,working,cache);
   writer=new Database(file);
   writer.pragma('journal_mode = WAL');writer.pragma('cache_size = -8192');
   writer.pragma('application_id = '+APPLICATION);writer.pragma('user_version = '+FORMAT);
   const index=new AtlasProjectionIndex(source,writer,working,cache);
   source.prepare('ATTACH DATABASE ? AS atlas_index').run(file);
   return index;
  }catch{
   writer?.close();cache?.close();if(owned)await rm(working,{recursive:true,force:true}).catch(()=>{});
   return this.temporary(source);
  }
 }
 readSql(sql:string){return this.separate?sql.replace(ownedTables,'atlas_index.'):sql;}
 private writeSql(sql:string){return this.separate?sql.replace(ownedTables,'main.'):sql;}
 prepare(sql:string){
  const text=this.writeSql(sql);let statement=this.statements.get(text);
  if(!statement){statement=this.writer.prepare(text);this.statements.set(text,statement);}return statement;
 }
 exec(sql:string){this.writer.exec(this.writeSql(sql));}
 init(sql:string){
  let text=sql;
  if(this.separate){
   text=text.replace(/CREATE TEMP (TABLE|TRIGGER) /g,'CREATE $1 ');
   text=text.replace(/CREATE ((?:TEMP )?(?:VIRTUAL TABLE|TABLE|INDEX|TRIGGER)) (?!IF NOT EXISTS)/g,'CREATE $1 IF NOT EXISTS ');
  }
  const schema=this.separate?'main':'temp',before=this.writer.pragma(schema+'.schema_version',{simple:true});
  this.exec(text);
  const changed=before!==this.writer.pragma(schema+'.schema_version',{simple:true});
  if(changed&&this.persistent)this.generation++;return changed;
 }
 /** Transfer derived metadata without materializing an entire source table.
  * TEMP can copy within SQLite; a private file streams through two connections.
  * Canonical rowids must be selected as text to preserve all 64 bits in JS. */
 copy(table:'landscape_shape_bounds'|'region_hidden',columns:number,select:string,args:unknown[]){
  const insert='INSERT INTO temp.'+table;
  if(!this.separate){this.prepare(insert+' '+select).run(...args);return;}
  const put=this.prepare(insert+' VALUES('+Array(columns).fill('?').join(',')+')');
  for(const row of this.source.prepare(select).raw().iterate(...args))put.run(...row);
 }
 transaction<T extends (...args:any[])=>any>(fn:T){return this.writer.transaction(fn);}
 begin(){
  this.ownsTransaction=this.separate||this.persistent&&!this.writer.inTransaction;
  if(this.ownsTransaction)this.writer.exec(this.separate?'BEGIN IMMEDIATE':'BEGIN');
 }
 commit(){if(this.ownsTransaction){this.writer.exec('COMMIT');this.ownsTransaction=false;}}
 rollback(){if(this.ownsTransaction&&this.writer.inTransaction)this.writer.exec('ROLLBACK');this.ownsTransaction=false;}
 valid(part:Part,source:AtlasRegionSource){
  const stamp=version(part,source);return this.persistent&&!!stamp&&!source.shadow&&this.prepare('SELECT source FROM projection_meta WHERE part=?').get(part)?.source===stamp;
 }
 forget(part:Part){if(this.persistent&&this.prepare('DELETE FROM projection_meta WHERE part=?').run(part).changes)this.generation++;}
 mark(part:Part,source:AtlasRegionSource){
  if(!this.persistent)return;
  const stamp=version(part,source),previous=this.prepare('SELECT source FROM projection_meta WHERE part=?').get(part)?.source;
  if(previous===stamp)return;
  if(stamp&&!source.shadow)this.prepare('INSERT INTO projection_meta VALUES(?,?) ON CONFLICT(part) DO UPDATE SET source=excluded.source').run(part,stamp);
  else this.prepare('DELETE FROM projection_meta WHERE part=?').run(part);
  this.generation++;
 }
 schedule(){
  if(!this.persistent||this.closed||this.generation===this.published)return;
  // Ongoing camera/detail reads must not keep postponing an unchanged snapshot.
  if(this.timer&&this.scheduledGeneration===this.generation)return;
  this.scheduledGeneration=this.generation;
  clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;void this.flush();},250);
 }
 async flush():Promise<boolean>{
  clearTimeout(this.timer);this.timer=undefined;
  if(!this.persistent||this.closed||this.generation===this.published)return true;
  if(this.saving)return this.saving;
  if(this.writer.inTransaction){this.schedule();return false;}
  const generation=this.generation;
  this.saving=this.save().then(ok=>{if(ok)this.published=generation;return ok;}).finally(()=>{
   this.saving=undefined;if(!this.closed&&this.generation!==generation)this.schedule();
  });
  return this.saving;
 }
 private async save(){
  const candidate=join(this.workingDirectory!,'candidate-'+randomUUID()+'.sqlite');
  try{
   // The binding copies bounded page batches between event-loop turns. Only
   // this connection mutates the index, so later committed changes remain coherent.
   const attached=this.separate?'main':'temp',pageSize=this.writer.pragma(attached+'.page_size',{simple:true});
   await this.writer.backup(candidate,{attached,progress:({totalPages}:{totalPages:number})=>{if(totalPages*pageSize>LIMIT||this.closed)throw Error('Index-Snapshot abgebrochen.');return 100;}});
   // The retained payload is self-contained; warm workers extract their own
   // private writable copy before attaching it to the readonly source.
   const snapshot=new Database(candidate);
   try{snapshot.pragma('journal_mode = DELETE');snapshot.pragma('application_id = '+APPLICATION);snapshot.pragma('user_version = '+FORMAT);}finally{snapshot.close();}
   const bytes=(await stat(candidate)).size;if(bytes>LIMIT)throw Error('Indexbudget überschritten.');
   if(this.closed)return false;
   return this.cache!.putFile(PROJECTION_CACHE_KEY,PROJECTION_CACHE_SOURCE,candidate);
  }catch{return false;}
  finally{await rm(candidate,{force:true}).catch(()=>{});}
 }
 async close(){
  this.closed=true;clearTimeout(this.timer);await this.saving;
  this.rollback();
  if(this.separate){if(this.source.open&&!this.source.inTransaction)this.source.exec('DETACH DATABASE atlas_index');
   this.writer.close();
  }
  this.cache?.close();
  if(this.workingDirectory)await rm(this.workingDirectory,{recursive:true,force:true});
 }
}
export async function eraseProjectionWork(directory:string,filename:string,campaignId:string,workId:string){
 if(!uuid.test(workId))throw Error('Ungültige Index-Arbeitskennung.');
 await rm(join(directory,projectionKey(filename,campaignId)+'.work-'+workId),{recursive:true,force:true});
}
export async function eraseAtlasProjection(directory:string,filename:string,campaignId:string){
 const key=projectionKey(filename,campaignId);let names:string[];
 try{names=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 // New tile caches share one SQLite file; campaign erasure removes only its
 // namespace rows under SQLite's writer lock. Legacy shards are retired by
 // the exclusive startup cleanup after no workers can own them.
 AtlasTileCache.eraseNamespace(directory,key);
 for(const name of names)if(name===key+'.json'||name===key+'.jsonl'||name.startsWith(key+'.candidate-')||name.startsWith(key+'.work-')||name.startsWith(key+'.json.candidate-')||new RegExp('^'+key+'\\.[a-f0-9]{64}\\.sqlite$').test(name))await rm(join(directory,name),{recursive:true,force:true});
}
export async function clearProjectionWork(directory:string){
 let names:string[];try{names=await readdir(directory);}catch{return;}
 for(const name of names)if(/^[a-f0-9]{64}\.(?:work-[a-f0-9-]{36}|candidate-[a-f0-9-]{36}\.sqlite|json\.candidate-[a-f0-9-]{36}|jsonl\.candidate-[a-f0-9-]{36})$/.test(name))await rm(join(directory,name),{recursive:true,force:true}).catch(()=>{});
 // Startup runs under the application's single-instance lock, before workers.
 // Retire the former per-campaign snapshots: retaining them alongside the shared
 // cache would bypass its global budget. They rebuild from canonical sources.
 for(const name of names)if(/^[a-f0-9]{64}\.(?:json|jsonl|[a-f0-9]{64}\.sqlite)$/.test(name))await rm(join(directory,name),{force:true}).catch(()=>{});
}
