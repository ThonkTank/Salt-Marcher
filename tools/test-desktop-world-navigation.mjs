// Sparse world map, real main Atlas, and a 2,500-mile brush. No user profile.
import {buildDraftProbe,terrainDraftPixels} from './terrain-draft-probe.mjs';
import {buildRenderReuseProbe,terrainRenderReusePixels} from './terrain-render-reuse-probe.mjs';
import {terrainPixelReadbackPixels} from './terrain-pixel-readback-probe.mjs';
import {createNativeSession} from './native-session.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {installCameraFrameProbe} from './atlas-camera-frame-probe.mjs';
import {buildHexGridProbe} from './terrain-hex-grid-probe.mjs';
import {buildContourProbe,terrainContourPixels} from './terrain-contour-probe.mjs';
import {buildDetailProbe,terrainDetailPixels} from './terrain-detail-probe.mjs';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),require=createRequire(root+'/package.json');
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/world-navigation');
const cameraTrace=process.env.WORLD_CAMERA_TRACE;
assert(!cameraTrace||['1','current'].includes(cameraTrace),'Unknown camera trace mode');
const readbackMode=process.env.WORLD_READBACK??'legacy',profileEnabled=process.env.WORLD_PROFILE===undefined?readbackMode==='legacy':process.env.WORLD_PROFILE==='1';
assert(['legacy','sync','async'].includes(readbackMode),'Unknown pixel readback mode');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export {CampaignStore} from './src/app/storage/store';export {applyTerrainBrush} from './src/app/terrain-brush';export {heightRecord} from './src/app/terrain-height';export {emptyRecord,bounds} from './src/app/atlas-landscape';export {vegetationSpec} from './src/app/vegetation';"},outfile:'.build/world-navigation-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,applyTerrainBrush,heightRecord,emptyRecord,bounds,vegetationSpec}=require(root+'/.build/world-navigation-store.cjs');
const native=await createNativeSession({root,output:out,name:'world-navigation'}),store=new CampaignStore(native.profile+'/workbench.sqlite');
const campaign=store.create('Sparse world navigation'),token=store.activate(campaign.id).token,radius=4023360;
const records=applyTerrainBrush([],{mode:'raise',radius,strength:500,feather:1,samples:[{x:0,y:0,t:0},{x:0,y:0,t:3000}]});
for(const record of records)store.executeAtlasCommit({token,campaignId:campaign.id,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record}});
const populated=process.env.WORLD_POPULATED==='1';
if(populated){
 const put=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
 const save=record=>{const b=bounds(record);put.run(campaign.id,record.id,1,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(record));};
 store.db.transaction(()=>{for(let y=-16;y<16;y++)for(let x=-16;x<16;x++){
  const px=x*1048576,py=y*1048576;
  save(heightRecord(px,py,16384,Float32Array.from({length:4096},(_,i)=>200+150*Math.sin((px+i%64*16384)/1500000)*Math.cos((py+Math.floor(i/64)*16384)/1700000))));
  save({...emptyRecord('vegetation'),id:'forest:'+x+':'+y,vegetation:vegetationSpec('deciduous',(x+16)*32+y+17),values:{terrain:'forest'},polygons:[{outer:[{x:px,y:py},{x:px+750000,y:py},{x:px+700000,y:py+650000},{x:px,y:py+600000}],holes:[]}]});
  save({...emptyRecord('road'),id:'road:'+x+':'+y,width:8,points:[{x:px,y:py},{x:px+1000000,y:py+900000}]});
 }})();
}
const large=process.env.WORLD_LARGE==='1';
if(large){
const putLarge=store.db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?)');
const saveLarge=record=>{const b=bounds(record);putLarge.run(campaign.id,record.id,1,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(record));};
store.db.transaction(()=>{
 for(let i=0;i<100000;i++){
  const x=-20000000+(i%500)*80000,y=-10000000+Math.floor(i/500)*100000;
  saveLarge({...emptyRecord('patch'),id:'world-patch:'+i,name:'Waldfläche '+i,values:{terrain:'forest'},polygons:[{outer:[{x,y},{x:x+60000,y},{x:x+60000,y:y+80000},{x,y:y+80000}],holes:[]}]});
 }
 for(let i=0;i<5000;i++){
  const x=-20000000+(i%100)*400000,y=-10000000+Math.floor(i/100)*400000;
  saveLarge({...emptyRecord('place'),id:'world-place:'+i,name:'Ort '+i,points:[{x,y}]});
 }
})();
}
const recordCount=store.db.prepare('SELECT count(*) n FROM atlas_landscape WHERE campaign_id=?').get(campaign.id).n;
store.tutorial('skipped');store.close();
const result={radius,records:recordCount,populated,large,measurement:{readbackMode,profileEnabled},metrics:[],errors:[]};let page;
const hexProbe=buildHexGridProbe();
const contourProbe=buildContourProbe();
const detailProbe=buildDetailProbe();
const draftProbe=buildDraftProbe();
const renderReuseProbe=buildRenderReuseProbe();
const responseProbe=readbackMode==='legacy'?null:require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export {installTerrainResponseProbe} from './tools/terrain-pixel-readback.mjs';"},bundle:true,format:'iife',globalName:'TerrainResponseProbe',write:false}).outputFiles[0].text;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 page=await native.launch();await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900));
 if(process.env.SALTMARCHER_TERRAIN_TRACE==='1')await native.app.evaluate(()=>{
  const {Worker}=process.getBuiltinModule('node:worker_threads'),post=Worker.prototype.postMessage,seen=new WeakSet();global.__worldWorkerTrace=[];
  Worker.prototype.postMessage=function(job,...args){if(!seen.has(this)){seen.add(this);this.on('message',reply=>{if(reply?.terrainTrace)global.__worldWorkerTrace.push(reply.terrainTrace);});}return post.call(this,job,...args);};
 });
 page.on('pageerror',e=>result.errors.push(e.stack));
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-20000000,y:-12500000,width:40000000,height:25000000})),campaign.id);
 await page.locator('.campaign-card').filter({hasText:'Sparse world navigation'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:60000});
 const cdp=await page.context().newCDPSession(page);if(profileEnabled){await cdp.send('Profiler.enable');await cdp.send('Performance.enable');}
 const layoutTrace=[];if(process.env.WORLD_LAYOUT_TRACE==='1')cdp.on('Tracing.dataCollected',e=>layoutTrace.push(...e.value));
 await page.evaluate(legacyPixels=>{
  window.__saltTerrainTrace={events:[],dropped:0};
  window.__worldFrames=[];window.__worldLong=[];window.__worldChanges=[];window.__worldPointer=[];window.__worldDraws=[];window.__worldPixels=[];
  const gl=document.querySelector('#atlas-terrain-spatial').getContext('webgl2'),clear=gl.clear.bind(gl);
  gl.clear=(...args)=>{window.__worldDraws.push(performance.now());return clear(...args);};
  let previous=performance.now();const frame=now=>{window.__worldFrames.push({time:now,gap:now-previous});previous=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  window.__worldReset=now=>{previous=now;window.__worldFrames=[];window.__worldLong=[];window.__worldChanges=[];window.__worldPointer=[];window.__worldDraws=[];window.__worldPixels=[];window.__worldResponse?.reset();};
  new PerformanceObserver(list=>window.__worldLong.push(...list.getEntries().map(e=>({time:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
  const map=document.querySelector('#campaign-map');
  if(legacyPixels){
  const canvas=document.querySelector('#atlas-terrain-spatial');let pixelBefore=null,pixelStart=0;
  const sample=()=>{const values=new Uint8Array(32*32*4);gl.readPixels(Math.floor(canvas.width/2)-16,Math.floor(canvas.height/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,values);return values;};
  const pixels=()=>{
   if(pixelBefore){const values=sample();let changed=0;for(let i=0;i<values.length;i+=4)if(Math.max(Math.abs(values[i]-pixelBefore[i]),Math.abs(values[i+1]-pixelBefore[i+1]),Math.abs(values[i+2]-pixelBefore[i+2]))>=3)changed++;
    if(changed>=4){window.__worldPixels.push({time:performance.now(),delayMs:performance.now()-pixelStart,changed});pixelBefore=null;}
   }requestAnimationFrame(pixels);
  };requestAnimationFrame(pixels);
  document.addEventListener('pointerdown',e=>{if(e.target===map&&e.button===0){pixelStart=e.timeStamp;pixelBefore=sample();}},true);
  document.addEventListener('pointerup',()=>{pixelBefore=null;},true);
  }
  new MutationObserver(()=>window.__worldChanges.push({time:performance.now(),view:map.dataset.atlasView,terrain:map.dataset.terrainRevision,quality:map.dataset.terrainQuality,tiles:map.dataset.terrainTiles,draft:map.dataset.terrainDraft})).observe(map,{attributes:true,attributeFilter:['data-atlas-view','data-terrain-revision','data-terrain-quality','data-terrain-tiles','data-terrain-draft']});
  for(const type of ['pointerdown','pointerup'])document.addEventListener(type,e=>{if(e.target===map&&e.button===0)window.__worldPointer.push({type,time:e.timeStamp});},true);
 },readbackMode==='legacy');
 if(responseProbe)await page.evaluate('(()=>{'+responseProbe+';TerrainResponseProbe.installTerrainResponseProbe('+JSON.stringify(readbackMode)+');})()');
 const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 if(cameraTrace)await page.evaluate(installCameraFrameProbe);
 async function measure(name,fn){
  if(cameraTrace)await page.evaluate(()=>window.__cameraFrameProbe.reset());
  if(profileEnabled)await cdp.send('Profiler.start');
  // Bracket the CDP monotonic timestamp with renderer clock samples. This
  // allows CPU samples to be located relative to input, with explicit error.
  let profileClock;
  if(profileEnabled){const before=await page.evaluate(()=>performance.now()),metrics=await cdp.send('Performance.getMetrics'),after=await page.evaluate(()=>performance.now());profileClock={before,after,timestamp:metrics.metrics.find(m=>m.name==='Timestamp')?.value};}
  const baseRevision=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(now=>{window.__worldReset(now);const revision=Number(document.querySelector('#campaign-map').dataset.terrainRevision);resolve(Number.isFinite(revision)?revision:null); })));
  const start=performance.now();await fn();await wait(1000);
  if(profileEnabled){const {profile}=await cdp.send('Profiler.stop');await writeFile(out+'/'+name+'.cpuprofile',JSON.stringify(profile));}
  const data=await page.evaluate(()=>({frames:window.__worldFrames,longTasks:window.__worldLong,changes:window.__worldChanges,pointer:window.__worldPointer,pixels:window.__worldPixels,response:window.__worldResponse?.snapshot(),draws:window.__worldDraws,state:{...document.querySelector('#campaign-map').dataset},status:['land-status','status','atlas-save-status'].map(id=>({id,text:document.getElementById(id)?.textContent,error:document.getElementById(id)?.dataset.error}))}));
  if(data.response)assert.deepEqual(data.response.errors,[],'pixel readback errors invalidate this measurement');
  const down=data.pointer.find(e=>e.type==='pointerdown'),up=data.pointer.find(e=>e.type==='pointerup');
  if(down){const confirmed=data.changes.filter(e=>baseRevision!==null&&Number(e.terrain)>baseRevision&&e.time>=down.time);data.brushFeedback={firstPixelMs:data.response?data.response.runs[0]?.firstCenter?.readyMs??null:data.pixels[0]?.delayMs??null,firstBrushPixelMs:data.response?.runs[0]?.firstBrush?.readyMs??null,firstConfirmedMs:confirmed.length?confirmed[0].time-down.time:null,revisionsDuringHold:[...new Set(confirmed.filter(e=>up&&e.time<up.time).map(e=>e.terrain))]};}
  const gaps=data.frames.map(f=>f.gap).sort((a,b)=>a-b);result.metrics.push({name,baseRevision,profileClock,wallMs:performance.now()-start,p95Ms:gaps[Math.floor(gaps.length*.95)],p99Ms:gaps[Math.floor(gaps.length*.99)],maxMs:gaps.at(-1),...data});
  if(cameraTrace){
   const trace=await page.evaluate(()=>window.__cameraFrameProbe.snapshot());result.metrics.at(-1).cameraFrames=trace;
   if(cameraTrace==='current'&&name==='navigation'){assert(trace.drawnFrames>0);assert.equal(trace.staleFrames,0,'navigation must draw the camera advanced in the same RAF');}
  }
  await writeFile(out+'/progress.json',JSON.stringify(result,null,2));console.log(name,JSON.stringify({p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),longTasks:data.longTasks.length}));
 }
 if(process.env.WORLD_LAYOUT_TRACE==='1')await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.stack',transferMode:'ReportEvents'});
 await measure('navigation',async()=>{
  await page.mouse.move(x,y);for(let i=0;i<12;i++){await page.mouse.wheel(0,i<6?-100:100);await wait(60);}
  await page.mouse.down({button:'middle'});for(let i=0;i<12;i++){await page.mouse.move(x+150*Math.sin(i/3),y+50*Math.cos(i/3));await wait(40);}await page.mouse.up({button:'middle'});
 });
 if(process.env.WORLD_LAYOUT_TRACE==='1'){
  const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');result.traceComplete=await completed;
  assert.equal(result.traceComplete.dataLossOccurred,false);await writeFile(out+'/layout-trace.json',JSON.stringify(layoutTrace));
 }
 await native.capture(page,'world-contours');
 await page.locator('#atlas-section').selectOption('terrain');await atlasCanvasReady(page);await page.locator('#atlas-units').selectOption('metric');await page.locator('[data-tool-group="land"]').click();
 await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();await setBrushWorldRadius(page,'land-radius',radius);await page.locator('#land-height-target-enabled').uncheck();await page.locator('#land-height-strength').fill('500');
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:60000});
 async function sculpt(name){
  await measure(name,async()=>{
   await page.mouse.move(x,y);await wait(100);
   const scene=()=>page.locator('#campaign-map').evaluate(n=>({scene:n.dataset.sceneVersion,author:n.dataset.terrainAuthorRevision}));
   const before=process.env.WORLD_OVERLAY==='1'&&name==='sculpt-repeat'?await scene():null;
   await page.mouse.down();await wait(3000);await page.mouse.move(x+60,y+20,{steps:5});await wait(1000);
   if(before){const during=await scene();result.brushStrokeScene={before,during};assert.equal(during.scene,before.scene,'a live GPU stroke must keep the author scene through pointer and save-state updates');}
   await page.mouse.up();
  });
  if(process.env.WORLD_PENDING_NAVIGATION==='1'){
   const state=()=>page.locator('#campaign-map').evaluate(n=>({view:JSON.parse(n.dataset.atlasView),pending:document.querySelector('#land-tool').disabled,time:performance.now()}));
   const before=await state();assert(before.pending,'world stroke must still be settling for this navigation check');
   await page.mouse.wheel(0,-120);await wait(250);const after=await state();
   assert.notDeepEqual(after.view,before.view,'world camera must move while the released stroke is settling');
   (result.pendingNavigation??=[]).push({name,before,after});
  }
  await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled,null,{timeout:60000});await atlasCanvasReady(page);
  if(process.env.WORLD_PROGRESSIVE==='1')await page.waitForFunction(()=>{
   const map=document.querySelector('#campaign-map'),[done,total]=(map.dataset.terrainTiles??'').split('/').map(Number),up=window.__worldPointer.find(e=>e.type==='pointerup');
   // A refined live-brush frame can also say "detail". Require the complete
   // background tile set for the confirmed revision after this gesture.
   return map.dataset.terrainQuality==='detail'&&done>0&&done===total&&up&&window.__worldChanges.some(c=>c.time>=up.time&&c.quality==='refining'&&c.terrain===map.dataset.terrainRevision&&c.tiles===map.dataset.terrainTiles);
  },null,{timeout:60000});
  await native.capture(page,'world-'+name);
  const status=await page.evaluate(()=>({text:document.querySelector('#land-status').textContent,revision:document.querySelector('#campaign-map').dataset.terrainRevision,quality:document.querySelector('#campaign-map').dataset.terrainQuality,tiles:document.querySelector('#campaign-map').dataset.terrainTiles}));
  const changes=await page.evaluate(()=>window.__worldChanges);
  return {status,changes};
 }
 const first=await sculpt('sculpt');result.sculptStatus=first.status;result.presentationChanges=first.changes;
 if(process.env.WORLD_PROGRESSIVE==='1'){
  assert(result.presentationChanges.some(c=>c.draft==='height'||c.quality==='interactive'),'draft or coherent first pass must be displayed');
  assert(result.presentationChanges.some(c=>c.quality==='detail'),'fine output must replace the interactive pass after the stroke');
 }
 if(process.env.WORLD_DRAFT==='1'){
  assert(result.presentationChanges.some(c=>c.draft==='height'),'direct grid draft must be visible during the gesture');
  assert(await page.locator('#campaign-map').evaluate(n=>!n.dataset.terrainDraft),'draft must be replaced when the gesture finishes');
  assert(result.metrics.find(m=>m.name==='sculpt').brushFeedback[readbackMode==='legacy'?'firstPixelMs':'firstBrushPixelMs']!==null,'actual terrain pixels must change while holding the brush');
 }
 if(process.env.WORLD_REPEAT==='1'){
  if(process.env.WORLD_OVERLAY==='1'){
   await wait(200);
   const before=await page.locator('#campaign-map').getAttribute('data-scene-version');
   await page.evaluate(()=>{
    const gl=document.querySelector('#atlas-terrain-spatial').getContext('webgl2'),original={createProgram:gl.createProgram,deleteProgram:gl.deleteProgram},counts={create:0,remove:0};
    gl.createProgram=(...args)=>{counts.create++;return original.createProgram.apply(gl,args);};gl.deleteProgram=(...args)=>{counts.remove++;return original.deleteProgram.apply(gl,args);};
    window.__finishHoverPrograms=()=>{Object.assign(gl,original);return counts;};
   });
   for(let i=0;i<12;i++){await page.mouse.move(x+60*Math.sin(i),y+30*Math.cos(i));await wait(30);}
   await wait(200);const after=await page.locator('#campaign-map').getAttribute('data-scene-version');
   const programs=await page.evaluate(()=>window.__finishHoverPrograms());
   result.brushHover={before,after,programs};assert(before&&before===after,'brush hover must retain the published map scene');
   assert.deepEqual(programs,{create:0,remove:0},'brush hover must retain its GPU programs');
  }
  result.repeatSculpt=await sculpt('sculpt-repeat');
  assert(Number(result.repeatSculpt.status.revision)>Number(result.sculptStatus.revision),'the warm-world stroke must commit another revision');
  assert(!result.repeatSculpt.status.text.includes('gestoppt'));
  assert(result.metrics.find(m=>m.name==='sculpt-repeat').brushFeedback[readbackMode==='legacy'?'firstPixelMs':'firstBrushPixelMs']!==null,'the warm-world stroke must change actual pixels');
  assert(await page.locator('#campaign-map').evaluate(n=>!n.dataset.terrainDraft),'the repeated draft must finish');
 }
 result.timing=await page.evaluate(()=>window.__saltTerrainTrace);
 if(process.env.SALTMARCHER_TERRAIN_TRACE==='1')result.backendTiming=await native.app.evaluate(()=>({main:global.__saltTerrainTrace,worker:global.__worldWorkerTrace}));
 assert(Number(result.sculptStatus.revision)>records.length,'confirmed terrain must actually appear after the brush');assert(!result.sculptStatus.text.includes('gestoppt'),'brush failure is not successful editing');
 await page.evaluate(()=>window.__worldResponse?.dispose());
 result.gpu=await page.locator('#atlas-terrain-spatial').evaluate(n=>{const gl=n.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),ratio:devicePixelRatio};});
 result.hexPixels=await page.evaluate('(()=>{'+hexProbe+';return HexGridProbe.run();})()');
 assert.equal(result.hexPixels.centreMin,255);assert(result.hexPixels.edgeMax<250);assert(result.hexPixels.periodicError<=1);assert(result.hexPixels.tileError<=1);assert.equal(result.hexPixels.hiddenMin,255);assert.equal(result.hexPixels.gridObjects,0);
 result.contourPixels=await terrainContourPixels(page,contourProbe);
 result.detailPixels=await terrainDetailPixels(page,detailProbe);
 result.draftPixels=await terrainDraftPixels(page,draftProbe);
 result.renderReusePixels=await terrainRenderReusePixels(page,renderReuseProbe);
 if(readbackMode!=='legacy')result.readbackPixels=await terrainPixelReadbackPixels(page);
 assert.deepEqual(result.errors,[]);await native.close();await native.finish(result);
}catch(error){await writeFile(out+'/progress.json',JSON.stringify(result,null,2));await native.fail(error);throw error;}finally{await native.dispose();}
