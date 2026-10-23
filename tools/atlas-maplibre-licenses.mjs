import {mkdir,readFile,readdir,copyFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const roots=['maplibre-gl','@deck.gl/core','@deck.gl/layers','@deck.gl/maplibre','@math.gl/core'];
const licenseFile=/^(?:license|licence|copying|notice)(?:[._-].+)?$/i;
const here=path.dirname(fileURLToPath(import.meta.url));

function packagePath(name){
  if(!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name))throw new Error(`Ungültiger Paketname: ${name}`);
  return name.split('/');
}

async function packageDirectory(name,from){
  const parts=packagePath(name);let cursor=from;
  while(true){
    const candidate=path.join(cursor,'node_modules',...parts);
    try{
      const manifest=JSON.parse(await readFile(path.join(candidate,'package.json'),'utf8'));
      const real=await realpath(candidate);
      return {directory:real,manifest};
    }catch(error){
      if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;
    }
    const parent=path.dirname(cursor);if(parent===cursor)return null;cursor=parent;
  }
}

async function licenseSources(directory,name){
  const files=(await readdir(directory,{withFileTypes:true}))
    .filter(entry=>entry.isFile()&&licenseFile.test(entry.name))
    .map(entry=>entry.name).sort((a,b)=>a.localeCompare(b));
  if(files.length)return files.map(file=>({source:file,contentsPath:path.join(directory,file)}));
  if(name==='murmurhash-js'){
    const readme=await readFile(path.join(directory,'README.md'),'utf8').catch(()=>null);
    const match=readme?.match(/^## License \(MIT\)\s*$/m);
    if(match){
      const start=match.index,end=readme.indexOf('\n## ',start+match[0].length);
      return [{source:'README.md#License (MIT)',contents:readme.slice(start,end<0?undefined:end)}];
    }
  }
  throw new Error(`Kein mitgelieferter LICENSE/LICENCE/COPYING/NOTICE-Text für ${name} in ${directory}`);
}

/** Copy license notices for the pinned Atlas map runtime and its installed runtime dependency graph. */
export async function copyAtlasMapLibreLicenses(destination){
  const target=path.resolve(destination),seen=new Set(),queue=roots.map(name=>({name,from:here})),packages=[];
  await mkdir(target,{recursive:true});
  while(queue.length){
    const item=queue.shift(),found=await packageDirectory(item.name,item.from);
    if(!found){
      if(item.optional)continue;
      throw new Error(`Installierte Runtime-Abhängigkeit fehlt: ${item.name} (gesucht ab ${item.from})`);
    }
    const {directory,manifest}=found;
    if(seen.has(directory))continue;
    if(typeof manifest.name!=='string'||typeof manifest.version!=='string')throw new Error(`Paketmanifest ohne Name/Version: ${directory}`);
    seen.add(directory);
    const sources=await licenseSources(directory,manifest.name);
    const safeName=manifest.name.replaceAll('/','__');
    const packageOutput=path.join(target,'packages',`${safeName}@${manifest.version}`);
    await mkdir(packageOutput,{recursive:true});
    const copied=[];
    for(let i=0;i<sources.length;i++){
      const source=sources[i],basename=source.source.split('/').at(-1).replaceAll(/[^a-z0-9._-]/gi,'_');
      const filename=sources.length===1?basename:`${i+1}-${basename}`;
      const output=path.join(packageOutput,filename);
      if(source.contents!==undefined)await writeFile(output,source.contents);
      else await copyFile(source.contentsPath,output);
      copied.push(path.relative(target,output).split(path.sep).join('/'));
    }
    packages.push({name:manifest.name,version:manifest.version,license:manifest.license??null,
      source:sources.map(item=>item.source),files:copied});
    for(const name of Object.keys(manifest.dependencies??{}))queue.push({name,from:directory});
    for(const name of Object.keys(manifest.optionalDependencies??{}))queue.push({name,from:directory,optional:true});
    for(const name of Object.keys(manifest.peerDependencies??{}))
      queue.push({name,from:directory,optional:manifest.peerDependenciesMeta?.[name]?.optional===true});
  }
  packages.sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version)||a.source.join(',').localeCompare(b.source.join(',')));
  const manifest={format:'saltmarcher-atlas-maplibre-licenses-v1',packages};
  await writeFile(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {destination:target,packageCount:packages.length,fileCount:packages.reduce((total,p)=>total+p.files.length,0),manifest};
}
