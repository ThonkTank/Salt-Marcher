// Sparse world map, real main Atlas, and a 2,500-mile brush. No user profile.
import {buildDraftProbe,terrainDraftPixels} from './terrain-draft-probe.mjs';
import {createNativeSession} from './native-session.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
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
const result={radius,records:recordCount,populated,large,metrics:[],errors:[]};let page;
const hexProbe=buildHexGridProbe();
const contourProbe=buildContourProbe();
const detailProbe=buildDetailProbe();
const draftProbe=buildDraftProbe();
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
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
 const layoutTrace=[];if(process.env.WORLD_LAYOUT_TRACE==='1')cdp.on('Tracing.dataCollected',e=>layoutTrace.push(...e.value));
 await page.evaluate(()=>{
  window.__saltTerrainTrace={events:[],dropped:0};
  window.__worldFrames=[];window.__worldLong=[];window.__worldChanges=[];window.__worldPointer=[];window.__worldDraws=[];window.__worldPixels=[];
  const gl=document.querySelector('#atlas-terrain-spatial').getContext('webgl2'),clear=gl.clear.bind(gl);
  gl.clear=(...args)=>{window.__worldDraws.push(performance.now());return clear(...args);};
  let previous=performance.now();const frame=now=>{window.__worldFrames.push({time:now,gap:now-previous});previous=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  new PerformanceObserver(list=>window.__worldLong.push(...list.getEntries().map(e=>({time:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
  const map=document.querySelector('#campaign-map');
  const canvas=document.querySelector('#atlas-terrain-spatial');let pixelBefore=null,pixelStart=0;
  const sample=()=>{const values=new Uint8Array(32*32*4);gl.readPixels(Math.floor(canvas.width/2)-16,Math.floor(canvas.height/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,values);return values;};
  const pixels=()=>{
   if(pixelBefore){const values=sample();let changed=0;for(let i=0;i<values.length;i+=4)if(Math.max(Math.abs(values[i]-pixelBefore[i]),Math.abs(values[i+1]-pixelBefore[i+1]),Math.abs(values[i+2]-pixelBefore[i+2]))>=3)changed++;
    if(changed>=4){window.__worldPixels.push({time:performance.now(),delayMs:performance.now()-pixelStart,changed});pixelBefore=null;}
   }requestAnimationFrame(pixels);
  };requestAnimationFrame(pixels);
  document.addEventListener('pointerdown',e=>{if(e.target===map&&e.button===0){pixelBefore=sample();pixelStart=performance.now();}},true);
  document.addEventListener('pointerup',()=>{pixelBefore=null;},true);
  new MutationObserver(()=>window.__worldChanges.push({time:performance.now(),view:map.dataset.atlasView,terrain:map.dataset.terrainRevision,quality:map.dataset.terrainQuality,draft:map.dataset.terrainDraft})).observe(map,{attributes:true,attributeFilter:['data-atlas-view','data-terrain-revision','data-terrain-quality','data-terrain-draft']});
  for(const type of ['pointerdown','pointerup'])document.addEventListener(type,e=>{if(e.target===map&&e.button===0)window.__worldPointer.push({type,time:performance.now()});},true);
 });
 const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 async function measure(name,fn){
  await page.evaluate(()=>{window.__worldFrames=[];window.__worldLong=[];window.__worldChanges=[];window.__worldPointer=[];window.__worldDraws=[];});await cdp.send('Profiler.start');
  const start=performance.now();await fn();await wait(1000);
  const {profile}=await cdp.send('Profiler.stop');await writeFile(out+'/'+name+'.cpuprofile',JSON.stringify(profile));
  const data=await page.evaluate(()=>({frames:window.__worldFrames,longTasks:window.__worldLong,changes:window.__worldChanges,pointer:window.__worldPointer,pixels:window.__worldPixels,draws:window.__worldDraws,state:{...document.querySelector('#campaign-map').dataset},status:['land-status','status','atlas-save-status'].map(id=>({id,text:document.getElementById(id)?.textContent,error:document.getElementById(id)?.dataset.error}))}));
  const down=data.pointer.find(e=>e.type==='pointerdown'),up=data.pointer.find(e=>e.type==='pointerup');
  if(down){const confirmed=data.changes.filter(e=>Number(e.terrain)>records.length&&e.time>=down.time);data.brushFeedback={firstPixelMs:data.pixels[0]?.delayMs??null,firstConfirmedMs:confirmed.length?confirmed[0].time-down.time:null,revisionsDuringHold:[...new Set(confirmed.filter(e=>up&&e.time<up.time).map(e=>e.terrain))]};}
  const gaps=data.frames.map(f=>f.gap).sort((a,b)=>a-b);result.metrics.push({name,wallMs:performance.now()-start,p95Ms:gaps[Math.floor(gaps.length*.95)],maxMs:gaps.at(-1),...data});
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
 await measure('sculpt',async()=>{await page.mouse.move(x,y);await wait(100);await page.mouse.down();await wait(3000);await page.mouse.move(x+60,y+20,{steps:5});await wait(1000);await page.mouse.up();});
 await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled,null,{timeout:60000});await atlasCanvasReady(page);
 if(process.env.WORLD_PROGRESSIVE==='1')await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 await native.capture(page,'world-sculpt');
 result.sculptStatus=await page.evaluate(()=>({text:document.querySelector('#land-status').textContent,revision:document.querySelector('#campaign-map').dataset.terrainRevision,quality:document.querySelector('#campaign-map').dataset.terrainQuality}));
 result.presentationChanges=await page.evaluate(()=>window.__worldChanges);
 if(process.env.WORLD_PROGRESSIVE==='1'){
  assert(result.presentationChanges.some(c=>c.draft==='height'||c.quality==='interactive'),'draft or coherent first pass must be displayed');
  assert(result.presentationChanges.some(c=>c.quality==='detail'),'fine output must replace the interactive pass after the stroke');
 }
 if(process.env.WORLD_DRAFT==='1'){
  assert(result.presentationChanges.some(c=>c.draft==='height'),'direct grid draft must be visible during the gesture');
  assert(await page.locator('#campaign-map').evaluate(n=>!n.dataset.terrainDraft),'draft must be replaced when the gesture finishes');
  assert(result.metrics.find(m=>m.name==='sculpt').brushFeedback.firstPixelMs!==null,'actual terrain pixels must change while holding the brush');
 }
 result.timing=await page.evaluate(()=>window.__saltTerrainTrace);
 if(process.env.SALTMARCHER_TERRAIN_TRACE==='1')result.backendTiming=await native.app.evaluate(()=>({main:global.__saltTerrainTrace,worker:global.__worldWorkerTrace}));
 assert(Number(result.sculptStatus.revision)>records.length,'confirmed terrain must actually appear after the brush');assert(!result.sculptStatus.text.includes('gestoppt'),'brush failure is not successful editing');
 result.gpu=await page.locator('#atlas-terrain-spatial').evaluate(n=>{const gl=n.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),ratio:devicePixelRatio};});
 result.hexPixels=await page.evaluate('(()=>{'+hexProbe+';return HexGridProbe.run();})()');
 assert.equal(result.hexPixels.centreMin,255);assert(result.hexPixels.edgeMax<250);assert(result.hexPixels.periodicError<=1);assert(result.hexPixels.tileError<=1);assert.equal(result.hexPixels.hiddenMin,255);assert.equal(result.hexPixels.gridObjects,0);
 result.contourPixels=await terrainContourPixels(page,contourProbe);
 result.detailPixels=await terrainDetailPixels(page,detailProbe);
 result.draftPixels=await terrainDraftPixels(page,draftProbe);
 assert.deepEqual(result.errors,[]);await native.close();await native.finish(result);
}catch(error){await writeFile(out+'/progress.json',JSON.stringify(result,null,2));await native.fail(error);throw error;}finally{await native.dispose();}
