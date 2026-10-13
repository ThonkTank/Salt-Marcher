import {createHash,randomUUID} from 'node:crypto';
import {constants,createReadStream,createWriteStream} from 'node:fs';
import {mkdir,rename,rm,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {readArchive,writeArchive,waitForDrain,completeOutput,closeOutput} from './zip-files';
import {audioMimeTypes,type AudioAsset,type AudioTransferProgress} from '../src/app/music-contracts';
import {audioFile,validateAudioLibrary,type audioLibrarySnapshot} from '../src/app/storage/music';

type Library=ReturnType<typeof audioLibrarySnapshot>;
export type TransferHooks={cancelled:()=>boolean;progress:(p:AudioTransferProgress)=>void};
function check(h:TransferHooks){if(h.cancelled())throw new Error('Audioübertragung abgebrochen.');}

export async function copyAudio(source:string,root:string,h:TransferHooks):Promise<AudioAsset['media']>{
  const extension=path.extname(source).toLowerCase();
  if(!audioMimeTypes[extension])throw new Error('Nicht unterstützte Audio-Dateiendung.');
  check(h);await mkdir(root,{recursive:true});
  const temp=path.join(root,'.import-'+randomUUID()),digest=createHash('sha256');
  const output=createWriteStream(temp,{flags:'wx'}),done=completeOutput(output);let bytes=0;
  try{
    for await(const chunk of createReadStream(source)){
      check(h);digest.update(chunk);bytes+=chunk.length;
      if(!output.write(chunk))await waitForDrain(output);
      h.progress({phase:'Audiodatei kopieren',bytes,files:0,busy:true});
    }
    output.end();await done;check(h);
    const sha256=digest.digest('hex');await rename(temp,path.join(root,sha256+extension));
    return{sha256,extension,bytes,mime:audioMimeTypes[extension]!,originalName:path.basename(source)};
  }catch(error){await closeOutput(output,done);await rm(temp,{force:true});throw error;}
}

export async function exportAudioBundle(filename:string,root:string,library:Library,h:TransferHooks){
 validateAudioLibrary(library);const media=new Map<string,AudioAsset>();
 for(const a of library.assets){const name=a.media.sha256+a.media.extension,old=media.get(name);if(old&&old.media.bytes!==a.media.bytes)throw new Error('Widersprüchliche Mediengröße: '+a.name);media.set(name,a);}
 const entries=[...media].map(([name,a])=>({name:'audio/'+name,filename:audioFile(root,a),sha256:a.media.sha256,bytes:a.media.bytes}));
 await writeArchive(filename,library,entries,{check:()=>check(h),progress:(bytes,files)=>h.progress({phase:'Musikbibliothek exportieren',bytes,files,busy:true})});
}

export async function importAudioBundle(filename:string,root:string,h:TransferHooks):Promise<Library>{
 const extracted=await readArchive(filename,root,name=>/^audio\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(name),value=>{
  const library=value as Library;validateAudioLibrary(library);const files=new Map<string,{name:string;sha256:string;bytes:number}>();
  for(const asset of library.assets){const name='audio/'+asset.media.sha256+asset.media.extension,old=files.get(name);if(old&&old.bytes!==asset.media.bytes)throw new Error('Widersprüchliche Mediengröße: '+asset.name);files.set(name,{name,sha256:asset.media.sha256,bytes:asset.media.bytes});}
  return files;
 },{check:()=>check(h),progress:(bytes,files)=>h.progress({phase:'Musikbibliothek importieren',bytes,files,busy:true})});
 const published:string[]=[];
 try{
  const library=extracted.manifest as Library;validateAudioLibrary(library);const expected=new Map<string,AudioAsset>();
  for(const a of library.assets){
   const name=path.basename(audioFile(root,a)),actual=extracted.files.get('audio/'+name);
   if(actual?.sha256!==a.media.sha256)throw new Error('Medien fehlen oder sind verändert: '+a.name);
   if(actual.bytes!==a.media.bytes)throw new Error('Mediengröße stimmt nicht: '+a.name);expected.set(name,a);
  }
  if(expected.size!==extracted.files.size)throw new Error('Musikpaket enthält nicht referenzierte Medien.');
  for(const [name,a]of expected){
   check(h);const destination=audioFile(root,a);
   try{await copyFile(path.join(extracted.dir,'audio',name),destination,constants.COPYFILE_EXCL);published.push(destination);}
   catch(e){
    if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
    const digest=createHash('sha256');let count=0;for await(const chunk of createReadStream(destination)){check(h);digest.update(chunk);count+=chunk.length;}
    if(count!==a.media.bytes||digest.digest('hex')!==a.media.sha256)throw new Error('Vorhandene Medienbytes sind beschädigt: '+a.name);
   }
  }
  check(h);return library;
 }catch(e){for(const destination of published)await rm(destination,{force:true});throw e;}
 finally{await rm(extracted.dir,{recursive:true,force:true});}
}
