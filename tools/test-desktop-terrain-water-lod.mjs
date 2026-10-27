/** TW06 fixed-source navigation evidence. Run only inside the private Wayland session. */
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile,mkdir,rm,stat,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {createNativeSession} from './native-session.mjs';
import {createTerrainWaterFixture,manifest,manifestHash,heightPayloadHash} from './terrain-water-fixture.mjs';
import {installLodPickObserver,runLodPick} from './terrain-water-lod-pick.mjs';

assert.equal(process.env.TW_VIRTUAL_SESSION,'1','Use terrain-water-virtual-session.mjs');
const root=process.cwd(),smoke=process.argv.includes('--smoke'),pickOnly=process.argv.includes('--pick-only'),profile=process.argv.includes('--profile'),noConditioning=process.argv.includes('--no-conditioning'),pickAngle=process.argv.find(value=>value.startsWith('--pick-angle='))?.split('=')[1],pickScale=process.argv.find(value=>value.startsWith('--pick-scale='))?.split('=')[1],pickAlpha=process.argv.find(value=>value.startsWith('--pick-alpha='))?.split('=')[1],output=path.resolve('.build/terrain-water-lod',`${Date.now()}-${process.pid}`);
if(pickAngle!==undefined)assert([45,75].includes(Number(pickAngle)),'--pick-angle must be 45 or 75');
if(pickScale!==undefined)assert(manifest.uiScales.includes(Number(pickScale)),'--pick-scale must name a fixture UI scale');
if(pickAlpha!==undefined)assert([0,.5,1].includes(Number(pickAlpha)),'--pick-alpha must be 0, .5 or 1');
const native=await createNativeSession({root,output,name:'terrain-water-lod'}),fixture=await createTerrainWaterFixture(native.profile);
await copyFile(fixture.filename,path.join(output,'synthetic-world.sqlite'));
const result={comparison:process.argv.includes('--baseline')?'Synchronous source frozen at 1792986340510-84839; worker asset present but unused':'Current worker candidate',kind:pickOnly?'TW06 visible mixed-LOD picking':'TW06 continuous terrain LOD',started:new Date().toISOString(),smoke,pickOnly,profile,noConditioning,fixture,manifestHash,virtualSession:process.env.TW_VIRTUAL_OUTPUT,sourceHashes:{},runs:[],picks:[],resources:[],coldLoads:[],limits:['Isolated Wayland session; no physical host display claim.','Frame timings diagnostic only; TW07 owns performance qualification.','Conditioning does not imply that every intermediate target is resident in the bounded cache.']};
const math=buildSync({stdin:{contents:"export {atlasProject} from './src/app/atlas-camera';",resolveDir:root},bundle:true,write:false,platform:'browser',format:'iife',globalName:'twLodMath'}).outputFiles[0].text;
const files=['src/app/atlas-tile-plan.ts','src/app/atlas-raster-tile-stream.ts','src/app/atlas-surface-tile-stream.ts','src/app/atlas-terrain-tile-model.ts','src/app/atlas-terrain-model-client.ts','src/app/atlas-terrain-model-worker.ts','tools/build-desktop.mjs','desktop/main.ts','src/app/atlas-terrain-material-layer.ts','src/app/atlas-surface-draft.ts','src/app/atlas-deck-surface.ts','src/app/atlas-raster-presentation.ts','src/app/atlas-canvas.ts','src/app/campaign-atlas-ui.ts','tools/test-desktop-terrain-water-lod.mjs','tools/terrain-water-lod-pick.mjs','tools/terrain-water-virtual-session.mjs','tools/native-session.mjs','tools/fixtures/terrain-water/v1.json'];
for(const f of files){const bytes=await readFile(f),dest=path.join(output,'source-snapshot',f);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes);result.sourceHashes[f]=createHash('sha256').update(bytes).digest('hex');}
await writeFile(path.join(output,'source.diff'),execFileSync('git',['diff','HEAD']));
const host=()=>({cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),freeBytes:os.freemem(),load:os.loadavg(),processes:execFileSync('ps',['-eo','pid,pcpu,rss,comm','--sort=-pcpu'],{encoding:'utf8'}).split('\n').slice(0,16)});
result.hostStart=host();await writeFile(path.join(output,'prelaunch.json'),JSON.stringify({...result,artifacts:native.artifacts,command:[process.execPath,...process.argv.slice(1)]},null,2));
let memoryObserved=false;
let page,cdp,recordTag='opening';const frameWrites=[];result.transitionFrames=[];result.console=[];
const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const state=()=>page.evaluate(()=>{const n=document.querySelector('#campaign-map'),c=document.querySelector('#atlas-terrain-spatial canvas'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{at:performance.now(),view:JSON.parse(n.dataset.atlasView),camera:JSON.parse(n.dataset.terrainCamera),quality:n.dataset.terrainQuality,ready:n.dataset.terrainReady,cache:JSON.parse(n.dataset.terrainCache??'null'),gpu:JSON.parse(n.dataset.terrainGpu??'null'),model:JSON.parse(n.dataset.terrainModel??'null'),available:JSON.parse(n.dataset.terrainAvailable??'null'),drawn:JSON.parse(n.dataset.terrainDrawn??'null'),upload:JSON.parse(n.dataset.terrainUpload??'null'),display:{innerWidth,innerHeight,devicePixelRatio,canvas:c.getBoundingClientRect().toJSON(),buffer:[g.drawingBufferWidth,g.drawingBufferHeight],gpu:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null,limits:Object.fromEntries(['MAX_TEXTURE_SIZE','MAX_ARRAY_TEXTURE_LAYERS','MAX_VERTEX_TEXTURE_IMAGE_UNITS','MAX_TEXTURE_IMAGE_UNITS','MAX_COMBINED_TEXTURE_IMAGE_UNITS','MAX_UNIFORM_BLOCK_SIZE','MAX_VERTEX_UNIFORM_BLOCKS','MAX_FRAGMENT_UNIFORM_BLOCKS'].map(name=>[name,g.getParameter(g[name])])),extensions:{colorBufferFloat:!!g.getExtension('EXT_color_buffer_float'),floatLinear:!!g.getExtension('OES_texture_float_linear'),timerQuery:!!g.getExtension('EXT_disjoint_timer_query_webgl2')}}};});
async function ready(){await page.waitForFunction(()=>{const n=document.querySelector('#campaign-map');return n?.dataset.terrainReady==='ready'&&n.dataset.terrainQuality==='detail';},null,{timeout:120000});await frame();}
async function snapshot(name){const s=await state();await native.capture(page,name);return{name,...s};}
async function point(){return page.evaluate(height=>{const n=document.querySelector('#campaign-map'),v=JSON.parse(n.dataset.atlasView),c=JSON.parse(n.dataset.terrainCamera),r=n.getBoundingClientRect(),p=twLodMath.atlasProject({frame:v,focusM:c.focusHeightM,tilt:c.tilt,rotation:c.rotation,exaggeration:c.exaggeration,projection:'perspective'},{x:0,y:0},height);return{x:r.x+p.x*r.width,y:r.y+p.y*r.height,projected:p,rect:r.toJSON()};},fixture.heights.find(p=>p.x===0).heightM);}
async function wheel(delta){const p=await point();assert(p.x>p.rect.x&&p.x<p.rect.right&&p.y>p.rect.y&&p.y<p.rect.bottom,'The fixed world anchor must remain on screen');await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,delta);}
async function width(target,uiScale){for(let i=0;i<24;i++){const s=await state(),difference=Math.log(target/s.view.width);if(Math.abs(difference)<.002)return;await wheel(Math.max(-500,Math.min(500,difference/.002))*uiScale);await page.waitForTimeout(190);}assert.fail('Exact navigation width did not converge to '+target);}
async function tilt(value){await page.locator('#atlas-view').click();const input=page.locator('#terrain-tilt');await input.fill(String(value));await input.dispatchEvent('input');await page.keyboard.press('Escape');await ready();assert.equal((await state()).camera.tilt,value);}
async function reverseBearing(){const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+600,y);await page.mouse.up({button:'right'});await ready();assert(Math.abs(Math.abs((await state()).camera.rotation)-180)<1e-6);}
async function open(uiScale){
 page=await native.launch(uiScale);await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setContentSize(1920,1080));
 await native.app.evaluate(({app})=>{globalThis.twLodMemory=[];globalThis.twLodPhase='startup';const sample=()=>{const start=performance.now();globalThis.twLodMemory.push({wall:Date.now(),at:start,phase:globalThis.twLodPhase,processes:app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,cpu:m.cpu,memory:m.memory})),observerMs:performance.now()-start});};sample();globalThis.twLodMemoryTimer=setInterval(sample,100);});memoryObserved=true;
 if(pickOnly)await installLodPickObserver(native,page);
 page.on('console',message=>{if(['error','warning'].includes(message.type()))result.console.push({type:message.type(),text:message.text()});});
 await page.addInitScript({content:math+';globalThis.twLodMath=twLodMath;'});
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.__twFieldReplies=[];
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);if(!String(args[0]).includes('atlas-terrain-model-worker'))return;this.addEventListener('message',event=>{
    const reply=event.data,payload=reply?.payload;if(reply?.kind!=='result'||reply.error||!payload?.models)return;
    const ref=value=>value?.__terrainView===true?`${value.id}/${value.kind}/${value.offset}/${value.length}`:null;
    window.__twFieldReplies.push({epoch:reply.epoch,job:reply.job,base:reply.base,models:payload.models.map(model=>({
     id:model.object?.id,heights:ref(model.grid?.heights),base:ref(model.texture?.data),masks:ref(model.masks?.data),cover:ref(model.cover?.data),relief:ref(model.relief?.data)
    }))});
    if(window.__twFieldReplies.length>16)window.__twFieldReplies.shift();
   });}
  };
 });
 await page.addInitScript(()=>{window.__twLodHandlers=[];const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,wrapped=new WeakMap();EventTarget.prototype.addEventListener=function(type,listener,options){if(type!=='wheel'||typeof listener!=='function')return add.call(this,type,listener,options);let fn=wrapped.get(listener);if(!fn){fn=function(event){const active=window.__twLodActive,start=performance.now();try{return listener.call(this,event);}finally{if(active)window.__twLodHandlers.push({start,end:performance.now(),target:this.id??this.constructor.name,eventTimeStamp:event.timeStamp,deltaY:event.deltaY});}};wrapped.set(listener,fn);}return add.call(this,type,fn,options);};EventTarget.prototype.removeEventListener=function(type,listener,options){return remove.call(this,type,type==='wheel'&&typeof listener==='function'?(wrapped.get(listener)??listener):listener,options);};});
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-20000000,y:-11250000,width:40000000,height:22500000,pose:{tilt:0,rotation:0,exaggeration:1,focusHeightM:250}})),fixture.campaignId);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:fixture.campaignName}).getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
 await page.waitForFunction(()=>!document.querySelector('main').inert&&['ready','failed'].includes(document.querySelector('#campaign-map')?.dataset.terrainReady),null,{timeout:120000});
 assert.notEqual(await page.locator('#campaign-map').getAttribute('data-terrain-ready'),'failed',await page.locator('#atlas-save-status').getAttribute('title'));
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await ready();
 cdp=await page.context().newCDPSession(page);await mkdir(path.join(output,'frames'),{recursive:true});
 cdp.on('Page.screencastFrame',event=>{
  void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  const file=`frames/${String(result.transitionFrames.length).padStart(6,'0')}.jpg`;
  result.transitionFrames.push({file,tag:recordTag,metadata:event.metadata,receivedAt:Date.now()});
  frameWrites.push(writeFile(path.join(output,file),Buffer.from(event.data,'base64')));
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:78,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
 await page.locator('#atlas-view').click();await page.locator('#land-grid').uncheck();await page.keyboard.press('Escape');await page.locator('#atlas-pan').click();
 await page.evaluate(()=>{window.__twLodFrames=[];window.__twLodInput=[];window.__twLodActive=false;window.addEventListener('wheel',e=>{if(window.__twLodActive)window.__twLodInput.push({at:performance.now(),eventTimeStamp:e.timeStamp,deltaY:e.deltaY,x:e.clientX,y:e.clientY,trusted:e.isTrusted});},true);let last;const tick=now=>{if(window.__twLodActive){const n=document.querySelector('#campaign-map');window.__twLodFrames.push({at:now,observedAt:performance.now(),frameMs:last===undefined?null:now-last,view:JSON.parse(n.dataset.atlasView),quality:n.dataset.terrainQuality,ready:n.dataset.terrainReady,model:JSON.parse(n.dataset.terrainModel??'null'),available:JSON.parse(n.dataset.terrainAvailable??'null'),drawn:JSON.parse(n.dataset.terrainDrawn??'null'),upload:JSON.parse(n.dataset.terrainUpload??'null')});}last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 result.coldLoads.push({uiScale,...await state(),gpuInfo:await native.app.evaluate(({app})=>app.getGPUInfo('complete'))});await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));
 assert.match(result.coldLoads.at(-1).display.gpu,/Intel.*620/i,'Actual Intel GPU is required');assert.equal(result.coldLoads.at(-1).display.innerWidth*uiScale,1920);assert.equal(result.coldLoads.at(-1).display.innerHeight*uiScale,1080);
}
async function trip(uiScale,angle,repeat,capture){
 recordTag=`scale-${uiScale}-tilt-${angle}-trip-${repeat}`;
 await width(40000000,uiScale);await ready();
 await native.app.evaluate(({},phase)=>{globalThis.twLodPhase=phase;},recordTag);
 const row={uiScale,tilt:angle,repeat,anchor:{x:0,y:0,heightM:fixture.heights.find(p=>p.x===0).heightM},method:'Two Main-timed trusted wheel legs; return starts after an actual room-scale RAF observation, without per-event protocol, source/detail or capture gates',start:await state(),planned:[],sent:[],mainClocks:[]};
 result.activeRun=row;
 const anchor=await point(),distance=Math.log(40000000/20),expected=distance/.002;
 row.rendererClock=await page.evaluate(()=>{window.__twLodFrames=[];window.__twLodInput=[];window.__twLodHandlers=[];window.__twLodTurn=null;window.__twLodActive=true;return{timeOrigin:performance.timeOrigin,at:performance.now(),wall:Date.now()};});
 if(profile){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
 await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));
 for(const direction of [-1,1]){
 const plan=[];let atMs=0,remaining=distance;while(remaining>1e-10){const exponent=Math.min(.24,remaining);plan.push({direction,atMs,deltaY:direction*exponent/.002});remaining-=exponent;atMs+=80;}row.planned.push(...plan);
 const dispatch=await native.app.evaluate(({BrowserWindow},{plan,anchor,uiScale})=>new Promise(resolve=>{
  const contents=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents,start=performance.now(),clock={timeOrigin:performance.timeOrigin,at:start,wall:Date.now()},sent=[];
  globalThis.twLodPhase=plan[0].direction<0?'moving-in':'moving-out';
  for(const event of plan)setTimeout(()=>{contents.sendInputEvent({type:'mouseWheel',x:Math.round(anchor.x*uiScale),y:Math.round(anchor.y*uiScale),deltaX:0,deltaY:-event.deltaY*uiScale,canScroll:true});sent.push({...event,nativeDeltaY:-event.deltaY*uiScale,sentAtMs:performance.now()-start});},event.atMs);
  setTimeout(()=>resolve({sent,clock}),plan.at(-1).atMs+250);
 }),{plan,anchor,uiScale});
 row.sent.push(...dispatch.sent);row.mainClocks.push({direction,...dispatch.clock});
 await page.waitForFunction(({expected,direction})=>{const events=window.__twLodInput,view=JSON.parse(document.querySelector('#campaign-map').dataset.atlasView),target=direction<0?20:40000000,arrived=events.reduce((s,e)=>s+Math.max(0,e.deltaY*direction),0)>=expected-.01&&Math.abs(view.width/target-1)<.0001&&window.__twLodFrames.some(f=>Math.abs(f.view.width/target-1)<.0001);if(arrived&&direction<0&&!window.__twLodTurn)window.__twLodTurn={observedAt:performance.now(),view,quality:document.querySelector('#campaign-map').dataset.terrainQuality};return arrived;},{expected,direction},{timeout:90000});
 }
 await page.waitForTimeout(250);await page.evaluate(()=>{window.__twLodActive=false;});row.frames=await page.evaluate(()=>window.__twLodFrames);row.received=await page.evaluate(()=>window.__twLodInput);row.handlers=await page.evaluate(()=>window.__twLodHandlers);row.turn=await page.evaluate(()=>window.__twLodTurn);row.fieldReplies=await page.evaluate(()=>window.__twFieldReplies);row.end=await state();
 if(profile)await writeFile(path.join(output,recordTag+'.cpuprofile'),JSON.stringify((await cdp.send('Profiler.stop')).profile));
 assert.equal(row.sent.length,row.planned.length);assert(row.received.every(e=>e.trusted));
 for(const direction of [-1,1])assert(Math.abs(row.received.reduce((sum,e)=>sum+Math.max(0,e.deltaY*direction),0)-expected)<.01,'Every native wheel delta must reach the renderer, including coalesced events');
 const narrowest=Math.min(...row.frames.map(f=>f.view.width));assert(narrowest>=19.8&&narrowest<=20.2,'The actual moving frames must reach exactly the agreed room scale');assert(Math.abs(row.end.view.width/40000000-1)<.002,'The actual camera must return to world scale');
 result.runs.push(row);delete result.activeRun;await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({uiScale,angle,repeat,events:row.received.length,frames:row.frames.length,output}));
}
async function prepare(uiScale,angle){
 recordTag=`cold-scale-${uiScale}-tilt-${angle}`;
 for(const target of manifest.scalesM){await native.app.evaluate(({},phase)=>{globalThis.twLodPhase=phase;},`conditioning-${target}`);const start=performance.now();await width(target,uiScale);const arrived=performance.now();await ready();result.coldLoads.push({kind:'scale conditioning, separately from uninterrupted traversal',uiScale,tilt:angle,target,navigationMs:arrived-start,loadWaitMs:performance.now()-arrived,...await snapshot(`cold-scale-${uiScale}-tilt-${angle}-width-${target}`)});await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));}
}
try{
 for(const uiScale of pickScale?[Number(pickScale)]:(smoke?[1]:manifest.uiScales)){
  await open(uiScale);
  if(pickOnly){for(const angle of pickAngle?[Number(pickAngle)]:[45,75]){await width(angle>=70?20:1000,uiScale);await tilt(angle);if(angle>=70)await reverseBearing();result.picks.push(await runLodPick({native,page,root,output,state,ready,width,uiScale,angle,targetAlpha:pickAlpha===undefined?1:Number(pickAlpha),campaignId:fixture.campaignId}));await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));}}
  else{for(const angle of smoke?[45]:[0,45,75]){await tilt(angle);if(!noConditioning)await prepare(uiScale,angle);for(let repeat=1;repeat<=(smoke?1:3);repeat++)await trip(uiScale,angle,repeat,true);}
  if(!smoke){await tilt(45);for(let repeat=1;repeat<=10;repeat++){await trip(uiScale,45,repeat+3,false);result.resources.push({uiScale,repeat,...await state()});}}}
  result.processMemory??=[];result.processMemory.push({uiScale,samples:await native.app.evaluate(()=>{clearInterval(globalThis.twLodMemoryTimer);return globalThis.twLodMemory;})});memoryObserved=false;
  await cdp.send('Page.stopScreencast');await Promise.all(frameWrites);await native.close();
 }
 result.hostEnd=host();result.finished=new Date().toISOString();await native.finish(result);console.log(output);
}catch(error){if(pickOnly){result.failedPickCommands=await native.app?.evaluate(()=>globalThis.twLodPickStrokes).catch(()=>null);const Database=createRequire(import.meta.url)('better-sqlite3'),db=new Database(fixture.filename,{readonly:true});try{await db.backup(path.join(output,'failed-after.sqlite'));}finally{db.close();}}if(memoryObserved){result.processMemory??=[];result.processMemory.push({failed:true,samples:await native.app?.evaluate(()=>{clearInterval(globalThis.twLodMemoryTimer);return globalThis.twLodMemory;}).catch(()=>null)});}if(result.activeRun){Object.assign(result.activeRun,await page?.evaluate(()=>({frames:window.__twLodFrames,received:window.__twLodInput,handlers:window.__twLodHandlers})).catch(()=>({})));if(profile&&cdp)await cdp.send('Profiler.stop').then(p=>writeFile(path.join(output,'failed.cpuprofile'),JSON.stringify(p.profile))).catch(()=>{});}result.failureState=await page?.evaluate(()=>({text:document.body.innerText,dataset:{...document.querySelector('#campaign-map')?.dataset},titles:[...document.querySelectorAll('[title]')].map(n=>({id:n.id,title:n.title}))})).catch(()=>null);await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));await native.fail(error);console.error(output);throw error;}
finally{if(cdp)await cdp.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(frameWrites);await native.dispose();await rm(native.profile,{recursive:true,force:true});await writeFile(path.join(output,'cleanup.json'),JSON.stringify({profileRemoved:await stat(native.profile).then(()=>false,()=>true),profile:native.profile},null,2));}
