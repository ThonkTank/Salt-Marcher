import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {closeSync,existsSync,lstatSync,mkdirSync,openSync,readdirSync,readSync,statSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {deserialize,serialize} from 'node:v8';

const FORMAT=1,APPLICATION=0x534d5443,PAGE_BYTES=4096,DEFAULT_BUDGET=64*1024*1024,DEFAULT_ENTRY=8*1024*1024;
const namespacePattern=/^[a-f0-9]{64}$/;
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
type Options={maxBytes?:number;maxEntryBytes?:number};

/** Disposable, bounded cache for derived Atlas tiles. This class never opens a
 * campaign database: every path is confined to tiles-v1/<validated namespace>. */
export class AtlasTileCache {
 private db:InstanceType<typeof Database>|null=null;
 private hits=0;private misses=0;private writes=0;private evictions=0;private bytes=0;
 private constructor(db:InstanceType<typeof Database>|null,private readonly budget:number,private readonly entryBudget:number){this.db=db;}

 static open(directory:string,namespace:string,options:Options={}):AtlasTileCache {
  if(typeof namespace!=='string'||!namespacePattern.test(namespace))throw new Error('Ungültiger Atlas-Kachel-Namensraum.');
  const maxBytes=options.maxBytes??DEFAULT_BUDGET,maxEntryBytes=options.maxEntryBytes??DEFAULT_ENTRY;
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(maxEntryBytes)||maxEntryBytes<1||maxEntryBytes>maxBytes)throw new Error('Ungültiges Atlas-Kachelbudget.');
  if(typeof directory!=='string'||!directory)throw new Error('Atlas-Kachelverzeichnis fehlt.');
  const root=join(directory,'tiles-v1'),filename=join(root,namespace+'.sqlite');
  try{
   mkdirSync(root,{recursive:true,mode:0o700});
   const db=new Database(filename,{timeout:250});
   try{
    db.pragma('busy_timeout = 250');
    const application=db.pragma('application_id',{simple:true}) as number;
    const version=db.pragma('user_version',{simple:true}) as number;
    if(application!==0&&application!==APPLICATION)throw Error('Atlas-Kacheldatei gehört einer anderen Anwendung.');
    if(application===0&&(db.prepare("SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get()))throw Error('Unmarkierte Atlas-Kacheldatei ist nicht leer.');
    // Ownership is checked before pragmas that could alter a pre-existing file.
    db.pragma('journal_mode = DELETE');db.pragma('synchronous = FULL');db.pragma('page_size = 4096');db.pragma('auto_vacuum = INCREMENTAL');
    if(application===APPLICATION&&version!==0&&version!==FORMAT){
     // A known cache from this application with an older/newer schema is only
     // disposable after obtaining SQLite's writer lock. A busy lock is a miss.
     db.exec('BEGIN IMMEDIATE');
     try{db.exec('DROP TABLE IF EXISTS atlas_tile_cache; DROP TABLE IF EXISTS atlas_tile_meta;');db.pragma('user_version = 0');db.exec('COMMIT');}
     catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
    }
    db.exec('BEGIN IMMEDIATE');
    try{
     db.exec(`CREATE TABLE IF NOT EXISTS atlas_tile_meta(id INTEGER PRIMARY KEY CHECK(id=1),format INTEGER NOT NULL,sequence INTEGER NOT NULL);
       CREATE TABLE IF NOT EXISTS atlas_tile_cache(key TEXT PRIMARY KEY,source TEXT NOT NULL,blob BLOB NOT NULL,digest TEXT NOT NULL,bytes INTEGER NOT NULL,last_used INTEGER NOT NULL) WITHOUT ROWID;
       CREATE INDEX IF NOT EXISTS atlas_tile_cache_lru ON atlas_tile_cache(last_used,key);`);
     db.prepare('INSERT OR IGNORE INTO atlas_tile_meta VALUES(1,?,0)').run(FORMAT);
     db.pragma('application_id = '+APPLICATION);db.pragma('user_version = '+FORMAT);
     const marker=db.prepare('SELECT format FROM atlas_tile_meta WHERE id=1').get() as {format:number}|undefined;
     if(marker?.format!==FORMAT)throw Error('Atlas-Kachelformat beschädigt.');
     db.exec('COMMIT');
    }catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
    const maxPages=Math.max(32,Math.ceil((maxBytes+Math.max(4*1024*1024,Math.ceil(maxBytes/8)))/PAGE_BYTES));
    db.exec('BEGIN IMMEDIATE');
    try{
     let logical=(db.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;
     while(logical>maxBytes){const row=db.prepare('SELECT key,bytes FROM atlas_tile_cache ORDER BY last_used,key LIMIT 1').get() as {key:string;bytes:number}|undefined;if(!row)break;db.prepare('DELETE FROM atlas_tile_cache WHERE key=?').run(row.key);logical-=row.bytes;}
     db.exec('COMMIT');
    }catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
    db.exec('PRAGMA incremental_vacuum(0)');
    db.pragma('max_page_count = '+maxPages);
    if((db.pragma('page_count',{simple:true}) as number)>maxPages)throw Error('Atlas-Kacheldatei überschreitet ihr physisches Limit.');
    const cache=new AtlasTileCache(db,maxBytes,maxEntryBytes);
    cache.bytes=(db.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;
    return cache;
   }catch{db.close();
    // A worker never repairs files while another worker may own a handle.
    // Startup cleanup is a separate, explicit single-instance operation.
    return new AtlasTileCache(null,maxBytes,maxEntryBytes);
   }
  }catch{return new AtlasTileCache(null,maxBytes,maxEntryBytes);}
 }

 get diagnostics(){return{hits:this.hits,misses:this.misses,writes:this.writes,evictions:this.evictions,bytes:this.bytes};}
 get enabled(){return this.db!==null;}

 get<T>(key:string,source:string):T|undefined {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048)){this.misses++;return;}
  let row:{blob:Buffer;digest:string;bytes:number}|undefined;
  try{
   row=db.prepare('SELECT blob,digest,bytes FROM atlas_tile_cache WHERE key=? AND source=?').get(key,source) as typeof row;
  }catch{this.misses++;return;}
  if(!row){this.misses++;return;}
  const blob=Buffer.from(row.blob);
  if(blob.length!==row.bytes||sha(blob)!==row.digest){this.discard(key,source);this.misses++;return;}
  let value:T;
  try{value=deserialize(blob) as T;}catch{this.discard(key,source);this.misses++;return;}
  try{
   db.exec('BEGIN IMMEDIATE');
   try{db.prepare('UPDATE atlas_tile_meta SET sequence=sequence+1 WHERE id=1').run();
    db.prepare('UPDATE atlas_tile_cache SET last_used=(SELECT sequence FROM atlas_tile_meta WHERE id=1) WHERE key=? AND source=?').run(key,source);db.exec('COMMIT');
   }catch(error){if(db.inTransaction)db.exec('ROLLBACK');throw error;}
   this.hits++;return value;
  }catch{this.misses++;return;}
 }

 put(key:string,source:string,value:unknown):boolean {
  const db=this.db;if(!db||!validText(key,512)||!validText(source,2048))return false;
  let blob:Buffer;try{blob=serialize(value);}catch{return false;}
  if(blob.length>this.maxEntryBytes||blob.length>this.maxBytes)return false;
  const digest=sha(blob);
  try{
   db.exec('BEGIN IMMEDIATE');
   try{
    this.bytes=(db.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;
    const old=db.prepare('SELECT bytes FROM atlas_tile_cache WHERE key=?').get(key) as {bytes:number}|undefined;
    if(old)this.bytes=Math.max(0,this.bytes-old.bytes);
    db.prepare('DELETE FROM atlas_tile_cache WHERE key=?').run(key);
    db.prepare('UPDATE atlas_tile_meta SET sequence=sequence+1 WHERE id=1').run();
    let evicted=0;
    while(this.bytes+blob.length>this.maxBytes){
     const victim=db.prepare('SELECT key,bytes FROM atlas_tile_cache ORDER BY last_used,key LIMIT 1').get() as {key:string;bytes:number}|undefined;
     if(!victim)throw Error('Atlas-Kachelbudget kann nicht eingehalten werden.');
     db.prepare('DELETE FROM atlas_tile_cache WHERE key=?').run(victim.key);this.bytes-=victim.bytes;evicted++;
    }
    db.prepare('INSERT INTO atlas_tile_cache(key,source,blob,digest,bytes,last_used) VALUES(?,?,?,?,?,(SELECT sequence FROM atlas_tile_meta WHERE id=1))').run(key,source,blob,digest,blob.length);
    this.bytes+=blob.length;
    db.exec('COMMIT');this.evictions+=evicted;this.writes++;
    try{db.exec('PRAGMA incremental_vacuum(8)');}catch{/* committed cache writes stay successful if reclamation fails */}
    return true;
   }catch(error){if(db.inTransaction)db.exec('ROLLBACK');this.bytes=(db.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;throw error;}
  }catch{return false;}
 }

 close():void {const db=this.db;this.db=null;if(db)try{db.close();}catch{/* cache shutdown cannot affect canonical data */}}
 private discard(key:string,source:string){
  const db=this.db;if(!db)return;
  try{db.exec('BEGIN IMMEDIATE');db.prepare('DELETE FROM atlas_tile_cache WHERE key=? AND source=?').run(key,source);db.exec('COMMIT');this.bytes=(db.prepare('SELECT coalesce(sum(bytes),0) bytes FROM atlas_tile_cache').get() as {bytes:number}).bytes;db.exec('PRAGMA incremental_vacuum(8)');}
  catch{if(db.inTransaction)try{db.exec('ROLLBACK');}catch{}}
 }
 private get maxBytes(){return this.budget;}
 private get maxEntryBytes(){return this.entryBudget;}
}

function validText(value:unknown,max:number):value is string{return typeof value==='string'&&value.length>0&&value.length<=max;}

/** Run only during single-instance startup, before tile workers are created.
 * Unknown, busy, symlinked, sidecar-backed, or unmarked files are preserved. */
export async function clearCorruptAtlasTileCaches(directory:string):Promise<void>{
 const root=join(directory,'tiles-v1');let names:string[];
 try{names=readdirSync(root);}catch{return;}
 for(const name of names){
  if(!/^[a-f0-9]{64}\.sqlite$/.test(name))continue;
  const filename=join(root,name);
  try{
   const before=lstatSync(filename);if(!before.isFile()||before.isSymbolicLink())continue;
   if(existsSync(filename+'-journal')||existsSync(filename+'-wal')||existsSync(filename+'-shm'))continue;
   const fd=openSync(filename,'r'),header=Buffer.alloc(100);
   try{readSync(fd,header,0,header.length,0);}finally{closeSync(fd);}
   const headerOwned=header.length>=72&&header.subarray(0,16).equals(Buffer.from('SQLite format 3\0'))&&header.readUInt32BE(68)===APPLICATION;
   let db:InstanceType<typeof Database>|undefined,owned=false,corrupt=false;
   try{
    db=new Database(filename,{readonly:true,timeout:100});
    owned=db.pragma('application_id',{simple:true})===APPLICATION;
    const result=db.pragma('quick_check(1)') as Array<{quick_check:string}>;
    corrupt=!Array.isArray(result)||result.length!==1||result[0]?.quick_check!=='ok';
   }catch(error){const code=String((error as any)?.code??'');corrupt=code==='SQLITE_CORRUPT'||code==='SQLITE_NOTADB';}
   finally{try{db?.close();}catch{}}
   if(!corrupt||!(owned||headerOwned))continue;
   const after=statSync(filename);
   if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs)continue;
   unlinkSync(filename);
  }catch{/* Busy, unreadable, or changed while checking: preserve it. */}
 }
}
