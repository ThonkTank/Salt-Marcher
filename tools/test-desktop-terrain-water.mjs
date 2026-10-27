import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync,createWriteStream} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import {createNativeSession} from './native-session.mjs';
import {manifest,manifestBytes,manifestHash,createTerrainWaterFixture,heightPayloadHash} from './terrain-water-fixture.mjs';
import {installTerrainWaterObserver,replayTerrainWaterAttempt,terrainWaterAttemptEvidence} from './terrain-water-replay.mjs';
import {setBrushWorldRadius,setHeightDirection} from './atlas-brush-probe.mjs';
import {focusTerrainWindow} from './terrain-water-focus.mjs';
import {currentProcessGroup} from './process-group.mjs';

const root=process.cwd(),args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const scale=Number(arg('--scale',manifest.baseline.scaleM)),uiScale=Number(arg('--ui-scale',manifest.baseline.uiScale));
const selected=arg('--tools',manifest.baseline.tools.join(',')).split(',');
const probe=args.includes('--probe'),boundaryProbe=args.includes('--boundaries-only'),attempts=boundaryProbe?[]:probe?manifest.attempts.slice(0,3):manifest.attempts;
const continuousCheck=args.includes('--continuous-paint-check');
if(continuousCheck){
 assert.equal(process.env.TW_VIRTUAL_SESSION,'1','The continuous paint check requires the private Wayland session.');
 assert.equal(scale,20);assert.equal(uiScale,1);assert.deepEqual(selected,['raise']);
 assert(!probe&&!boundaryProbe,'The continuous paint check is its own bounded workflow.');
}
const cancelBlurOnly=args.includes('--cancel-blur-only');assert(!cancelBlurOnly||boundaryProbe);
const blurOnly=args.includes('--blur-only');assert(!blurOnly||cancelBlurOnly);
const skipBlur=args.includes('--skip-blur');assert(!skipBlur||!cancelBlurOnly);
assert(manifest.scalesM.includes(scale)&&manifest.uiScales.includes(uiScale));
assert(selected.every(id=>manifest.tools.some(t=>t.id===id&&t.implemented!==false)));
const output=path.resolve('.build/terrain-water-native',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'terrain-water-v1'});
await writeFile(path.join(output,'manifest.json'),manifestBytes);
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),PNG=require('pngjs').PNG;
let page,fixture,focusSession,nativeProtocol;
const workerConsolePage=[];
const results=[],boundaries=[],failures=[];
const summary={manifestHash,fixtureVersion:manifest.version,replayMethodVersion:2,diagnosticOnly:probe||boundaryProbe||continuousCheck,plannedAttemptsPerTool:continuousCheck?2:attempts.length,scaleM:scale,uiScale,selected,attempts:results,boundaries,failures,absentTools:manifest.tools.filter(t=>t.implemented===false).map(t=>t.id),boundaryLimitations:skipBlur?['Trusted window blur is excluded from this run and requires separate native qualification']:[]};
const sourceFiles=['src/app/atlas-deck-surface.ts','src/app/atlas-raster-presentation.ts','src/app/atlas-canvas.ts','src/app/atlas-landscape-ui.ts','src/app/landscape-brush-session.ts','src/app/terrain-brush.ts','src/app/atlas-terrain-prepared-session.ts','src/app/atlas-terrain-model-client.ts','src/app/atlas-terrain-model-worker.ts','src/app/atlas-terrain-prepared-field.ts','src/app/atlas-terrain-field-presentation.ts','src/app/atlas-metric-camera.ts','src/app/atlas-camera.ts','src/app/atlas-camera-navigation.ts','src/app/terrain-author-state.ts','tools/native-session.mjs','tools/process-group.mjs','tools/terrain-water-fixture.mjs','tools/terrain-water-replay.mjs','tools/terrain-water-focus.mjs','tools/terrain-water-focus-reporter.py','tools/test-desktop-terrain-water.mjs'];
summary.sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>{const bytes=await readFile(file),snapshot=path.join(output,'source-snapshot',file);await mkdir(path.dirname(snapshot),{recursive:true});await writeFile(snapshot,bytes);return[file,createHash('sha256').update(bytes).digest('hex')];})));
const dirtyDiff=execFileSync('git',['diff','HEAD'],{cwd:root});summary.dirtyDiffHash=createHash('sha256').update(dirtyDiff).digest('hex');await writeFile(path.join(output,'source.diff'),dirtyDiff);
summary.host={cpus:os.cpus().map(c=>c.model),memoryBytes:os.totalmem(),loadAtStart:os.loadavg(),platform:os.platform(),release:os.release(),node:process.version};
const state=()=>{const db=new Database(fixture.filename,{readonly:true});try{const atlas=db.prepare('SELECT a.revision,c.cursor FROM campaign_atlas a JOIN campaign c ON c.id=a.campaign_id WHERE a.campaign_id=?').get(fixture.campaignId);const records=db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id').all(fixture.campaignId).map(r=>JSON.parse(r.payload));return{...atlas,heights:heightPayloadHash(records)};}finally{db.close();}};
async function phaseDiagnosticSnapshot(stage){
 const renderer=page?await page.evaluate(()=>({worker:window.__twWorkerTrace??[],
  inputAt:window.__tw?.active?.inputAt??null,releaseAt:window.__tw?.active?.releaseAt??null,
  trace:window.__saltTerrainTrace?.events??[]})).catch(error=>({unavailable:String(error)})):null;
 const main=native.app?await native.app.evaluate(()=>({authorReads:globalThis.qaTWAuthorReads??[],
  workerConsole:globalThis.qaTWWorkerConsole??[]})).catch(error=>({unavailable:String(error)})):null;
 return{stage,recordedAt:new Date().toISOString(),clockRule:'Renderer and Main monotonic timestamps are separate; correlate by IDs and wall clock, never subtract them.',
  readRule:'Author checkpoint duration is the full Main handler service, not SQL-only time.',
  renderer,main,pageConsole:[...workerConsolePage]};
}
async function open(){
 page=await native.launch(uiScale);if(process.env.WAYLAND_DEBUG){nativeProtocol=createWriteStream(path.join(output,'wayland-client.log'));native.app.process().stderr.on('data',bytes=>nativeProtocol.write(bytes));}await installTerrainWaterObserver(page,manifest.seed,{continuousCheck});
 if(continuousCheck){
  page.on('console',message=>{try{const text=message.text();if(/^TW06_WORKER_(?:SUMMARY|SETTLE) /.test(text)&&workerConsolePage.length<256)
   workerConsolePage.push({source:'playwright-page',atWall:Date.now(),text});}catch{/* Diagnostics cannot alter the product path. */}});
  await page.addInitScript(()=>{
   const NativeWorker=window.Worker,rows=window.__twWorkerTrace=[];
   const observe=(direction,message)=>{try{
    const capture=message?.capture,active=capture?.active,stroke=active?.stroke,
     samples=stroke?.samples,suffix=capture?.suffix??[],query=message?.query??message?.initial?.query;
    if(rows.length>=2048)return;
    rows.push({direction,at:performance.now(),wall:Date.now(),kind:message?.kind??null,
     epoch:message?.epoch??null,job:message?.job??null,captureId:capture?.id??message?.captureId??null,
     request:Number.isSafeInteger(message?.request)?message.request:null,
     queryRequest:query?.request??null,owner:capture?.owner??query?.owner??message?.owner??null,
     series:capture?.editSeries??query?.series??message?.editSeries??null,
     source:capture?.source??(query?{token:query.token,fence:query.fence,revision:query.revision}:message?.source??null),
     prefix:capture?.prefix??query?.prefix??message?.prefix??null,
     activeSamples:samples?.length??null,lastT:samples?.at(-1)?.t??null,
     closing:active?.closing??null,suffixCount:capture?.suffix?.length??null,
     suffixSamples:suffix.reduce((sum,item)=>sum+(item.stroke?.samples?.length??0),0),
     suffixLastT:suffix.at(-1)?.stroke?.samples?.at(-1)?.t??null,
     bufferCount:message?.buffers?.length??null,
     bufferBytes:message?.buffers?.reduce((sum,entry)=>sum+(entry.buffer?.byteLength??0),0)??null,
     outcome:message?.kind==='failed'?message?.message??null:null});
   }catch{/* Observe only; never break Worker send or receive. */}};
   window.Worker=class extends NativeWorker{
    constructor(...params){
     let prepared=false;
     try{const script=new URL(String(params[0]),location.href);
      prepared=script.pathname.endsWith('/atlas-terrain-model-worker.js');
      if(prepared){script.searchParams.set('terrainPhaseSummary','1');params[0]=script;}
     }catch{/* Keep the original Worker URL if diagnostic parsing fails. */}
     super(...params);this.__twPrepared=prepared;
     if(prepared)this.addEventListener('message',event=>observe('receive',event.data));
    }
    postMessage(message,transfer){
     if(this.__twPrepared)observe('send',message);
     return arguments.length===1?super.postMessage(message):super.postMessage(message,transfer);
    }
   };
  });
  await page.addInitScript(()=>{
  window.__twFirstErrors=[];
  const record=(kind,value)=>{
   try{
   if(window.__twFirstErrors.length>=16)return;
   const surface=window.__twSurface,drawn=surface?.terrainSnapshot,screen=surface?.preparedScreenSnapshot;
   window.__twFirstErrors.push({kind,at:performance.now(),message:String(value),stack:value?.stack??null,
    inputAt:window.__tw?.active?.inputAt??null,releaseAt:window.__tw?.active?.releaseAt??null,
    ready:document.querySelector('#campaign-map')?.dataset.terrainReady??null,
    draft:document.querySelector('#campaign-map')?.dataset.terrainDraft??null,
    preparedInputUsable:surface?.preparedInputUsable??null,
    screen:screen?{content:screen.content,draftRevision:screen.draftRevision,alpha:screen.alpha,endFrame:screen.endFrame}:null,
    drawn:drawn?{content:drawn.content,alpha:drawn.alpha,fieldState:drawn.field?.stateId??null}:null,
    pendingField:!!surface?.pendingField,
    traceStages:window.__saltTerrainTrace?.events?.slice(-12).map(event=>({stage:event.stage,start:event.start,revision:event.revision}))??[]});
   }catch{/* Failure recording must never affect the product's error path. */}
  };
  const original=console.error;console.error=function(...args){record('console.error',args.find(value=>value instanceof Error)??args[0]);return original.apply(this,args);};
  window.addEventListener('error',event=>record('pageerror',event.error??event.message));
  window.addEventListener('unhandledrejection',event=>record('unhandledrejection',event.reason));
  });
 }
 await native.app.evaluate(({ipcMain,BrowserWindow},continuousCheck)=>{
  globalThis.qaTWCommits=[];globalThis.qaTWReferences=[];const original=ipcMain._invokeHandlers.get('atlas:commit');
  ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',async(event,command)=>{
   const row=command.action?.kind==='landscape-height-stroke'?{commandId:command.commandId,terrainStroke:command.terrainStroke,stroke:structuredClone(command.action.stroke)}:null;
   if(row)globalThis.qaTWCommits.push(row);
   try{const answer=await original(event,command);if(row&&continuousCheck)row.answer=structuredClone(answer);return answer;}
   catch(error){if(row&&continuousCheck)row.error=String(error);throw error;}
  });
  if(continuousCheck){
   globalThis.qaTWAuthorReads=[];globalThis.qaTWWorkerConsole=[];
   const contents=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'))?.webContents;
   contents?.on('console-message',(event,...legacy)=>{try{
    const text=typeof event?.message==='string'?event.message:legacy.find(value=>typeof value==='string'&&/^TW06_WORKER_/.test(value));
    if(/^TW06_WORKER_(?:SUMMARY|SETTLE) /.test(text??'')&&globalThis.qaTWWorkerConsole.length<256)
     globalThis.qaTWWorkerConsole.push({source:'electron-webcontents',atWall:Date.now(),text});
   }catch{/* Console evidence must not affect the app. */}});
   const checkpoint=ipcMain._invokeHandlers.get('atlas:author-checkpoint');
   if(!checkpoint)throw Error('Actual author-checkpoint handler missing');
   ipcMain.removeHandler('atlas:author-checkpoint');
   ipcMain.handle('atlas:author-checkpoint',async(...params)=>{
    const q=params[2],started=performance.now(),startedWall=Date.now();
    let answer,error=null;
    try{answer=await checkpoint(...params);return answer;}
    catch(caught){error=String(caught);throw caught;}
    finally{try{
     const value=answer?.ok?answer.value:null,pages=value?.pages??[],ground=value?.ground??[];
     const finished=performance.now();
     if(globalThis.qaTWAuthorReads.length<256)globalThis.qaTWAuthorReads.push({
      started,finished,startedWall,finishedWall:Date.now(),
      durationMs:finished-started,ok:answer?.ok??false,error:error??answer?.error??null,
      query:{owner:q?.owner??null,series:q?.series??null,request:q?.request??null,
       prefix:q?.prefix??null,pixel:q?.pixel??null,box:q?.box??null,lattices:q?.lattices?.length??null,
       source:q?{token:q.token,fence:q.fence,revision:q.revision}:null},
      pageCount:pages.length,groundCount:ground.length,
      pageBytes:pages.reduce((sum,row)=>sum+(row.values?.byteLength??0),0),
      groundBytes:ground.reduce((sum,row)=>sum+(row.values?.byteLength??0),0)});
    }catch{/* Scalar diagnostic collection cannot alter the original result. */}}
   });
   const keep=ipcMain._invokeHandlers.get('atlas:write-reference-keep');
   if(!keep)throw Error('Reference keeper missing');
   ipcMain.removeHandler('atlas:write-reference-keep');
   ipcMain.handle('atlas:write-reference-keep',async(...params)=>{
    const reference=structuredClone(params[1]);
    try{const answer=await keep(...params);globalThis.qaTWReferences.push({reference,answer:structuredClone(answer)});return answer;}
    catch(error){globalThis.qaTWReferences.push({reference,error:String(error)});throw error;}
   });
  }
 },continuousCheck);
 await native.app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setContentSize(size.width,size.height),manifest.window);
 await page.evaluate(({id,scale,continuousCheck})=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-scale/2,y:-scale/3,width:scale,height:scale*2/3,...(continuousCheck?{pose:{tilt:45,rotation:0,exaggeration:1,focusHeightM:250}}:{})})),{id:fixture.campaignId,scale,continuousCheck});
 await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 if(continuousCheck)await page.evaluate(async()=>{
  const runtime=await import('./atlas-deck-runtime.js'),original=runtime.AtlasDeckSurface.create;
  runtime.AtlasDeckSurface.create=async function(options){const surface=await original.call(this,options);window.__twSurface=surface;return surface;};
 });
 await page.locator('.campaign-card').filter({hasText:'Terrain und Wasser v1'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await ready();
 if(continuousCheck)await page.waitForFunction(()=>window.__twSurface?.preparedScreenSnapshot&&
  window.__tw.lastPreparedFrame?.content===window.__twSurface.preparedScreenSnapshot.content,
  null,{timeout:60000,polling:'raf'});
 await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="land"]').click();
 await page.locator('#atlas-units').selectOption('metric');
}
async function ready(expected=state().revision){await page.waitForFunction(expected=>{const map=document.querySelector('#campaign-map');return map?.dataset.terrainReady==='ready'&&map.dataset.terrainQuality==='detail'&&map.dataset.terrainDraft===undefined&&Number(map.dataset.terrainRevision)===expected;},expected,{timeout:60000});}
async function tool(id){
 await page.locator(`[data-tool-select="land-tool"][data-tool-value="${id==='smooth'?'smooth':'height'}"]`).first().click();
 if(id!=='smooth')await setHeightDirection(page,id);
 await setBrushWorldRadius(page,'land-radius',scale*manifest.radiusFraction);
 const settings=manifest.tools.find(t=>t.id===id);
 for(const [field,value]of [['land-height-strength',settings.strength],['land-height-feather',settings.feather],['land-coast-roughness',settings.roughness]])await page.locator('#'+field).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
 await page.locator('#land-height-target-enabled').uncheck();
}
async function settle(expectedRevision){
 const start=performance.now();while(state().revision<expectedRevision&&performance.now()-start<30000)await new Promise(r=>setTimeout(r,25));
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft===undefined,null,{timeout:60000});await ready();
}
async function undo(baseline){
 await page.locator('#atlas-undo').click();await ready();
 const started=performance.now();while(state().heights!==baseline&&performance.now()-started<15000)await new Promise(r=>setTimeout(r,25));
 assert.equal(state().heights,baseline,'Undo must restore the exact baseline height payloads');
 await ready();
}
async function savePartial(){await writeFile(path.join(output,'attempts.json'),JSON.stringify(summary,null,2));}
async function requireUnlockedDesktop(stage){
 const raw=execFileSync('gdbus',['call','--session','--dest','org.freedesktop.ScreenSaver','--object-path','/ScreenSaver','--method','org.freedesktop.ScreenSaver.GetActive'],{encoding:'utf8',timeout:5000}).trim();
 assert(/^\((true|false),\)$/.test(raw),'Desktop screen-lock state must be explicitly known for native focus qualification');
 const check={stage,at:new Date().toISOString(),method:'org.freedesktop.ScreenSaver.GetActive',raw,locked:raw==='(true,)'};
 (summary.desktopLockChecks??=[]).push(check);
 assert.equal(check.locked,false,'Native focus qualification blocked: user desktop session is locked; manual unlock required, no unlock attempted');
}
async function assertContinuousResourceGuard(){
 const file=arg('--resource-contract',null);
 assert(file,'The continuous paint check needs a reviewed --resource-contract FILE.');
 const contract=JSON.parse(await readFile(file,'utf8'));
 assert.equal(contract.schema,'terrain-water-continuous-resource/v1');
 assert.equal(contract.reviewedBeforeLaunch,true);
 const integers=['projectedPeakBytes','cgroupMaxBytes','hostReserveBytes'];
 for(const key of integers)assert(Number.isSafeInteger(contract[key])&&contract[key]>0,`Missing numeric ${key}`);
 assert(contract.hostReserveBytes>=2*1024**3&&
  contract.cgroupMaxBytes>=contract.projectedPeakBytes+512*1024**2);
 assert(contract.classes&&['prepared','authorS7Retention','transport','gpu','workerAndSqlite',
  'browserAndElectron','rawImagesAndWrites','miscReserve'].every(key=>
   Number.isSafeInteger(contract.classes[key])&&contract.classes[key]>=0));
 assert(Object.values(contract.classes).reduce((sum,value)=>sum+value,0)<=contract.projectedPeakBytes,
  'The reviewed peak must include every retained class.');
 const group=await currentProcessGroup();assert(group!=='/'&&group.length>12);
 const directory='/sys/fs/cgroup'+group;
 const limit=Number((await readFile(path.join(directory,'memory.max'),'utf8')).trim());
 assert.equal(limit,contract.cgroupMaxBytes,'The effective external MemoryMax differs from the reviewed cap.');
 const compositorPid=Number(execFileSync('gdbus',['call','--session','--dest','org.freedesktop.DBus',
  '--object-path','/org/freedesktop/DBus','--method','org.freedesktop.DBus.GetConnectionUnixProcessID','org.kde.KWin'],
  {encoding:'utf8',timeout:5000}).match(/uint32 (\d+)/)?.[1]);
 assert(Number.isSafeInteger(compositorPid)&&compositorPid>0);
 const compositorGroup=(await readFile(`/proc/${compositorPid}/cgroup`,'utf8')).split('\n')
  .find(line=>line.startsWith('0::'))?.slice(3);
 assert(compositorGroup===group||compositorGroup?.startsWith(group+'/'),
  'The private compositor is outside the guarded test scope.');
 const current=Number((await readFile(path.join(directory,'memory.current'),'utf8')).trim());
 const available=Number((await readFile('/proc/meminfo','utf8')).match(/^MemAvailable:\s+(\d+) kB/m)?.[1])*1024;
 assert(Number.isFinite(available)&&available-(contract.projectedPeakBytes-current)>=contract.hostReserveBytes,
  'The reviewed peak would consume the required host reserve.');
 const events=Object.fromEntries((await readFile(path.join(directory,'memory.events'),'utf8')).trim()
  .split('\n').map(line=>{const [key,value]=line.split(/\s+/);return[key,Number(value)];}));
 return{path:file,contract,group,compositorPid,currentAtStart:current,availableAtStart:available,
  eventsAtStart:events};
}
async function checkContinuousResourceGuard(phase){
 const guard=summary.continuousResourceGuard,directory='/sys/fs/cgroup'+guard.group;
 const events=Object.fromEntries((await readFile(path.join(directory,'memory.events'),'utf8')).trim()
  .split('\n').map(line=>{const [key,value]=line.split(/\s+/);return[key,Number(value)];}));
 const current=Number((await readFile(path.join(directory,'memory.current'),'utf8')).trim());
 const available=Number((await readFile('/proc/meminfo','utf8')).match(/^MemAvailable:\s+(\d+) kB/m)?.[1])*1024;
 const row={phase,at:new Date().toISOString(),current,available,events};
 (summary.continuousResourceCheckpoints??=[]).push(row);
 assert(available>=guard.contract.hostReserveBytes&&
  ['high','max','oom','oom_kill'].every(key=>(events[key]??0)===(guard.eventsAtStart[key]??0)),
  'The protected scope had a memory trigger or lost the required host reserve.');
 return row;
}
async function assertContinuousChildrenGuarded(){
 const group=summary.continuousResourceGuard.group,metrics=await native.app.evaluate(({app})=>app.getAppMetrics());
 assert(metrics.length>=2,'Electron child process coverage is missing.');
 for(const metric of metrics){
  const childGroup=(await readFile(`/proc/${metric.pid}/cgroup`,'utf8')).split('\n')
   .find(line=>line.startsWith('0::'))?.slice(3);
  assert(childGroup===group||childGroup?.startsWith(group+'/'),
   `Electron process ${metric.pid} is outside the guarded scope.`);
 }
 return metrics.map(({pid,type})=>({pid,type}));
}
function continuousAttempt(offset,id){
 const source=manifest.attempts.find(attempt=>attempt.id===3);
 assert(source&&source.kind==='dense'&&source.durationMs===300);
 const point=t=>{
  const path=source.path;
  const next=path.findIndex(sample=>sample.atMs>=t);
  if(next<0)return path.at(-1);
  if(next===0)return path[0];
  const a=path[next-1],b=path[next],ratio=(t-a.atMs)/(b.atMs-a.atMs);
  return{x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};
 };
 return{id,kind:'dense-8ms-continuous',seed:source.seed,durationMs:300,
  sourceAttemptId:source.id,offsetX:offset,
  path:[...Array.from({length:38},(_,i)=>{const atMs=i*8,p=point(atMs);return{atMs,x:p.x+offset,y:p.y};}),
   {atMs:300,x:point(300).x+offset,y:point(300).y}]};
}
async function writeRawFrame(name,size,rgba){
 assert.equal(rgba.length,size*size*4);
 const png=new PNG({width:size,height:size});
 for(let y=0;y<size;y++)png.data.set(rgba.slice((size-1-y)*size*4,(size-y)*size*4),y*size*4);
 const bytes=PNG.sync.write(png),file=path.join(output,name);
 await writeFile(file,bytes);
 return{file:name,sha256:createHash('sha256').update(bytes).digest('hex'),rawSha256:createHash('sha256').update(Buffer.from(rgba)).digest('hex')};
}
async function productTerrainPick(point){
 return page.evaluate(point=>{
  const surface=window.__twSurface,frame=surface?.frame,input=document.querySelector('#campaign-map');
  if(!surface||!frame||!input)return{error:'Product terrain surface, frame or input is missing'};
  const bounds=input.getBoundingClientRect(),canvas=surface.canvas.getBoundingClientRect();
  // Match the normal pointer's client coordinates and RasterPresentation.pixel().
  const client={x:bounds.left+bounds.width*(.5+point.x),y:bounds.top+bounds.height/2+point.y*bounds.width};
  const pixel={x:client.x-bounds.left,y:client.y-bounds.top};
  const drawn=surface.terrainSnapshot,prepared=surface.preparedScreenSnapshot;
  let segment=null,terrain=null,rayError=null;
  try{segment=frame.ray(pixel);if(segment)terrain=surface.terrainRay(segment);}
  catch(error){rayError=String(error);}
  return{client,pixel,inputBounds:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},
   canvasBounds:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},
   gate:{frameUsable:surface.frameUsable,preparedInputUsable:surface.preparedInputUsable,
    contextAvailable:surface.contextAvailable,pendingField:!!surface.pendingField,
    pendingEndFrameDraws:!!surface.pendingField?.field?.endFrameDraws,
    preparedRestorePending:surface.preparedRestorePending,fieldPrepared:!!drawn?.field?.prepared,
    currentPrepared:!!surface.terrainField?.prepared},
   frame:{camera:frame.camera,viewport:frame.viewport,origin:frame.origin,near:frame.near,far:frame.far,
    viewMatrix:Array.from(frame.viewMatrix),projectionMatrix:Array.from(frame.projectionMatrix)},
   prepared,drawn:drawn?{content:drawn.content,alpha:drawn.alpha,complete:drawn.complete,
    fieldState:drawn.field?.stateId??null,layerId:drawn.field?.layerId??null}:null,
   ready:input.dataset.terrainReady,segment,rayError,
   hit:terrain?{point:{x:terrain.point[0],y:terrain.point[1],heightM:terrain.point[2]},
    segmentFraction:terrain.segmentFraction,sourceBank:terrain.sourceBank,sourceIndex:terrain.sourceIndex}:null};
 },point);
}
async function runContinuousPaintCheck(){
 summary.continuousElectronProcesses=await assertContinuousChildrenGuarded();
 await tool('raise');await ready();
 assert.equal(Number(await page.locator('#land-sea-level').inputValue()),0);
 const firstFrame=await page.evaluate(()=>window.__tw.lastPreparedFrame);
 assert(firstFrame&&Math.abs(firstFrame.camera.metersPerPixel*firstFrame.viewport.width-20)<.1&&
  firstFrame.camera.tilt===45&&firstFrame.camera.rotation===0&&firstFrame.camera.exaggeration===1,
  'The confirmed productive 20m/45° camera frame is missing.');
 const topologyEnvelope=summary.continuousResourceGuard.contract.counts?.preparedTopologyEnvelope;
 assert(topologyEnvelope,'The reviewed prepared topology envelope is missing.');
 const initialTopology=await page.evaluate(()=>{
  const surface=window.__twSurface,drawn=surface?.terrainSnapshot,screen=surface?.preparedScreenSnapshot,
   prepared=drawn?.field?.prepared,geometry=prepared?.source;
  if(!geometry||!screen||screen.content!==drawn.content)return null;
  return{content:screen.content,vertices:geometry.vertices.length/14,indices:geometry.indices.length,
   rayNodes:geometry.rayNodes.length/8,triangles:geometry.rayTriangles.length,
   newSources:geometry.newSources.length,oldSources:geometry.oldSources.length,
   maxFamilyNodes:geometry.newSources.length*4225,
   retainedBases:surface.preparedResourceInventory().retainedBases.length};
 });
 assert(initialTopology&&initialTopology.content===firstFrame.content&&
  ['vertices','indices','rayNodes','triangles'].every(key=>
   Number.isSafeInteger(initialTopology[key])&&initialTopology[key]>0&&
   initialTopology[key]<=topologyEnvelope[key])&&
  initialTopology.newSources<=32&&initialTopology.oldSources<=32&&
  initialTopology.maxFamilyNodes<=topologyEnvelope.nodes&&
  initialTopology.retainedBases<=topologyEnvelope.simultaneousGroups,
  'The actually drawn prepared topology exceeds the reviewed pre-stroke envelope.');
 const record={schema:'terrain-water-continuous-bediencheck/v1',qualification:false,
  requestedPose:{tilt:45,rotation:0,exaggeration:1,focusHeightM:250},firstFrame,initialTopology,
  sourceAttemptId:3,sourceManifestSha256:manifestHash,strokes:[],initial:state(),
  inputProvenance:'Electron Main webContents.sendInputEvent (Chromium), not physical OS mouse',
  interpretation:'A native UI and image review of two continued strokes; no first-pixel, p95, 30-trial or delivery claim.'};
 for(const [index,offset] of [[1,0],[2,.12]]){
  const attempt=continuousAttempt(offset,`continuous-${index}`),before=state();
  const pickBefore=await productTerrainPick(attempt.path[0]);
  if(!pickBefore.gate?.preparedInputUsable||!pickBefore.hit){
   await writeFile(path.join(output,`continuous-${index}-product-pick-failure.json`),JSON.stringify({phase:'before-pointerdown',pickBefore,record},null,2));
  }
  assert(pickBefore.gate?.preparedInputUsable&&pickBefore.hit,'The starting brush point has no product terrain ray hit.');
  const box=await page.locator('#campaign-map').boundingBox();
  const input=await replayTerrainWaterAttempt(page,native.app,attempt,box,uiScale);
  const firstErrors=await page.evaluate(()=>window.__twFirstErrors??[]);
  await writeFile(path.join(output,`continuous-${index}-phase-after-input.json`),
   JSON.stringify(await phaseDiagnosticSnapshot(`after-input-${index}`),null,2));
  await writeFile(path.join(output,`continuous-${index}-arrival-and-errors.json`),JSON.stringify({
   planned:attempt,mainReplay:input.mainReplay,events:input.events,guard:input.guard,
   inputAt:input.inputAt,releaseAt:input.releaseAt,rawError:input.rawError,
   rawFrames:input.rawFrames?.map(({rgba,...frame})=>frame),firstErrors,
   trace:await page.evaluate(()=>window.__saltTerrainTrace?.events??[])
  },null,2));
  const frames=input.rawFrames??[],seen=new Set(),rawImages=[];
  if(Array.isArray(input.rawBaseline))rawImages.push({...await writeRawFrame(`continuous-${index}-pointerdown.png`,input.rawSize,input.rawBaseline),
   binding:input.baselineFrame,at:input.inputAt});
  for(let i=0;i<frames.length;i++){
   const frame=frames[i];rawImages.push({...await writeRawFrame(`continuous-${index}-draft-${String(i+1).padStart(2,'0')}.png`,input.rawSize,frame.rgba),
    binding:frame.binding,at:frame.binding.at,readMs:frame.readMs});seen.add(rawImages.at(-1).rawSha256);
  }
  await writeFile(path.join(output,`continuous-${index}-raw-image-bindings.json`),JSON.stringify(rawImages,null,2));
  assert(!input.error&&!input.rawError&&input.trusted&&input.dropped===0,
   'The normal continuous pointer sequence or raw terrain capture failed.');
  const moves=input.events.filter(event=>event.type==='pointermove');
  assert(input.mainReplay.length===attempt.path.length+1&&
   input.mainReplay[0]?.type==='mouseDown'&&input.mainReplay.at(-1)?.type==='mouseUp'&&
   input.mainReplay.at(-1)?.atMs===300&&
   input.mainReplay.slice(1,-1).every((event,at)=>event.type==='mouseMove'&&event.atMs===attempt.path[at+1].atMs)&&
   input.events[0]?.type==='pointerdown'&&input.events[0].trusted&&
   moves.length>0&&moves.every(event=>event.trusted)&&
   input.events.at(-1)?.type==='pointerup'&&input.events.at(-1).trusted&&
   input.events.at(-1).at>moves[0].at,
   'The complete 300ms/8ms input plan did not arrive.');
  for(let i=0;i<frames.length;i++){
   const frame=frames[i];assert(frame.binding.at<input.releaseAt&&
    moves.some(move=>move.at<frame.binding.at),'A purported active Draft frame was not drawn during movement.');
  }
  assert(frames.length>=2&&new Set(frames.map(frame=>frame.binding.draftRevision)).size>=2&&seen.size>=2&&
   [...seen].some(digest=>digest!==rawImages[0]?.rawSha256),
   'Two distinct, bound prepared Draft images during movement are missing; visual terrain review remains open.');
  await settle(before.revision+1);
  await page.waitForFunction(expected=>{
   const map=document.querySelector('#campaign-map'),screen=window.__twSurface?.preparedScreenSnapshot;
   return Number(map?.dataset.terrainRevision)===expected&&map?.dataset.terrainReady==='ready'&&
    screen?.alpha===1&&screen.endFrame===true;
  },before.revision+1,{timeout:60000,polling:'raf'});
  const after=state();assert.equal(after.revision,before.revision+1);
  assert.notEqual(after.heights,before.heights,'The height change was not saved canonically.');
  const commits=await native.app.evaluate(()=>globalThis.qaTWCommits);
  const refs=await native.app.evaluate(()=>globalThis.qaTWReferences);
  const commit=commits[index-1],reference=refs.find(row=>row.reference?.commandId===commit?.commandId);
  assert.equal(commits.length,index,'Exactly one new height commit is required per stroke.');
  assert(commit?.answer?.ok===true&&commit.answer.value?.commandId===commit.commandId&&
   reference?.answer?.ok===true&&reference.reference.fingerprint,
   'The matching reference fingerprint and actual commit acknowledgement are missing.');
  const screen=await productTerrainPick(attempt.path.at(-1));
  if(!screen.gate?.preparedInputUsable||!screen.hit){
   await writeFile(path.join(output,`continuous-${index}-product-pick-failure.json`),JSON.stringify({phase:'after-commit',screen,record},null,2));
  }
  assert(screen.ready==='ready'&&screen.prepared?.alpha===1&&screen.prepared?.endFrame===true&&screen.hit,
   'The committed terrain screen or product pick is missing.');
  await native.capture(page,`continuous-${index}-committed.png`);
  record.strokes.push({attempt,before,after,pickBefore,input:{...input,rawBaseline:undefined,
   rawFrames:frames.map(({rgba,...frame})=>frame)},rawImages,commit,reference,screen});
  await checkContinuousResourceGuard(`after-stroke-${index}`);
  await writeFile(path.join(output,'continuous-paint-check.json'),JSON.stringify(record,null,2));
 }
 record.final=state();assert.equal(record.strokes.length,2);
 summary.continuousPaintCheck=record;
 await writeFile(path.join(output,'continuous-phase-final.json'),
  JSON.stringify(await phaseDiagnosticSnapshot('before-normal-close'),null,2));
 await native.close();
 await checkContinuousResourceGuard('after-normal-close');
 summary.method='One private native 20m continued-paint Bediencheck: Main-timed 300ms/8ms input, real prepared AfterRender raw images, visible image review and two canonical commits. It is not the 30-trial F gate.';
}

try{
 if(!probe&&!skipBlur&&!continuousCheck)await requireUnlockedDesktop('before-launch');
 if(continuousCheck)summary.continuousResourceGuard=await assertContinuousResourceGuard();
 fixture=await createTerrainWaterFixture(native.profile);summary.fixture=fixture;assert.equal(state().heights,fixture.fixtureHash);
 await open();await native.capture(page,'01-fixture.png');
 summary.display=await page.evaluate(()=>{const c=document.querySelector('#atlas-terrain-spatial canvas'),g=c.getContext('webgl2'),d=g.getExtension('WEBGL_debug_renderer_info');return{innerWidth,innerHeight,devicePixelRatio,canvas:c.getBoundingClientRect().toJSON(),buffer:[g.drawingBufferWidth,g.drawingBufferHeight],gpu:d?{vendor:g.getParameter(d.UNMASKED_VENDOR_WEBGL),renderer:g.getParameter(d.UNMASKED_RENDERER_WEBGL)}:null};});
 if(continuousCheck)assert.match(summary.display.gpu?.renderer??'',/Intel.*620/i,
  'The early Bediencheck requires the actual UHD620 renderer.');
 if(!boundaryProbe){assert.equal(summary.display.innerWidth,manifest.window.width/uiScale);assert.equal(summary.display.innerHeight,manifest.window.height/uiScale);}
 else summary.display.boundaryGeometryNote='Diagnostic boundary-only run records actual compositor-constrained geometry; no baseline timing samples';
 summary.gpuInfo=await native.app.evaluate(({app})=>app.getGPUInfo('complete'));
 summary.host.metricsAtBaselineStart=await native.app.evaluate(({app})=>app.getAppMetrics());
 if(continuousCheck)await runContinuousPaintCheck();
 else{
 for(const id of selected){
  await tool(id);
  for(const attempt of attempts){
   if(existsSync(path.join(output,'STOP'))){summary.stopped=true;await native.close();throw Error('Explicitly stopped at an attempt boundary; incomplete run, no replacement samples');}
   await ready();const before=state();assert.equal(before.heights,fixture.fixtureHash);
   const box=await page.locator('#campaign-map').boundingBox();
   const record={tool:id,scaleM:scale,uiScale,id:attempt.id,before};results.push(record);
   await replayTerrainWaterAttempt(page,native.app,attempt,box,uiScale);
   try{await settle(before.revision+1);}catch(error){record.settleError=error.message;}
   record.input=await terrainWaterAttemptEvidence(page);record.after=state();
   const first=record.input?.events?.[0];assert(first?.trusted,'Main-generated pointer input must reach the native renderer as trusted');
   assert(Math.abs(first.x-(box.x+box.width*(.5+attempt.path[0].x)))<=1/uiScale&&Math.abs(first.y-(box.y+box.height*.5+attempt.path[0].y*box.width))<=1/uiScale,'Main DIP/zoom coordinates must match planned renderer CSS coordinates');
   if(record.after.revision>before.revision){record.command=await native.app.evaluate(()=>globalThis.qaTWCommits.at(-1));assert.equal(record.command.stroke.seed,attempt.seed);assert.equal(record.command.stroke.mode,id);assert.equal(record.command.stroke.radius,scale*manifest.radiusFraction);}
   record.traceDropped=record.input?.dropped;
   record.acceptedExactlyOnce=record.after.revision===before.revision+1&&record.after.heights!==before.heights;
   record.visible=record.input?.visible??null;
   if(!record.acceptedExactlyOnce||!record.visible||record.traceDropped!==0)failures.push({tool:id,id:attempt.id,acceptedExactlyOnce:record.acceptedExactlyOnce,visible:!!record.visible,guard:record.input?.guard,traceDropped:record.traceDropped});
   if(record.after.heights!==before.heights){await undo(fixture.fixtureHash);}else await ready();
   await savePartial();console.log(JSON.stringify({tool:id,id:attempt.id,accepted:record.acceptedExactlyOnce,visibleMs:record.visible?.latencyMs,guard:record.input?.guard}));
  }
 }
 await native.capture(page,'02-baseline-reset.png');
 summary.host.metricsAtBaselineEnd=await native.app.evaluate(({app})=>app.getAppMetrics());
 summary.timings=selected.map(tool=>{const samples=results.filter(r=>r.tool===tool),visible=samples.map(r=>r.visible?.latencyMs??Infinity).sort((a,b)=>a-b),commit=samples.map(r=>r.input?.commit?.afterReleaseMs??Infinity).sort((a,b)=>a-b);return{tool,attempts:samples.length,missing:samples.filter(r=>!r.visible||!r.acceptedExactlyOnce).length,p95VisibleMs:visible[Math.ceil(visible.length*.95)-1]===Infinity?null:visible[Math.ceil(visible.length*.95)-1],p95CommitAfterReleaseMs:commit[Math.ceil(commit.length*.95)-1]===Infinity?null:commit[Math.ceil(commit.length*.95)-1]};});
 if(!probe){
 // Correctness cases use the same real input and world; cancellation boundary
 // injection is reported separately from the thirty baseline attempts.
 await tool('raise');
 const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 const down=async()=>{await ready();await page.mouse.move(x,y);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='height');};
 let before;
 if(!cancelBlurOnly){before=state();await down();await page.keyboard.press('Escape');await page.mouse.up();await ready();
 assert.equal(state().heights,before.heights);assert.equal(state().revision,before.revision);boundaries.push({kind:'Escape',before,after:state()});
 }
 if(!blurOnly){before=state();await down();await page.evaluate(()=>{const map=document.querySelector('#campaign-map');map.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:window.__tw.lastPointerId}));});await settle(before.revision+1);
 assert.equal(state().revision,before.revision+1);const cancelled=state(),cancelWrites=await native.app.evaluate(()=>globalThis.qaTWCommits.length);
 await page.mouse.up();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(state().revision,cancelled.revision);assert.equal(await native.app.evaluate(()=>globalThis.qaTWCommits.length),cancelWrites);
 boundaries.push({kind:'pointercancel',injected:true,committedBeforePointerup:true,before,after:state()});await savePartial();console.log('pointercancel committed before pointerup');await undo(fixture.fixtureHash);
 }
 let blurred;
 if(!skipBlur){
 await requireUnlockedDesktop('before-focus-sequence');
 focusSession=await page.context().newCDPSession(page);await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 await native.app.evaluate(({BrowserWindow})=>{globalThis.qaTWNativeFocus=[];for(const win of BrowserWindow.getAllWindows())for(const kind of ['focus','blur'])win.on(kind,()=>globalThis.qaTWNativeFocus.push({kind,title:win.getTitle(),at:performance.now(),focused:win.isFocused(),contentsFocused:win.webContents.isFocused()}));});
 const focusState=async()=>({renderer:await page.evaluate(()=>({at:performance.now(),focused:document.hasFocus(),events:window.__tw.boundaries.filter(e=>e.target==='window'&&(e.kind==='focus'||e.kind==='blur'))})),native:await native.app.evaluate(({BrowserWindow,app})=>({ozoneRequested:app.commandLine.getSwitchValue('ozone-platform'),windows:BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),focused:w.isFocused(),contentsFocused:w.webContents.isFocused(),captured:w.webContents.isBeingCaptured(),visible:w.isVisible()})),events:globalThis.qaTWNativeFocus}))});
 summary.focusInitial=await focusState();
 const mainTitle='Terrain QA Hauptfenster '+native.app.process().pid;await native.app.evaluate(({BrowserWindow},title)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setTitle(title),mainTitle);
 // Playwright's prior focus emulation can leave Chromium's focus cache behind
 // KWin. Acquire a real away/back transition before starting the gesture.
 await native.app.evaluate(async({BrowserWindow})=>{
  const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));
  const focus=new BrowserWindow({parent:main,width:240,height:120,title:'Terrain QA Fokusprüfung',show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});globalThis.qaTWFocusWindow=focus;
  await focus.loadURL('about:blank');focus.setTitle('Terrain QA Fokusprüfung');focus.show();
 });
 const focusSequenceStarted=await page.evaluate(()=>performance.now());
 summary.focusAway=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:'Terrain QA Fokusprüfung'});
 summary.focusAway.state=await focusState();
 summary.focusBefore=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:mainTitle});await page.waitForFunction(()=>document.hasFocus());
 summary.focusBefore.state=await focusState();
 const kwinClass=summary.focusBefore.report.after.className;
 summary.nativeBackend={requested:process.env.QA_OZONE_PLATFORM??'default',electronSwitch:summary.focusBefore.state.native.ozoneRequested,kwinClass,observed:/KWin::XdgToplevelWindow/.test(kwinClass)?'wayland':/KWin::X11Window/.test(kwinClass)?'x11':'unresolved'};
 if(process.env.QA_OZONE_PLATFORM==='wayland')assert.equal(summary.nativeBackend.observed,'wayland','Explicit Wayland qualification requires compositor evidence of a native Wayland client');
 await page.waitForFunction(start=>window.__tw.boundaries.some(e=>e.kind==='focus'&&e.target==='window'&&e.trusted&&e.at>=start),focusSequenceStarted,{timeout:5000});
 summary.focusBefore.rendererFocused=await page.evaluate(()=>document.hasFocus());
 before=state();await down();const blurStarted=await page.evaluate(()=>performance.now());
 summary.focusStimulus=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:'Terrain QA Fokusprüfung'});
 summary.focusStimulus.state=await focusState();
 await page.waitForFunction(start=>window.__tw.boundaries.some(e=>e.kind==='blur'&&e.target==='window'&&e.trusted&&e.at>=start),blurStarted);
 await settle(before.revision+1);assert.equal(state().revision,before.revision+1);blurred=state();const blurWrites=await native.app.evaluate(()=>globalThis.qaTWCommits.length),blurEvent=await page.evaluate(start=>window.__tw.boundaries.find(e=>e.kind==='blur'&&e.target==='window'&&e.trusted&&e.at>=start),blurStarted);
 await native.app.evaluate(({BrowserWindow})=>{globalThis.qaTWFocusWindow.close();const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));main.show();main.focus();});
 summary.focusReturned=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:mainTitle});await page.waitForFunction(()=>document.hasFocus());
 await page.mouse.up();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(state().revision,blurred.revision);assert.equal(await native.app.evaluate(()=>globalThis.qaTWCommits.length),blurWrites);
 boundaries.push({kind:'blur',committedBeforePointerup:true,event:blurEvent,before,after:state()});await savePartial();console.log('trusted window blur committed before pointerup');await undo(fixture.fixtureHash);
 await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:true});await focusSession.detach();focusSession=null;}
 if(!cancelBlurOnly){if(!skipBlur){await page.locator('#atlas-redo').click();await ready(blurred.revision+2);assert.equal(state().heights,blurred.heights);await undo(fixture.fixtureHash);}
 // Keep the first durable boundary occupied: a released stroke, another
 // released stroke and Escape of a third open stroke must have distinct owners.
 await native.app.evaluate(({ipcMain})=>{
  globalThis.qaTWQueued=[];globalThis.qaTWQueuedOriginal=ipcMain._invokeHandlers.get('atlas:commit');
  ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',async(event,command)=>{
   if(command.action?.kind==='landscape-height-stroke'){
    globalThis.qaTWQueued.push(command.commandId);
    if(globalThis.qaTWQueued.length===1)await new Promise(resolve=>{globalThis.qaTWRelease=resolve;});
   }
   return globalThis.qaTWQueuedOriginal(event,command);
  });
 });
 before=state();
 for(const offset of [0,30]){await page.mouse.move(x+offset,y);await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up();}
 await page.mouse.move(x-30,y);await page.mouse.down();await page.waitForTimeout(180);await page.keyboard.press('Escape');await page.mouse.up();
 assert.equal(state().revision,before.revision);assert.equal(await native.app.evaluate(()=>globalThis.qaTWQueued.length),1);
 await native.app.evaluate(()=>globalThis.qaTWRelease());await settle(before.revision+2);
 assert.equal(state().revision,before.revision+2);assert.equal(await native.app.evaluate(()=>globalThis.qaTWQueued.length),2);
 boundaries.push({kind:'queued-release-release-Escape',before,after:state(),writes:2});
 await native.app.evaluate(({ipcMain})=>{ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',globalThis.qaTWQueuedOriginal);});
 await page.locator('#atlas-undo').click();await ready(before.revision+3);await undo(fixture.fixtureHash);
 // Every core mode participates in the persisted final state, with exact
 // Undo/Redo comparisons before the fresh native process reopens that state.
 for(const id of selected){await tool(id);before=state();await down();await page.waitForTimeout(180);await page.mouse.up();await settle(before.revision+1);const after=state();assert.notEqual(after.heights,before.heights);await undo(before.heights);await page.locator('#atlas-redo').click();await ready(after.revision+2);assert.equal(state().heights,after.heights);boundaries.push({kind:'undo-redo',tool:id,before,after:state()});}
 const saved=state();
 summary.boundaryEvents=await page.evaluate(()=>window.__tw.boundaries);
 await native.capture(page,'03-redo.png');await native.close();await open();assert.equal(state().heights,saved.heights);await native.capture(page,'04-reopened.png');await native.close();
 }else{summary.boundaryEvents=await page.evaluate(()=>window.__tw.boundaries);await native.capture(page,'03-cancel-blur.png');await native.close();}
 }else await native.close();
 summary.method='Main schedules complete trusted native input plan without per-event protocol roundtrips; renderer arrival times and exact CSS coordinates verified. Pointer event performance.now() to returned synchronous readPixels proof of changed local-height 16x16 interior framebuffer; afterRender time and observer overhead separate. No reads after first proof and no physical-display latency claim. Same fixture restored by exact Undo hash after every attempt. Missing samples remain failures.';
 }
 summary.host.loadAtEnd=os.loadavg();await savePartial();assert.deepEqual(failures,[]);
 await native.finish(summary);console.log(output);
}catch(error){
 if(continuousCheck){summary.phaseDiagnostic=await phaseDiagnosticSnapshot('failure-before-cleanup');
  await writeFile(path.join(output,'continuous-phase-final.json'),JSON.stringify(summary.phaseDiagnostic,null,2));}
 summary.error=error.stack;summary.lastState=fixture?state():null;if(page)summary.renderer=await page.evaluate(()=>({focused:document.hasFocus(),map:document.querySelector('#campaign-map')?.dataset,status:document.querySelector('#status')?.textContent,save:document.querySelector('#atlas-save-status')?.textContent,boundaryEvents:window.__tw?.boundaries,firstErrors:window.__twFirstErrors??[],active:window.__tw?.active?{...window.__tw.active,before:undefined,pixels:undefined,gl:undefined,rawFrames:window.__tw.active.rawFrames?.map(({rgba,...frame})=>frame)}:null,trace:window.__saltTerrainTrace})).catch(()=>null);
 if(native.app)await native.app.evaluate(()=>globalThis.qaTWFocusWindow?.destroy()).catch(()=>{});
 if(focusSession){await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:true}).catch(()=>{});await focusSession.detach().catch(()=>{});focusSession=null;}
 await savePartial();await native.fail(error);
 if(continuousCheck)await writeFile(path.join(output,'continuous-worker-console-after-cleanup.json'),
  JSON.stringify(workerConsolePage,null,2));
 console.log(output);throw error;
}finally{await native.dispose();if(nativeProtocol)await new Promise(resolve=>nativeProtocol.end(resolve));}
