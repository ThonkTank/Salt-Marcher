import {createRequire} from 'node:module';import {mkdir,mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';import {homedir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const require=createRequire(process.cwd()+'/package.json'),root=path.join(homedir(),'.cache/saltmarcher/deck-comparison'),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/deck-components');await mkdir(output,{recursive:true});await mkdir(root+'/profiles',{recursive:true});const profile=await mkdtemp(root+'/profiles/probe-');
const files=['main.cjs','index.html','probe.mjs','bundle.mjs','style.css'],hashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(root+'/probe/'+f)).digest('hex')])));let app,pid;const errors=[],consoleErrors=[];let exit;
try{
 app=await require('playwright-core')._electron.launch({executablePath:process.cwd()+'/node_modules/electron/dist/electron',args:[root+'/probe/main.cjs'],env:{...process.env,PROBE_PROFILE:profile,SALTMARCHER_ROOT:process.cwd()},timeout:20000});pid=app.process().pid;app.process().once('exit',(code,signal)=>exit={code,signal});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleErrors.push(m.text());});
 await page.waitForFunction(()=>window.probe?.ready,{},{timeout:60000});
 const result={platformRequest:'default',desktopSession:process.env.XDG_SESSION_TYPE??null,version:await page.evaluate(()=>window.probe.version),fixture:await page.evaluate(()=>window.probe.fixture),poses:[],frames:[]};
 result.components=await page.evaluate(async()=>{
  const deck=window.probe.deck,tick=()=>new Promise(r=>requestAnimationFrame(r)),results=[];
  await window.probe.pose(6000,[1500,750],45,23);
  const gl=deck.device.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let recording=false;const pending=[],cpu=[];
  const original=deck._drawLayers;deck._drawLayers=function(...args){if(!recording)return original.apply(this,args);const begin=performance.now(),q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{return original.apply(this,args);}finally{cpu.push(performance.now()-begin);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}}};
  for(const kind of ['full','flat','full-return','terrain-only','background']){
   await window.probe.mode(kind==='full-return'?'full':kind);
   const gaps=[];let previous;cpu.length=0;recording=true;
   for(let i=0;i<180;i++){const now=await tick();if(previous!==undefined)gaps.push(now-previous);previous=now;window.probe.camera(i);}await tick();recording=false;
   while(pending.some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)))await tick();
   const gpu=pending.splice(0).map(q=>{const v=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);return v;});
   if(ext&&gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('disjoint timer');
   const q=(v,p)=>[...v].sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*p))];if(cpu.length<100||ext&&gpu.length<100)throw Error('Missing render samples');
   results.push({kind,frames:gaps.length,p50:q(gaps,.5),p95:q(gaps,.95),p99:q(gaps,.99),cpuDrawP95:q(cpu,.95),gpuP95:q(gpu,.95),gaps,cpu,gpu});
  }
  deck._drawLayers=original;deck.finalize();for(let i=0;i<60;i++)await tick();const gaps=[];let previous;for(let i=0;i<180;i++){const now=await tick();if(previous!==undefined)gaps.push(now-previous);previous=now;}const sorted=[...gaps].sort((a,b)=>a-b);results.push({kind:'empty-electron',p50:sorted[89],p95:sorted[170],p99:sorted[177],gaps});return results;
 });
 result.errors=await page.evaluate(()=>window.probe.errors);await writeFile(output+'/observations.json',JSON.stringify({...result,errors,consoleErrors,pid,profile,hashes},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(result.errors,[]);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.close()));
 for(let i=0;i<100&&!exit;i++)await new Promise(r=>setTimeout(r,50));assert.deepEqual(exit,{code:0,signal:null});await assert.rejects(stat('/proc/'+pid),{code:'ENOENT'});app=null;
 await writeFile(output+'/result.json',JSON.stringify({...result,errors,consoleErrors,pid,profile,hashes,exit,pidAbsent:true},null,2));console.log(JSON.stringify({version:result.version,poses:result.poses,components:result.components.map(({gaps,cpu,gpu,...r})=>r),consoleErrors}));
}catch(e){await writeFile(output+'/failure.json',JSON.stringify({error:e.stack,pid,profile,hashes,errors,consoleErrors,exit},null,2));throw e;}finally{if(app)await app.close().catch(()=>{});}
