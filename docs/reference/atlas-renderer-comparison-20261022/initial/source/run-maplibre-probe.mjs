import {createRequire} from 'node:module';import {mkdir,mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';import {homedir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const require=createRequire(process.cwd()+'/package.json'),root=path.join(homedir(),'.cache/saltmarcher/renderer-comparison'),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/maplibre-initial');await mkdir(output,{recursive:true});await mkdir(root+'/profiles',{recursive:true});const profile=await mkdtemp(root+'/profiles/probe-');
const files=['main.cjs','index.html','probe.mjs','projection.mjs','style.css'],hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(root+'/probe/'+f)).digest('hex')])));let app,pid;const errors=[],consoleErrors=[];let exit;
try{
 app=await require('playwright-core')._electron.launch({executablePath:process.cwd()+'/node_modules/electron/dist/electron',args:[root+'/probe/main.cjs','--ozone-platform=x11'],env:{...process.env,PROBE_PROFILE:profile,SALTMARCHER_ROOT:process.cwd()},timeout:20000});pid=app.process().pid;app.process().once('exit',(code,signal)=>exit={code,signal});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleErrors.push(m.text());});
 await page.waitForFunction(()=>window.probe?.ready,{},{timeout:60000});
 const result={version:await page.evaluate(()=>window.probe.version),fixture:await page.evaluate(()=>window.probe.fixture),poses:[],frames:[]};
 for(const [name,width,center,pitch]of [['world',40000000,[0,0],0],['continent',5000000,[0,0],40],['kingdom',300000,[0,0],45],['city',6000,[1500,750],45],['building',60,[9,11],45]]){
  const pose=await page.evaluate(args=>window.probe.pose(...args),[width,center,pitch,23]);result.poses.push({name,...pose});await page.screenshot({path:output+'/'+name+'.png'});
 }
 result.frames=await page.evaluate(async()=>{const map=window.probe.map,frames=[];let previous;for(let i=0;i<150;i++){const now=await new Promise(r=>requestAnimationFrame(r));if(previous!==undefined)frames.push(now-previous);previous=now;map.jumpTo({bearing:23+Math.sin(i/20)*15,zoom:map.getZoom()+Math.sin(i/10)*.01});}return frames;});
 result.errors=await page.evaluate(()=>window.probe.errors);await writeFile(output+'/observations.json',JSON.stringify({...result,errors,consoleErrors,pid,profile,hashes},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.close()));
 for(let i=0;i<100&&!exit;i++)await new Promise(r=>setTimeout(r,50));assert.deepEqual(exit,{code:0,signal:null});await assert.rejects(stat('/proc/'+pid),{code:'ENOENT'});app=null;
 await writeFile(output+'/result.json',JSON.stringify({...result,errors,consoleErrors,pid,profile,hashes,exit,pidAbsent:true},null,2));console.log(JSON.stringify({version:result.version,poses:result.poses,frameP95:result.frames.sort((a,b)=>a-b)[Math.floor(result.frames.length*.95)],consoleErrors}));
}catch(e){await writeFile(output+'/failure.json',JSON.stringify({error:e.stack,pid,profile,hashes,errors,consoleErrors,exit},null,2));throw e;}finally{if(app)await app.close().catch(()=>{});}
