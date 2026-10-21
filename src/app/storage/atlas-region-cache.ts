import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,rename,rm,stat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import type {AtlasRegionSource} from '../atlas-region-contracts';

// Bump when bounds, anchor resolution, validation, or these TEMP columns change.
const format=1,limit=96*1024*1024;
const tables={
 region_shape:['key','kind','owner','scope','floor','source_order','min_x','max_x','min_y','max_y','paint_order'],
 region_problem:['key','id'],
 region_extent:['scope','floor','x','y','width','height'],
} as const;
type Table=keyof typeof tables;
const hash=()=>createHash('sha256');
const pause=()=>new Promise<void>(resolve=>setImmediate(resolve));
const identity=(filename:string,campaignId:string)=>hash().update(JSON.stringify([filename,campaignId])).digest('hex');
function valid(table:Table,row:unknown):row is (string|number)[]{
 if(!Array.isArray(row)||row.length!==tables[table].length)return false;
 const strings=table==='region_shape'?5:2;
 if(!row.every((v,i)=>i<strings?typeof v==='string'&&v.length<=4096:typeof v==='number'&&Number.isFinite(v)))return false;
 if(table==='region_shape')return ['room','unit','element'].includes(row[1])&&row[0].startsWith(row[1]+':')&&Number.isSafeInteger(row[5])&&row[5]>0&&row[6]<=row[7]&&row[8]<=row[9]&&[0,1,2].includes(row[10]);
 return table!=='region_extent'||row[4]>=0&&row[5]>=0;
}
/** Disposable display metadata only. A bounded stream avoids duplicating the world
 * in JS memory. Partial/corrupt files roll back TEMP writes and rebuild normally. */
export class AtlasRegionCache {
 constructor(private directory:string){}
 private key(source:AtlasRegionSource){return identity(source.filename,source.campaignId);}
 private header(source:AtlasRegionSource){return JSON.stringify({format,key:this.key(source),source:source.shapeVersion});}
 async load(db:any,source:AtlasRegionSource):Promise<boolean>{
  if(!source.shapeVersion||source.shadow)return false;
  let stream:ReturnType<typeof createReadStream>|undefined,lines:ReturnType<typeof createInterface>|undefined,saved=false;
  try{
   const file=join(this.directory,this.key(source)+'.jsonl');if((await stat(file)).size>limit)return false;
   stream=createReadStream(file,{highWaterMark:64*1024});lines=createInterface({input:stream,crlfDelay:Infinity});
   db.exec('SAVEPOINT region_cache_load');saved=true;
   const inserts=new Map(Object.entries(tables).map(([table,cols])=>[table,db.prepare(`INSERT INTO temp.${table} VALUES(${cols.map(()=>'?').join(',')})`)]));
   const digest=hash();let count=0,bytes=0,header=false,complete=false;
   for await(const line of lines){
    bytes+=Buffer.byteLength(line)+1;if(bytes>limit||line.length>65536||complete)throw Error('Invalid cache length');
    if(!header){if(line!==this.header(source))throw Error('Stale cache');header=true;digest.update(line+'\n');continue;}
    const value=JSON.parse(line);
    if(!Array.isArray(value)){if(value?.rows!==count||value?.sha256!==digest.digest('hex'))throw Error('Invalid cache digest');complete=true;continue;}
    const [table,row]=value as [Table,unknown];
    if(!Object.hasOwn(tables,table)||!valid(table,row))throw Error('Invalid cache row');
    inserts.get(table)!.run(...row);digest.update(line+'\n');if(++count%128===0)await pause();
   }
   if(!header||!complete)throw Error('Incomplete cache');
   db.exec('RELEASE region_cache_load');saved=false;return true;
  }catch{
   if(saved)db.exec('ROLLBACK TO region_cache_load; RELEASE region_cache_load');
   return false;
  }finally{lines?.close();stream?.destroy();}
 }
 async save(db:any,source:AtlasRegionSource):Promise<void>{
  if(!source.shapeVersion||source.shadow)return;
  const file=join(this.directory,this.key(source)+'.jsonl'),candidate=file+'.candidate-'+randomUUID();
  let handle:Awaited<ReturnType<typeof open>>|undefined;
  try{
   await mkdir(this.directory,{recursive:true});handle=await open(candidate,'wx',0o600);
   const digest=hash();let bytes=0,rows=0,buffer='';
   const append=async(line:string)=>{bytes+=Buffer.byteLength(line);if(bytes>limit)throw Error('Cache budget exceeded');digest.update(line);buffer+=line;if(buffer.length>=65536){await handle!.writeFile(buffer);buffer='';}};
   await append(this.header(source)+'\n');
   for(const [table,cols]of Object.entries(tables)){
    // Cursor paging releases the SQLite statement before yielding to cancellation.
    let cursor=0;
    for(;;){
     const batch=db.prepare(`SELECT rowid cursor,${cols.join(',')} FROM temp.${table} WHERE rowid>? ORDER BY rowid LIMIT 128`).all(cursor);
     if(!batch.length)break;
     for(const row of batch){await append(JSON.stringify([table,cols.map(col=>row[col])])+'\n');rows++;cursor=row.cursor;}
     await pause();
    }
   }
   await handle.writeFile(buffer+JSON.stringify({rows,sha256:digest.digest('hex')})+'\n');await handle.close();handle=undefined;
   await rename(candidate,file);
  }catch{/* Read caches never prevent opening or editing the canonical campaign. */}
  finally{await handle?.close().catch(()=>{});await rm(candidate,{force:true}).catch(()=>{});}
 }
}
/** Called after workers stop when a campaign is permanently erased. */
export async function eraseAtlasRegionCache(directory:string,filename:string,campaignId:string){
 const prefix=identity(filename,campaignId)+'.jsonl';
 let files:string[];try{files=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 for(const name of files)if(name===prefix||name.startsWith(prefix+'.candidate-'))await rm(join(directory,name),{force:true});
}

/** Main calls this before starting any reader. A terminated worker may leave only
 * its disposable candidate; never remove another cache or arbitrary directory. */
export async function clearAtlasRegionCacheCandidates(directory:string){
 let files:string[];try{files=await readdir(directory);}catch{return;}
 for(const name of files)if(/^[a-f0-9]{64}\.jsonl\.candidate-[a-f0-9-]{36}$/.test(name))await rm(join(directory,name),{force:true}).catch(()=>{});
}
