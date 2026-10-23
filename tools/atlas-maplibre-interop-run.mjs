// Each attempt retains its own failure/success evidence. The driver alone owns
// Electron shutdown and writes results only after observing process completion.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createWriteStream} from 'node:fs';
const build=resolve('.build/atlas-maplibre-interop');
const output=resolve(build,'runs',`${Date.now()}-${process.pid}`);
await mkdir(output,{recursive:true});
await writeFile(resolve(build,'last-run.txt'),output+'\n');
console.log('Evidence: '+output);
const log=createWriteStream(resolve(output,'electron.log'));
const child=spawn('python3',[resolve('tools/ui-session.py'),process.execPath,resolve('tools/atlas-maplibre-interop-driver.mjs')],{
  env:{...process.env,ATLAS_INTEROP_OUTPUT:output},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk);});
child.stderr.on('data',chunk=>{log.write(chunk);process.stderr.write(chunk);});
child.once('error',error=>{console.error(error);process.exitCode=1;log.end();});
child.once('exit',(code,signal)=>{log.end();if(code!==0||signal)process.exitCode=code||1;});
