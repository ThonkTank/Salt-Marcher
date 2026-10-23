import Database from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fstatSync,linkSync,lstatSync,mkdirSync,openSync,readdirSync,readSync,statSync,unlinkSync,writeSync} from 'node:fs';
import {join} from 'node:path';
import {deserialize,serialize} from 'node:v8';

const FORMAT=2,APPLICATION=0x534d5443,PAGE_BYTES=4096;
const DEFAULT_NAMESPACE_BUDGET=64*1024*1024,DEFAULT_GLOBAL_BUDGET=96*1024*1024,DEFAULT_ENTRY=8*1024*1024,DEFAULT_PHYSICAL_BUDGET=256*1024*1024;
const FILE_CHUNK_BYTES=1024*1024,FILE_FORMAT=1;
// Disable cache spilling so each writer transaction keeps its original pages in
// one rollback-journal segment until commit. The SQLite journal format stores
// each changed page at most once per journal, with an 8-byte record header;
// reserve 2 MiB beyond two copies of the page limit for record/segment headers,
// sector rounding and SQLite headers. See sqlite.org/fileformat2.html#the_rollback_journal.
// DELETE mode has no WAL/SHM growth. Every connection applies this policy and
// the same persisted page limit before writes.
const JOURNAL_RESERVE=2*1024*1024;
const namespacePattern=/^[a-f0-9]{64}$/;
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
const sameFileStats=(a:ReturnType<typeof fstatSync>,b:ReturnType<typeof fstatSync>)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
type Options={maxBytes?:number;maxEntryBytes?:number;maxGlobalBytes?:number;maxPhysicalBytes?:number};
type Limits={namespaceBytes:number;globalBytes:number;entryBytes:number;maxPages:number};
const sharedRoot=(directory:string)=>join(directory,'tiles-v2');
const sharedFile=(directory:string)=>join(sharedRoot(directory),'atlas-tiles.sqlite');

/** Disposable, bounded cache for derived Atlas tiles. This class never opens a
 * campaign database: every namespace shares tiles-v2/atlas-tiles.sqlite. */
export class AtlasTileCache {
 private db:InstanceType<typeof Database>|null=null;
 private hits=0;private misses=0;private writes=0;private evictions=0;private bytes=0;
 private constructor(db:InstanceType<typeof Database>|null,private readonly namespace:string){this.db=db;}

 static open(directory:string,namespace:string,options:Options={}):AtlasTileCache {
  if(typeof namespace!=='string'||!namespacePattern.test(namespace))throw new Error('Ungültiger Atlas-Kachel-Namensraum.');
  const requested=readLimits(options);
  if(typeof directory!=='string'||!directory)throw new Error('Atlas-Kachelverzeichnis fehlt.');
  const filename=sharedFile(directory),root=sharedRoot(directory);
  let db:InstanceType<typeof Database>|null=null;
  try{
   mkdirSync(root,{recursive:true,mode:0o700});
   const rootInfo=lstatSync(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw Error('Atlas-Kachelverzeichnis ist kein eigener Ordner.');
   try{lstatSync(filename);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;AtlasTileCache.createSharedDatabase(filename,namespace,requested);}
   const before=lstatSync(filename);if(!before.isFile()||before.isSymbolicLink())throw Error('Atlas-Kacheldatei ist keine reguläre Datei.');
   let hotJournal=false;
   for(const suffix of ['-journal','-wal','-shm']){const sidecar=filename+suffix;if(existsSync(sidecar)){const info=lstatSync(sidecar);if(!info.isFile()||info.isSymbolicLink())throw Error('Atlas-Kachelbegleitdatei ist ungültig.');if(suffix==='-journal')hotJournal=true;else throw Error('Unerwartete Atlas-Kachelbegleitdatei.');}}
   const header=readSqliteHeader(filename);
   if(header.application!==APPLICATION||header.version!==FORMAT||header.pageSize!==PAGE_BYTES)throw Error('Atlas-Kacheldatei gehört nicht zum aktuellen Format.');
   if(!hotJournal){
    const check=new Database(filename,{readonly:true,timeout:100});
    try{
     const application=check.pragma('application_id',{simple:true}) as number,version=check.pragma('user_version',{simple:true}) as number;
     if(application!==APPLICATION||version!==FORMAT)throw Error('Atlas-Kacheldatei gehört nicht zum aktuellen Format.');
     const marker=check.prepare('SELECT format FROM atlas_tile_meta WHERE id=1').get() as {format:number}|undefined;
     if(marker?.format!==FORMAT)throw Error('Atlas-Kacheldatei ist nicht markiert.');
    }finally{check.close();}
   }
   db=new Database(filename,{timeout:250});db.pragma('busy_timeout = 250');
   const after=lstatSync(filename);if(after.dev!==before.dev||after.ino!==before.ino)throw Error('Atlas-Kacheldatei wurde während des Öffnens ersetzt.');
   const application=db.pragma('application_id',{simple:true}) as number,version=db.pragma('user_version',{simple:true}) as number;
   if(application!==0&&application!==APPLICATION)throw Error('Atlas-Kacheldatei gehört einer anderen Anwendung.');
   if(application===0&&db.prepare("SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get())throw Error('Unmarkierte Atlas-Kacheldatei ist nicht leer.');
   if(version!==0&&version!==FORMAT)throw Error('Atlas-Kachelformat wird nicht unterstützt.');
   // Ownership and format are verified before settings that can write the file.
   db.pragma('journal_mode = DELETE');db.pragma('synchronous = FULL');db.pragma('cache_spill = OFF');
   const pageLimit=db.pragma('max_page_count = '+requested.maxPages,{simple:true}) as number;
   if(pageLimit>requested.maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');
   const cache=new AtlasTileCache(db,namespace);
   const limits=cache.initialize(requested);
   db.pragma('max_page_count = '+limits.maxPages);
   if((db.pragma('page_count',{simple:true}) as number)>limits.maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');
   cache.bytes=cache.namespaceBytes();
   return cache;
  }catch{
   try{db?.close();}catch{}
   return new AtlasTileCache(null,namespace);
  }
 }

 private static createSharedDatabase(filename:string,namespace:string,limits:Limits){
  const temporary=filename+'.init-'+randomUUID();let db:InstanceType<typeof Database>|null=null;
  const fd=openSync(temporary,'wx',0o600);closeSync(fd);
  try{
   db=new Database(temporary,{timeout:250});db.pragma('page_size = '+PAGE_BYTES);db.pragma('auto_vacuum = INCREMENTAL');
   db.pragma('journal_mode = DELETE');db.pragma('synchronous = FULL');db.pragma('cache_spill = OFF');db.pragma('application_id = '+APPLICATION);
   const pageLimit=db.pragma('max_page_count = '+limits.maxPages,{simple:true}) as number;if(pageLimit>limits.maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');
   const cache=new AtlasTileCache(db,namespace),stored=cache.initialize(limits);db.pragma('max_page_count = '+stored.maxPages);
   if((db.pragma('page_count',{simple:true}) as number)>stored.maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');
   db.close();db=null;
   try{linkSync(temporary,filename);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  }finally{
   try{db?.close();}catch{}
   try{unlinkSync(temporary);}catch{}
  }
 }

 /** Remove only this namespace's rows. Busy, foreign, or invalid shared caches
  * throw so a pending campaign erasure remains pending for startup retry. */
 static eraseNamespace(directory:string,namespace:string):void {
  if(!namespacePattern.test(namespace))throw new Error('Ungültiger Atlas-Kachel-Namensraum.');
  const filename=sharedFile(directory);let present=true;try{lstatSync(filename);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')present=false;else throw error;}
  if(present){
   const cache=AtlasTileCache.open(directory,namespace);
   if(!cache.enabled){cache.close();throw new Error('Atlas-Kachelbestand ist gerade nicht sicher verfügbar.');}
   try{cache.eraseNamespaceRows();}finally{cache.close();}
  }
  eraseLegacyNamespace(directory,namespace);
 }

 get diagnostics(){let bytes=this.bytes;try{if(this.db)bytes=this.namespaceBytes();}catch{}return{hits:this.hits,misses:this.misses,writes:this.writes,evictions:this.evictions,bytes};}
 get enabled(){return this.db!==null;}

 get<T>(key:string,source:string):T|undefined {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048)){this.misses++;return;}
  let row:{blob:Buffer;digest:string;bytes:number}|undefined;
  try{row=db.prepare("SELECT blob,digest,bytes FROM atlas_tile_cache WHERE namespace=? AND key=? AND source=? AND kind='tile'").get(this.namespace,key,source) as typeof row;}
  catch{this.misses++;return;}
  if(!row){this.misses++;return;}
  const blob=Buffer.from(row.blob);
  if(blob.length!==row.bytes||sha(blob)!==row.digest){this.discard(key,source,row.digest,row.bytes);this.misses++;return;}
  let value:T;try{value=deserialize(blob) as T;}catch{this.discard(key,source,row.digest,row.bytes);this.misses++;return;}
  // Recency affects only future eviction. A busy writer must not turn a valid
  // warm tile into a miss and force its caller to recompute it.
  let sourceStillCurrent=true;
  try{
   db.pragma('busy_timeout = 0');
   db.exec('BEGIN IMMEDIATE');
   try{db.prepare('UPDATE atlas_tile_meta SET sequence=sequence+1 WHERE id=1').run();
    const touched=db.prepare("UPDATE atlas_tile_cache SET last_used=(SELECT sequence FROM atlas_tile_meta WHERE id=1) WHERE namespace=? AND key=? AND source=? AND kind='tile'").run(this.namespace,key,source).changes;
    if(!touched){sourceStillCurrent=false;db.exec('ROLLBACK');}else db.exec('COMMIT');
   }catch{if(db.inTransaction)db.exec('ROLLBACK');}
  }catch{/* LRU touch is advisory; preserve the verified value on lock contention. */}
  finally{try{db.pragma('busy_timeout = 250');}catch{}}
  if(!sourceStillCurrent){this.misses++;return;}
  this.hits++;return value;
 }

 put(key:string,source:string,value:unknown):boolean {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048))return false;
  let blob:Buffer;try{blob=serialize(value);}catch{return false;}
  try{if(blob.length>this.entryBudget()||blob.length>this.namespaceBudget())return false;}catch{return false;}
  const digest=sha(blob);
  try{
   db.exec('BEGIN IMMEDIATE');
   try{
    const limits=this.persistedLimits();this.applyPageLimit(limits.maxPages);
    if(blob.length>limits.entryBytes||blob.length>limits.namespaceBytes||blob.length>limits.globalBytes)throw Error('Atlas-Kacheleintrag überschreitet das persistierte Budget.');
    const evicted=this.reserveEntry(key,blob.length,limits);
    db.prepare("INSERT INTO atlas_tile_cache(namespace,key,source,blob,digest,bytes,last_used,kind) VALUES(?,?,?,?,?,?,(SELECT sequence FROM atlas_tile_meta WHERE id=1),'tile')").run(this.namespace,key,source,blob,digest,blob.length);
    this.bytes+=blob.length;
    db.exec('COMMIT');this.evictions+=evicted;this.writes++;
    try{db.exec('PRAGMA incremental_vacuum(8)');}catch{/* committed cache writes stay successful if reclamation fails */}
    return true;
   }catch(error){if(db.inTransaction)db.exec('ROLLBACK');this.bytes=this.namespaceBytes();throw error;}
  }catch{return false;}
 }

 /** Store an immutable file as bounded chunks in the same LRU and byte budget
  * as tiles. The source file is hashed before and during the atomic insertion. */
 putFile(key:string,source:string,filename:string):boolean {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048)||!validText(filename,4096))return false;
  let fd:number|undefined,before:ReturnType<typeof fstatSync>,fileBytes:number,fullDigest:string;
  try{
   fd=openSync(filename,'r');before=fstatSync(fd);if(!before.isFile()||!Number.isSafeInteger(before.size)||before.size<0)return false;
   fileBytes=before.size;
   const earlyLimits=this.persistedLimits();if(fileBytes>earlyLimits.namespaceBytes||fileBytes>earlyLimits.globalBytes)return false;
   fullDigest=hashFileDescriptor(fd,before.size);
   if(!sameFileStats(before,fstatSync(fd)))return false;
  }catch{return false;}finally{if(fd!==undefined)closeSync(fd);}
  const descriptor=Buffer.from(JSON.stringify({format:FILE_FORMAT,bytes:fileBytes,chunkBytes:FILE_CHUNK_BYTES,digest:fullDigest}));
  const rowBytes=fileBytes+descriptor.length,chunkCount=Math.ceil(fileBytes/FILE_CHUNK_BYTES),descriptorDigest=sha(descriptor);
  try{
   db.exec('BEGIN IMMEDIATE');
   try{
    const limits=this.persistedLimits();this.applyPageLimit(limits.maxPages);
    if(rowBytes>limits.namespaceBytes||rowBytes>limits.globalBytes)throw Error('Atlas-Datei überschreitet das persistierte Budget.');
    const evicted=this.reserveEntry(key,rowBytes,limits);
    const current=openSync(filename,'r');
    try{
     const currentBefore=fstatSync(current);if(!sameFileStats(before,currentBefore))throw Error('Atlas-Datei wurde während des Speicherns geändert.');
     const put=db.prepare('INSERT INTO atlas_tile_cache_chunks(namespace,key,ordinal,blob,digest,bytes) VALUES(?,?,?,?,?,?)');
     const hash=createHash('sha256');let offset=0,ordinal=0;
     while(offset<fileBytes){
      const size=Math.min(FILE_CHUNK_BYTES,fileBytes-offset),blob=Buffer.allocUnsafe(size);let read=0;
      while(read<size){const count=readSync(current,blob,read,size-read,offset+read);if(count<=0)throw Error('Atlas-Datei wurde unvollständig gelesen.');read+=count;}
      hash.update(blob);put.run(this.namespace,key,ordinal,blob,sha(blob),blob.length);offset+=size;ordinal++;
     }
     if(ordinal!==chunkCount||hash.digest('hex')!==fullDigest||!sameFileStats(currentBefore,fstatSync(current)))throw Error('Atlas-Datei wurde während des Speicherns geändert.');
    }finally{closeSync(current);}
    db.prepare("INSERT INTO atlas_tile_cache(namespace,key,source,blob,digest,bytes,last_used,kind) VALUES(?,?,?,?,?,?,(SELECT sequence FROM atlas_tile_meta WHERE id=1),'file')").run(this.namespace,key,source,descriptor,descriptorDigest,rowBytes);
    db.exec('COMMIT');this.bytes=this.namespaceBytes();this.evictions+=evicted;this.writes++;
    try{db.exec('PRAGMA incremental_vacuum(8)');}catch{}
    return true;
   }catch(error){if(db.inTransaction)db.exec('ROLLBACK');this.bytes=this.namespaceBytes();throw error;}
  }catch{return false;}
 }

 /** Reconstitute a verified file through a private wx destination. The SQLite
  * read transaction pins one complete chunk generation until the copy closes. */
 getFile(key:string,source:string,destination:string):boolean {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048)||!validText(destination,4096)){this.misses++;return false;}
  let fd:number|undefined,ownedDestination=false,corrupt=false,entry:{blob:Buffer;digest:string;bytes:number}|undefined;
  try{
   db.exec('BEGIN');
   try{
    entry=db.prepare("SELECT blob,digest,bytes FROM atlas_tile_cache WHERE namespace=? AND key=? AND source=? AND kind='file'").get(this.namespace,key,source) as typeof entry;
    if(!entry)throw Error('Atlas-Datei fehlt.');
    const descriptorBytes=Buffer.from(entry.blob);
    if(sha(descriptorBytes)!==entry.digest){corrupt=true;throw Error('Atlas-Dateiverweis ist beschädigt.');}
    let descriptor:{format:number;bytes:number;chunkBytes:number;digest:string};
    try{descriptor=JSON.parse(descriptorBytes.toString('utf8'));}catch{corrupt=true;throw Error('Atlas-Dateiverweis ist beschädigt.');}
    if(descriptor?.format!==FILE_FORMAT||!Number.isSafeInteger(descriptor.bytes)||descriptor.bytes<0||descriptor.chunkBytes!==FILE_CHUNK_BYTES||!/^[a-f0-9]{64}$/.test(descriptor.digest)||entry.bytes!==descriptor.bytes+descriptorBytes.length){corrupt=true;throw Error('Atlas-Dateiverweis ist ungültig.');}
    const expectedChunks=Math.ceil(descriptor.bytes/FILE_CHUNK_BYTES);
    fd=openSync(destination,'wx',0o600);ownedDestination=true;
    const chunks=db.prepare('SELECT ordinal,blob,digest,bytes FROM atlas_tile_cache_chunks WHERE namespace=? AND key=? ORDER BY ordinal').iterate(this.namespace,key);
    const totalHash=createHash('sha256');let ordinal=0,total=0;
    for(const item of chunks as Iterable<{ordinal:number;blob:Buffer;digest:string;bytes:number}>){
     const blob=Buffer.from(item.blob),expectedBytes=Math.min(FILE_CHUNK_BYTES,descriptor.bytes-total);
     if(item.ordinal!==ordinal||ordinal>=expectedChunks||item.bytes!==expectedBytes||blob.length!==item.bytes||sha(blob)!==item.digest){corrupt=true;throw Error('Atlas-Dateiblock ist beschädigt.');}
     writeAll(fd,blob);totalHash.update(blob);total+=blob.length;ordinal++;
    }
    if(ordinal!==expectedChunks||total!==descriptor.bytes||totalHash.digest('hex')!==descriptor.digest){corrupt=true;throw Error('Atlas-Datei ist unvollständig.');}
    closeSync(fd);fd=undefined;
    db.exec('COMMIT');
   }catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
  }catch{
   if(fd!==undefined){try{closeSync(fd);}catch{}}
   if(ownedDestination)try{unlinkSync(destination);}catch{}
   if(entry&&corrupt)this.discardFile(key,source,entry.digest,entry.bytes);
   this.misses++;return false;
  }
  // A touch is advisory: the verified private copy remains valid if a writer
  // replaced or evicted this cache generation immediately after the read.
  this.touchFile(key,source,entry!.digest,entry!.bytes);
  this.hits++;return true;
 }

 close():void {const db=this.db;this.db=null;if(db)try{db.close();}catch{/* cache shutdown cannot affect canonical data */}}

 private initialize(requested:Limits):Limits {
  const db=this.db!;db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`CREATE TABLE IF NOT EXISTS atlas_tile_meta(id INTEGER PRIMARY KEY CHECK(id=1),format INTEGER NOT NULL,sequence INTEGER NOT NULL,namespace_bytes INTEGER NOT NULL,global_bytes INTEGER NOT NULL,entry_bytes INTEGER NOT NULL,max_pages INTEGER NOT NULL);
     CREATE TABLE IF NOT EXISTS atlas_tile_cache(namespace TEXT NOT NULL,key TEXT NOT NULL,source TEXT NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,last_used INTEGER NOT NULL,kind TEXT NOT NULL DEFAULT 'tile' CHECK(kind IN ('tile','file')),PRIMARY KEY(namespace,key)) WITHOUT ROWID;
     CREATE INDEX IF NOT EXISTS atlas_tile_cache_global_lru ON atlas_tile_cache(last_used,namespace,key);
     CREATE INDEX IF NOT EXISTS atlas_tile_cache_namespace_lru ON atlas_tile_cache(namespace,last_used,key);`);
   const columns=db.prepare('PRAGMA table_info(atlas_tile_cache)').all() as {name:string}[];
   if(!columns.some(column=>column.name==='kind'))db.exec("ALTER TABLE atlas_tile_cache ADD COLUMN kind TEXT NOT NULL DEFAULT 'tile' CHECK(kind IN ('tile','file'))");
   db.exec(`CREATE TABLE IF NOT EXISTS atlas_tile_cache_chunks(namespace TEXT NOT NULL,key TEXT NOT NULL,ordinal INTEGER NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(namespace,key,ordinal)) WITHOUT ROWID;
     CREATE TRIGGER IF NOT EXISTS atlas_tile_cache_delete_chunks AFTER DELETE ON atlas_tile_cache BEGIN DELETE FROM atlas_tile_cache_chunks WHERE namespace=old.namespace AND key=old.key; END;`);
   const old=db.prepare('SELECT * FROM atlas_tile_meta WHERE id=1').get() as any;
   if(!old)db.prepare('INSERT INTO atlas_tile_meta VALUES(1,?,?,?,?,?,?)').run(FORMAT,0,requested.namespaceBytes,requested.globalBytes,requested.entryBytes,requested.maxPages);
   else{
    if(old.format!==FORMAT)throw Error('Atlas-Kachelformat beschädigt.');
    // Limits can tighten across handles, never expand. An older open handle reads
    // these values inside each writer transaction, so it cannot bypass the change.
    db.prepare(`UPDATE atlas_tile_meta SET namespace_bytes=min(namespace_bytes,?),global_bytes=min(global_bytes,?),entry_bytes=min(entry_bytes,?) WHERE id=1`).run(requested.namespaceBytes,requested.globalBytes,requested.entryBytes);
    if(old.max_pages!==requested.maxPages)throw Error('Atlas-Kachelplattengrenze passt nicht zu diesem Bestand.');
   }
   db.pragma('application_id = '+APPLICATION);db.pragma('user_version = '+FORMAT);
   const limits=this.persistedLimits();
   this.prune(limits);
   db.exec('COMMIT');
   try{db.exec('PRAGMA incremental_vacuum(0)');}catch{}
   return limits;
  }catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
 }

 private persistedLimits():Limits {
  const row=this.db!.prepare('SELECT namespace_bytes,global_bytes,entry_bytes,max_pages FROM atlas_tile_meta WHERE id=1').get() as {namespace_bytes:number;global_bytes:number;entry_bytes:number;max_pages:number};
  return{namespaceBytes:row.namespace_bytes,globalBytes:row.global_bytes,entryBytes:row.entry_bytes,maxPages:row.max_pages};
 }
 private applyPageLimit(maxPages:number){const result=this.db!.pragma('max_page_count = '+maxPages,{simple:true}) as number;if(result>maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');}
 private globalBytes(){return(this.db!.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;}
 private namespaceBytes(){return(this.db!.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache WHERE namespace=?').get(this.namespace) as {bytes:number}).bytes;}
 /** Reserve an entire parent entry in the shared LRU. File children are removed
  * by the parent trigger, so replacement and eviction stay atomic. */
 private reserveEntry(key:string,bytes:number,limits:Limits){
  const db=this.db!;this.bytes=this.namespaceBytes();let namespaceUsed=this.bytes,globalUsed=this.globalBytes();
  const old=db.prepare('SELECT bytes FROM atlas_tile_cache WHERE namespace=? AND key=?').get(this.namespace,key) as {bytes:number}|undefined;
  db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(this.namespace,key);
  this.bytes=Math.max(0,this.bytes-(old?.bytes??0));namespaceUsed=Math.max(0,namespaceUsed-(old?.bytes??0));globalUsed=Math.max(0,globalUsed-(old?.bytes??0));
  db.prepare('UPDATE atlas_tile_meta SET sequence=sequence+1 WHERE id=1').run();let evicted=0;
  while(namespaceUsed+bytes>limits.namespaceBytes){
   const victim=db.prepare('SELECT key,bytes FROM atlas_tile_cache WHERE namespace=? ORDER BY last_used,key LIMIT 1').get(this.namespace) as {key:string;bytes:number}|undefined;
   if(!victim)throw Error('Atlas-Kampagnenbudget kann nicht eingehalten werden.');
   db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(this.namespace,victim.key);this.bytes=Math.max(0,this.bytes-victim.bytes);namespaceUsed-=victim.bytes;globalUsed-=victim.bytes;evicted++;
  }
  while(globalUsed+bytes>limits.globalBytes){
   const victim=db.prepare('SELECT namespace,key,bytes FROM atlas_tile_cache ORDER BY last_used,namespace,key LIMIT 1').get() as {namespace:string;key:string;bytes:number}|undefined;
   if(!victim)throw Error('Atlas-Gesamtbudget kann nicht eingehalten werden.');
   db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(victim.namespace,victim.key);
   if(victim.namespace===this.namespace){this.bytes=Math.max(0,this.bytes-victim.bytes);namespaceUsed-=victim.bytes;}globalUsed-=victim.bytes;evicted++;
  }
  return evicted;
 }
 private prune(limits:Limits){
  const db=this.db!;
  const namespaceBytes=new Map<string,number>();for(const row of db.prepare('SELECT namespace,coalesce(sum(bytes),0) bytes FROM atlas_tile_cache GROUP BY namespace').all() as {namespace:string;bytes:number}[])namespaceBytes.set(row.namespace,row.bytes);
  for(const [namespace,initial] of namespaceBytes){
   let used=initial;
   while(used>limits.namespaceBytes){const victim=db.prepare('SELECT key,bytes FROM atlas_tile_cache WHERE namespace=? ORDER BY last_used,key LIMIT 1').get(namespace) as {key:string;bytes:number}|undefined;if(!victim)break;db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(namespace,victim.key);used-=victim.bytes;}
  }
  let total=this.globalBytes();while(total>limits.globalBytes){const victim=db.prepare('SELECT namespace,key,bytes FROM atlas_tile_cache ORDER BY last_used,namespace,key LIMIT 1').get() as {namespace:string;key:string;bytes:number}|undefined;if(!victim)break;db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=? AND key=?').run(victim.namespace,victim.key);total-=victim.bytes;}
 }
 private eraseNamespaceRows(){const db=this.db!;db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM atlas_tile_cache WHERE namespace=?').run(this.namespace);db.exec('COMMIT');}catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}}
 private discard(key:string,source:string,digest:string,bytes:number){const db=this.db;if(!db)return;try{db.exec('BEGIN IMMEDIATE');db.prepare("DELETE FROM atlas_tile_cache WHERE namespace=? AND key=? AND source=? AND digest=? AND bytes=? AND kind='tile'").run(this.namespace,key,source,digest,bytes);db.exec('COMMIT');this.bytes=this.namespaceBytes();try{db.exec('PRAGMA incremental_vacuum(8)');}catch{}}catch{if(db.inTransaction)try{db.exec('ROLLBACK');}catch{}}}
 private discardFile(key:string,source:string,digest:string,bytes:number){const db=this.db;if(!db)return;try{db.exec('BEGIN IMMEDIATE');db.prepare("DELETE FROM atlas_tile_cache WHERE namespace=? AND key=? AND source=? AND digest=? AND bytes=? AND kind='file'").run(this.namespace,key,source,digest,bytes);db.exec('COMMIT');this.bytes=this.namespaceBytes();try{db.exec('PRAGMA incremental_vacuum(8)');}catch{}}catch{if(db.inTransaction)try{db.exec('ROLLBACK');}catch{}}}
 private touchFile(key:string,source:string,digest:string,bytes:number){const db=this.db;if(!db)return;try{db.pragma('busy_timeout = 0');db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE atlas_tile_meta SET sequence=sequence+1 WHERE id=1').run();db.prepare("UPDATE atlas_tile_cache SET last_used=(SELECT sequence FROM atlas_tile_meta WHERE id=1) WHERE namespace=? AND key=? AND source=? AND digest=? AND bytes=? AND kind='file'").run(this.namespace,key,source,digest,bytes);db.exec('COMMIT');}catch{if(db.inTransaction)db.exec('ROLLBACK');}}catch{}finally{try{db.pragma('busy_timeout = 250');}catch{}}}
 private namespaceBudget(){return this.persistedLimits().namespaceBytes;}
 private entryBudget(){return this.persistedLimits().entryBytes;}
}

function readLimits(options:Options):Limits {
 const namespaceBytes=options.maxBytes??DEFAULT_NAMESPACE_BUDGET,globalBytes=options.maxGlobalBytes??DEFAULT_GLOBAL_BUDGET,entryBytes=options.maxEntryBytes??DEFAULT_ENTRY,physicalBytes=options.maxPhysicalBytes??DEFAULT_PHYSICAL_BUDGET;
 if(!Number.isSafeInteger(namespaceBytes)||namespaceBytes<1||!Number.isSafeInteger(globalBytes)||globalBytes<1||!Number.isSafeInteger(entryBytes)||entryBytes<1||entryBytes>namespaceBytes||entryBytes>globalBytes||!Number.isSafeInteger(physicalBytes)||physicalBytes<16*1024*1024)throw new Error('Ungültiges Atlas-Kachelbudget.');
 const maxPages=Math.floor((physicalBytes-JOURNAL_RESERVE)/(2*PAGE_BYTES));
 if(maxPages<32)throw new Error('Ungültiges physisches Atlas-Kachelbudget.');
 return{namespaceBytes,globalBytes,entryBytes,maxPages};
}
function hashFileDescriptor(fd:number,size:number){
 const hash=createHash('sha256');let offset=0;
 while(offset<size){const length=Math.min(FILE_CHUNK_BYTES,size-offset),buffer=Buffer.allocUnsafe(length);let read=0;while(read<length){const count=readSync(fd,buffer,read,length-read,offset+read);if(count<=0)throw Error('Datei wurde unvollständig gelesen.');read+=count;}hash.update(buffer);offset+=length;}
 return hash.digest('hex');
}
function writeAll(fd:number,buffer:Buffer){let offset=0;while(offset<buffer.length){const count=writeSync(fd,buffer,offset,buffer.length-offset);if(count<=0)throw Error('Datei konnte nicht vollständig geschrieben werden.');offset+=count;}}
function readSqliteHeader(filename:string){
 const fd=openSync(filename,'r'),header=Buffer.alloc(100);
 try{const count=readSync(fd,header,0,header.length,0);if(count!==100||!header.subarray(0,16).equals(Buffer.from('SQLite format 3\0')))throw Error('Keine gültige SQLite-Kacheldatei.');}
 finally{closeSync(fd);}
 const encodedPageSize=header.readUInt16BE(16);
 return{application:header.readUInt32BE(68),version:header.readUInt32BE(60),pageSize:encodedPageSize===1?65536:encodedPageSize};
}
function validText(value:unknown,max:number):value is string{return typeof value==='string'&&value.length>0&&value.length<=max;}

/** A campaign erase is the only runtime path that retires its exact V1 shard.
 * The caller has already stopped tile workers; ambiguity blocks final erasure. */
function eraseLegacyNamespace(directory:string,namespace:string){
 const root=join(directory,'tiles-v1'),filename=join(root,namespace+'.sqlite');
 try{const rootInfo=lstatSync(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw Error('Alter Atlas-Kachelordner ist nicht eindeutig.');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 let before;try{before=lstatSync(filename);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 if(!before.isFile()||before.isSymbolicLink())throw Error('Alter Atlas-Kachelbestand ist keine reguläre Datei.');
 for(const suffix of ['-journal','-wal','-shm'])if(existsSync(filename+suffix))throw Error('Alter Atlas-Kachelbestand ist belegt; Kampagnenlöschung bleibt offen.');
 const header=readSqliteHeader(filename);if(header.application!==APPLICATION||header.version!==1||header.pageSize!==PAGE_BYTES)throw Error('Alter Atlas-Kachelbestand gehört nicht eindeutig zur Kampagne.');
 let db:InstanceType<typeof Database>|undefined,known=false,corrupt=false;
 try{
  db=new Database(filename,{readonly:true,timeout:100});
  known=db.pragma('application_id',{simple:true})===APPLICATION&&db.pragma('user_version',{simple:true})===1&&(db.prepare('SELECT format FROM atlas_tile_meta WHERE id=1').get() as {format:number}|undefined)?.format===1;
  const integrity=db.pragma('quick_check(1)') as Array<{quick_check:string}>;corrupt=!Array.isArray(integrity)||integrity.length!==1||integrity[0]?.quick_check!=='ok';
 }catch(error){const code=String((error as any)?.code??'');if(code==='SQLITE_CORRUPT'||code==='SQLITE_NOTADB')corrupt=true;else throw error;}
 finally{try{db?.close();}catch{}}
 if(!known&&!corrupt)throw Error('Alter Atlas-Kachelbestand ist unmarkiert; Kampagnenlöschung bleibt offen.');
 const after=statSync(filename);if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Alter Atlas-Kachelbestand wurde zwischenzeitlich geändert.');
 unlinkSync(filename);
}

/** Run only during single-instance startup, before tile workers are created.
 * Corrupt owned V1 shards are removed as before; intact, known V1 shards are
 * retired because V2 stores every namespace in one file. Unknown, busy,
 * symlinked, sidecar-backed, unmarked or changed files are preserved. */
export async function clearCorruptAtlasTileCaches(directory:string):Promise<void>{
 const root=join(directory,'tiles-v1');let names:string[]=[];
 try{const info=lstatSync(root);if(info.isDirectory()&&!info.isSymbolicLink())names=readdirSync(root);}catch{}
 for(const name of names){
  if(!/^[a-f0-9]{64}\.sqlite$/.test(name))continue;
  const filename=join(root,name);
  try{
   const before=lstatSync(filename);if(!before.isFile()||before.isSymbolicLink())continue;
   if(existsSync(filename+'-journal')||existsSync(filename+'-wal')||existsSync(filename+'-shm'))continue;
   const fd=openSync(filename,'r'),header=Buffer.alloc(100);
   try{readSync(fd,header,0,header.length,0);}finally{closeSync(fd);}
   const headerOwned=header.length>=72&&header.subarray(0,16).equals(Buffer.from('SQLite format 3\0'))&&header.readUInt32BE(68)===APPLICATION;
   let db:InstanceType<typeof Database>|undefined,owned=false,known=false,corrupt=false;
   try{
    db=new Database(filename,{readonly:true,timeout:100});
    owned=db.pragma('application_id',{simple:true})===APPLICATION;
    const version=db.pragma('user_version',{simple:true}),marker=db.prepare('SELECT format FROM atlas_tile_meta WHERE id=1').get() as {format:number}|undefined;
    known=version===1&&marker?.format===1;
    const result=db.pragma('quick_check(1)') as Array<{quick_check:string}>;
    corrupt=!Array.isArray(result)||result.length!==1||result[0]?.quick_check!=='ok';
   }catch(error){const code=String((error as any)?.code??'');corrupt=code==='SQLITE_CORRUPT'||code==='SQLITE_NOTADB';}
   finally{try{db?.close();}catch{}}
   // Remove only a validated V1 owned database, or a damaged database whose
   // readable header still proves ownership (the prior corrupt-cache policy).
   if(!(owned&&known&&!corrupt||corrupt&&headerOwned))continue;
   const after=statSync(filename);
   if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)continue;
   unlinkSync(filename);
  }catch{/* Busy, unreadable, or changed while checking: preserve it. */}
 }
 // The shared V2 file is also disposable, but only the exclusive startup pass
 // may remove it. A hot rollback journal is left for SQLite recovery instead.
 const shared=sharedFile(directory);
 try{
  const sharedDir=lstatSync(sharedRoot(directory));if(!sharedDir.isDirectory()||sharedDir.isSymbolicLink())return;
  for(const name of readdirSync(sharedRoot(directory))){
   if(!/^atlas-tiles\.sqlite\.init-[a-f0-9-]{36}$/.test(name))continue;
   const temporary=join(sharedRoot(directory),name);
   try{
    const before=lstatSync(temporary);if(!before.isFile()||before.isSymbolicLink())continue;
    for(const suffix of ['-journal','-wal','-shm'])if(existsSync(temporary+suffix))throw Error('Temporärer Bestand ist belegt.');
    const header=readSqliteHeader(temporary);if(header.application!==APPLICATION||header.version!==FORMAT||header.pageSize!==PAGE_BYTES)continue;
    const check=new Database(temporary,{readonly:true,timeout:100});let valid=false;
    try{const integrity=check.pragma('quick_check(1)') as Array<{quick_check:string}>;valid=Array.isArray(integrity)&&integrity.length===1&&integrity[0]?.quick_check==='ok';}finally{check.close();}
    if(!valid)continue;const after=statSync(temporary);if(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs)unlinkSync(temporary);
   }catch{/* Ambiguous or busy initializer files remain untouched. */}
  }
  const before=lstatSync(shared);if(!before.isFile()||before.isSymbolicLink())return;
  for(const suffix of ['-journal','-wal','-shm'])if(existsSync(shared+suffix))return;
  const fd=openSync(shared,'r'),header=Buffer.alloc(100);try{readSync(fd,header,0,header.length,0);}finally{closeSync(fd);}
  const headerOwned=header.subarray(0,16).equals(Buffer.from('SQLite format 3\0'))&&header.readUInt32BE(68)===APPLICATION;
  let db:InstanceType<typeof Database>|undefined,owned=false,corrupt=false;
  try{db=new Database(shared,{readonly:true,timeout:100});owned=db.pragma('application_id',{simple:true})===APPLICATION;const result=db.pragma('quick_check(1)') as Array<{quick_check:string}>;corrupt=!Array.isArray(result)||result.length!==1||result[0]?.quick_check!=='ok';}
  catch(error){const code=String((error as any)?.code??'');corrupt=code==='SQLITE_CORRUPT'||code==='SQLITE_NOTADB';}
  finally{try{db?.close();}catch{}}
  if(!corrupt||!(owned||headerOwned))return;
  const after=statSync(shared);if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)return;
  unlinkSync(shared);
 }catch{/* Busy, unreadable, or changed while checking: preserve it. */}
}
