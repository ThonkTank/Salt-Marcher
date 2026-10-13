import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream,mkdirSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {finished} from 'node:stream/promises';
import path from 'node:path';
import {Zip,ZipPassThrough,Unzip,UnzipInflate} from 'fflate';

export interface ArchiveFile {name:string;sha256:string;bytes:number}
export interface ArchiveHooks {check:()=>void;progress:(bytes:number,files:number)=>void}
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

export async function writeArchive(destination:string,manifest:unknown,entries:(ArchiveFile&{filename:string})[],h:ArchiveHooks){
 h.check();
 const names=new Set<string>();for(const entry of entries){if(names.has(entry.name)||entry.name==='manifest.json')throw new Error('Doppelter Archiveintrag.');names.add(entry.name);}
 const dir=await mkdtemp(destination+'.partial-'),temp=path.join(dir,'archive');
 const output=createWriteStream(temp,{flags:'wx'}),done=completeOutput(output),drains:Promise<void>[]=[];let error:Error|null=null,bytes=0,files=0;
 output.on('error',e=>{error=e;});
 const zip=new Zip((e,data,final)=>{if(e){error=e;output.destroy(e);return;}bytes+=data.length;if(!output.write(data))pendingDrain(output,drains);if(final)output.end();});
 const drain=async()=>{h.check();if(error)throw error;await Promise.all(drains.splice(0));h.progress(bytes,files);};
 try{
  const meta=new ZipPassThrough('manifest.json');zip.add(meta);meta.push(Buffer.from(JSON.stringify(manifest)),true);await drain();
  for(const entry of entries){
   h.check();const file=new ZipPassThrough(entry.name),digest=createHash('sha256');let count=0;zip.add(file);
   for await(const chunk of createReadStream(entry.filename)){h.check();digest.update(chunk);count+=chunk.length;file.push(chunk);await drain();}
   if(digest.digest('hex')!==entry.sha256)throw new Error('Dateibytes geändert: '+entry.name);
   if(count!==entry.bytes)throw new Error('Dateigröße stimmt nicht: '+entry.name);
   file.push(new Uint8Array(),true);files++;await drain();
  }
  zip.end();await done;h.check();await rename(temp,destination);
 }finally{zip.terminate();await closeOutput(output,done);await Promise.allSettled(drains);await rm(dir,{recursive:true,force:true});}
}

/** Extract only allowed entries into a fresh owned directory. No destination data is published here. */
export async function readArchive(filename:string,base:string,allowedName:(name:string)=>boolean,h:ArchiveHooks){
 h.check();await mkdir(base,{recursive:true});const dir=await mkdtemp(path.join(base,'import-'));
 const seen=new Set<string>(),files=new Map<string,ArchiveFile>(),outputs:{output:Output;done:Promise<void>}[]=[],decoders:{terminate:()=>void}[]=[],drains:Promise<void>[]=[];
 let bytes=0,error:Error|null=null,success=false;
 const unzip=new Unzip(file=>{
  decoders.push(file);
  if(seen.has(file.name)||file.name!=='manifest.json'&&!allowedName(file.name)){error=new Error('Archiv enthält einen unbekannten oder doppelten Eintrag.');return;}seen.add(file.name);
  const target=path.join(dir,file.name);mkdirSync(path.dirname(target),{recursive:true});
  const output=createWriteStream(target,{flags:'wx'}),done=completeOutput(output),digest=createHash('sha256');let count=0;
  outputs.push({output,done});output.on('error',e=>{error=e;});
  file.ondata=(e,data,final)=>{
   if(e){error=e;output.destroy(e);return;}if(error)return;
   count+=data.length;if(file.name==='manifest.json'&&count>256*1024*1024){error=new Error('Bibliotheksbeschreibung zu groß.');return;}
   digest.update(data);if(!output.write(data))pendingDrain(output,drains);
   if(final){files.set(file.name,{name:file.name,bytes:count,sha256:digest.digest('hex')});output.end();}
  };file.start();
 });
 unzip.register(UnzipInflate);
 try{
  for await(const chunk of createReadStream(filename)){h.check();bytes+=chunk.length;unzip.push(chunk);if(error)throw error;await Promise.all(drains.splice(0));h.progress(bytes,files.size);}
  h.check();unzip.push(new Uint8Array(),true);if(error)throw error;
  if(!files.has('manifest.json')||files.size!==outputs.length)throw new Error('Archiv ist unvollständig.');
  await Promise.all(outputs.map(x=>x.done));h.check();
  const manifest:unknown=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));files.delete('manifest.json');
  success=true;return{dir,manifest,files};
 }finally{
  for(const decoder of decoders)decoder.terminate();
  await Promise.all(outputs.map(x=>closeOutput(x.output,x.done)));await Promise.allSettled(drains);
  if(!success)await rm(dir,{recursive:true,force:true});
 }
}
