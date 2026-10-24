import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream,mkdirSync} from 'node:fs';
import {renameSync} from 'node:fs';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {finished} from 'node:stream/promises';
import path from 'node:path';
import {Zip,ZipPassThrough,Unzip,UnzipInflate} from 'fflate';

export interface ArchiveFile {name:string;sha256:string;bytes:number}
export interface ArchiveHooks {check:()=>void;progress:(bytes:number,files:number)=>void}
export type ArchiveManifestFiles=(manifest:unknown)=>ReadonlyMap<string,ArchiveFile>;
type Output=ReturnType<typeof createWriteStream>;
export function waitForDrain(output:Output){
 return new Promise<void>((resolve,reject)=>{
  const clean=()=>{output.removeListener('drain',ok);output.removeListener('finish',ok);output.removeListener('error',fail);output.removeListener('close',closed);};
  const ok=()=>{clean();resolve();},fail=(e:Error)=>{clean();reject(e);},closed=()=>{clean();reject(new Error('Dateistream vorzeitig geschlossen.'));};
  output.once('drain',ok);output.once('finish',ok);output.once('error',fail);output.once('close',closed);
  if(output.destroyed)closed();else if(!output.writableNeedDrain)ok();
 });
}
export function completeOutput(output:Output){const done=finished(output,{cleanup:true});void done.catch(()=>{});return done;}
export async function closeOutput(output:Output,done:Promise<void>){output.destroy();await done.catch(()=>{});}
function pendingDrain(output:Output,drains:Promise<void>[]){const pending=waitForDrain(output);void pending.catch(()=>{});drains.push(pending);}

export async function writeArchive(destination:string,manifest:unknown,entries:(ArchiveFile&{filename:string;mode?:number})[],h:ArchiveHooks){
 h.check();
 const names=new Set<string>();for(const entry of entries){if(names.has(entry.name)||entry.name==='manifest.json')throw new Error('Doppelter Archiveintrag.');names.add(entry.name);}
 const dir=await mkdtemp(destination+'.partial-'),temp=path.join(dir,'archive');
 const output=createWriteStream(temp,{flags:'wx'}),done=completeOutput(output),drains:Promise<void>[]=[];let error:Error|null=null,bytes=0,files=0;
 output.on('error',e=>{error??=e;});
 const zip=new Zip((e,data,final)=>{if(e){error=e;output.destroy(e);return;}bytes+=data.length;if(!output.write(data))pendingDrain(output,drains);if(final)output.end();});
 const drain=async()=>{h.check();if(error)throw error;await Promise.all(drains.splice(0));h.progress(bytes,files);};
 try{
  const meta=new ZipPassThrough('manifest.json');zip.add(meta);meta.push(Buffer.from(JSON.stringify(manifest)),true);await drain();
  for(const entry of entries){
   h.check();const file=new ZipPassThrough(entry.name),digest=createHash('sha256');if(entry.mode!==undefined){file.os=3;file.attrs=(0o100000|entry.mode)<<16;}let count=0;zip.add(file);
   for await(const chunk of createReadStream(entry.filename)){h.check();digest.update(chunk);count+=chunk.length;file.push(chunk);await drain();}
   if(digest.digest('hex')!==entry.sha256)throw new Error('Dateibytes geändert: '+entry.name);
   if(count!==entry.bytes)throw new Error('Dateigröße stimmt nicht: '+entry.name);
   file.push(new Uint8Array(),true);files++;await drain();
  }
  zip.end();await done;h.check();renameSync(temp,destination);
 }finally{zip.terminate();await closeOutput(output,done);await Promise.allSettled(drains);await rm(dir,{recursive:true,force:true});}
}

function expectedFiles(manifest:unknown,read:ArchiveManifestFiles,allowedName:(name:string)=>boolean){
 const source=read(manifest),result=new Map<string,ArchiveFile>();let total=0;
 for(const [name,file]of source){
  if(name==='manifest.json'||name!==file?.name||!allowedName(name)||result.has(name)||!Number.isSafeInteger(file.bytes)||file.bytes<0||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Manifest enthält ungültige oder doppelte Archiveinträge.');
  total+=file.bytes;if(!Number.isSafeInteger(total))throw new Error('Deklarierte Archivgröße ist zu groß.');result.set(name,file);
 }
 return result;
}

/** Return exactly the validated manifest files, with matching sizes and SHA-256, in fresh staging.
 * On failure staging is removed; destination data is never published here. */
export async function readArchive(filename:string,base:string,allowedName:(name:string)=>boolean,readManifest:ArchiveManifestFiles,h:ArchiveHooks){
 h.check();await mkdir(base,{recursive:true});const dir=await mkdtemp(path.join(base,'import-'));
 const seen=new Set<string>(),files=new Map<string,ArchiveFile>(),outputs:{output:Output;done:Promise<void>}[]=[],decoders:{terminate:()=>void}[]=[],drains:Promise<void>[]=[];
 const manifestState:{expected:Map<string,ArchiveFile>|null}={expected:null};const manifestChunks:Buffer[]=[];let manifest:unknown,bytes=0,error:Error|null=null,success=false;
 const unzip=new Unzip(file=>{
  decoders.push(file);if(error)return;
  if(seen.has(file.name)||file.name!=='manifest.json'&&!allowedName(file.name)){error=new Error('Archiv enthält einen unbekannten oder doppelten Eintrag.');return;}
  if(!seen.size&&file.name!=='manifest.json'){error=new Error('Archivmanifest muss der erste Eintrag sein.');return;}
  if(file.name!=='manifest.json'&&(!manifestState.expected||!manifestState.expected.has(file.name))){error=new Error('Archiv-Manifest enthält einen nicht deklarierten Eintrag.');return;}seen.add(file.name);
  const target=path.join(dir,file.name);mkdirSync(path.dirname(target),{recursive:true});
  const output=createWriteStream(target,{flags:'wx'}),done=completeOutput(output),digest=createHash('sha256');let count=0;
  outputs.push({output,done});output.on('error',e=>{error??=e;});
  file.ondata=(e,data,final)=>{
   try{
    if(e)throw e;if(error)return;h.check();count+=data.length;
    if(file.name==='manifest.json'){
     if(count>64*1024*1024)throw new Error('Bibliotheksbeschreibung zu groß.');manifestChunks.push(Buffer.from(data));
    }else if(count>manifestState.expected!.get(file.name)!.bytes)throw new Error('Dekomprimierte Dateigröße überschreitet das Manifest: '+file.name);
    digest.update(data);if(!output.write(data))pendingDrain(output,drains);
    if(final){
     const actual={name:file.name,bytes:count,sha256:digest.digest('hex')};
     if(file.name==='manifest.json'){
      manifest=JSON.parse(Buffer.concat(manifestChunks).toString('utf8'));manifestState.expected=expectedFiles(manifest,readManifest,allowedName);
     }else{const declared=manifestState.expected!.get(file.name)!;if(actual.bytes!==declared.bytes)throw new Error('Paketdateigröße widerspricht dem Manifest: '+file.name);if(actual.sha256!==declared.sha256)throw new Error('Paketdatei hat eine abweichende Prüfsumme: '+file.name);}
     files.set(file.name,actual);output.end();
    }
   }catch(cause){error??=cause instanceof Error?cause:new Error('Archivdaten sind ungültig.');output.destroy(error);}
  };file.start();
 });
 unzip.register(UnzipInflate);
 try{
  for await(const chunk of createReadStream(filename)){h.check();bytes+=chunk.length;unzip.push(chunk);if(error)throw error;await Promise.all(drains.splice(0));h.progress(bytes,files.size);}
  h.check();unzip.push(new Uint8Array(),true);if(error)throw error;
  if(!files.has('manifest.json')||!manifestState.expected||files.size!==manifestState.expected.size+1||files.size!==outputs.length||[...manifestState.expected].some(([name])=>!files.has(name)))throw new Error('Archiv ist unvollständig. Deklarierte Dateien oder Medien fehlen.');
  await Promise.all(outputs.map(x=>x.done));h.check();
  files.delete('manifest.json');
  success=true;return{dir,manifest,files};
 }finally{
  for(const decoder of decoders)decoder.terminate();
  await Promise.all(outputs.map(x=>closeOutput(x.output,x.done)));await Promise.allSettled(drains);
  if(!success)await rm(dir,{recursive:true,force:true});
 }
}
