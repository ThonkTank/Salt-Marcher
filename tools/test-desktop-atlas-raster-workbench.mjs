import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createNativeSession} from './native-session.mjs';
import {createAtlasCanonicalFixture} from './atlas-canonical-fixture.mjs';
import {setBrushWorldRadius,setHeightDirection} from './atlas-brush-probe.mjs';
const root=process.cwd(),output=path.resolve('.build/atlas-raster-workbench',`${Date.now()}-${process.pid}`);
const native=await createNativeSession({root,output,name:'atlas-raster-workbench'});
const require=createRequire(import.meta.url),Database=require('better-sqlite3');
let page;const errors=[],openTimes=[];
try{
 const fixture=await createAtlasCanonicalFixture({profilePath:native.profile,campaignName:'Raster Workbench'});
 const revision=()=>{const db=new Database(native.profile+'/workbench.sqlite',{readonly:true});try{return db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(fixture.campaignId).revision;}finally{db.close();}};
 const terrainReady=async()=>{const expected=revision();await page.waitForFunction(expected=>{const map=document.querySelector('#campaign-map');return map?.dataset.terrainReady==='ready'&&map.dataset.terrainQuality==='detail'&&map.dataset.terrainDraft===undefined&&Number(map.dataset.terrainRevision)===expected;},expected,{timeout:60000});};
 const open=async()=>{
  page=await native.launch();page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log(m.text());}});
  await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,900));
  await page.evaluate(id=>{sessionStorage.setItem('atlas-raster-workbench','true');localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-96,y:-64,width:256,height:192}));},fixture.campaignId);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  const start=performance.now();
  await page.locator('.campaign-card').filter({hasText:'Raster Workbench'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
  await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
  if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
  await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:60000});
  openTimes.push(performance.now()-start);
  assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'),'deck');
 };
 await open();await native.capture(page,'01-open.png');
 await page.locator('#atlas-section').selectOption('terrain');
 await page.locator('[data-tool-group="land"]').click();
 await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
 await page.locator('#atlas-units').selectOption('metric');
 await setBrushWorldRadius(page,'land-radius',8);await setHeightDirection(page,'raise');
 const b=await page.locator('#campaign-map').boundingBox();assert(b);
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 await page.evaluate(()=>{
  window.__saltTerrainTrace={events:[],dropped:0};window.__measurePaint=true;window.__reactions=[];window.__pointerSources=[];
  window.addEventListener('pointerdown',event=>{
   if(!window.__measurePaint||event.target!==document.querySelector('#campaign-map'))return;
   const canvas=document.querySelector('#atlas-terrain-spatial canvas'),gl=canvas?.getContext('webgl2');if(!gl)return;
   const rect=canvas.getBoundingClientRect(),size=64,x=Math.max(0,Math.min(gl.drawingBufferWidth-size,Math.round((event.clientX-rect.left)/rect.width*gl.drawingBufferWidth-size/2))),y=Math.max(0,Math.min(gl.drawingBufferHeight-size,Math.round((1-(event.clientY-rect.top)/rect.height)*gl.drawingBufferHeight-size/2)));
   const pixels=()=>{const bytes=new Uint8Array(size*size*4),previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);return bytes;};
   const before=pixels(),start=performance.now();window.__pointerSources.push(document.querySelector('#campaign-map').dataset.terrainAuthorRevision??null);
   const check=()=>{const after=pixels();if(after.some((v,i)=>v!==before[i]))window.__reactions.push(performance.now()-start);else if(performance.now()-start<3000)requestAnimationFrame(check);else window.__reactions.push(null);};requestAnimationFrame(check);
  },true);
 });
 const before=revision(),x=b.x+b.width*.52,y=b.y+b.height*.5;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='height',null,{timeout:5000});
 await native.capture(page,'02-local-height.png');await page.mouse.up();
 // The second pointerdown is deliberately issued without waiting for any receipt.
 await page.mouse.move(x+30,y+10);await page.mouse.down();await page.mouse.move(x+60,y+20,{steps:4});
 await page.waitForTimeout(150);await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('#atlas-undo').disabled,null,{timeout:60000});
 const after=revision();assert(after>=before+2,`Two gestures missing: ${before} -> ${after}`);
 await native.capture(page,'03-two-gestures.png');
 await page.locator('#atlas-undo').click();await page.waitForFunction(()=>!document.querySelector('#atlas-redo').disabled,null,{timeout:60000});
 const undone=revision();assert(undone>after);
 await page.locator('#atlas-redo').click();await page.waitForFunction(()=>!document.querySelector('#atlas-undo').disabled,null,{timeout:60000});
 await native.capture(page,'04-redo.png');
 // Undo/Redo changes the canonical terrain source. Button availability alone
 // does not prove that source is available to the authoring surface.
 await terrainReady();
 await page.locator('[data-atlas-tool="land-color"]').click();
 await setBrushWorldRadius(page,'land-radius',8);await page.locator('#land-tip').selectOption('round');await page.locator('#land-paint-color').fill('#d644aa');
 const colorBefore=revision();
 await page.mouse.move(x,y);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='color');await page.mouse.up();
 await page.mouse.move(x-60,y+30);await page.mouse.down();await page.mouse.move(x-50,y+40,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('#atlas-undo').disabled&&document.querySelector('#campaign-map').dataset.terrainDraft===undefined,null,{timeout:60000});
 let saved=revision();assert.equal(saved,colorBefore+2);await native.capture(page,'04b-color.png');
 await page.waitForFunction(()=>window.__reactions.length===4,null,{timeout:5000});
 // Twenty alternating opaque dots guarantee a visible change at the same land
 // point; no camera movement or already-identical pigment can satisfy the probe.
 for(let i=0;i<20;i++){
   await page.locator('#land-paint-color').fill(i%2?'#275fd0':'#ed5d35');
   await page.mouse.move(x,y);await page.mouse.down();
   await page.waitForFunction(n=>window.__reactions.length>=n,5+i,{timeout:5000});await page.mouse.up();
 }
 await page.waitForFunction(()=>!document.querySelector('#atlas-undo').disabled&&document.querySelector('#campaign-map').dataset.terrainDraft===undefined,null,{timeout:60000});
 saved=revision();
 const measurements=await page.evaluate(()=>({reactions:window.__reactions,pointerSources:window.__pointerSources,trace:window.__saltTerrainTrace}));assert.equal(measurements.reactions.length,24);assert(measurements.reactions.every(v=>v!==null));measurements.p95Color=measurements.reactions.slice(4).sort((a,b)=>a-b)[18];console.log(JSON.stringify({reactions:measurements.reactions,p95Color:measurements.p95Color,openTimes}));
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 await page.evaluate(()=>{window.__measurePaint=false;});
 await native.app.evaluate(({ipcMain})=>{
  globalThis.qaTileLoads={active:0,peak:0,started:0};
  for(const channel of ['atlas:terrain-tile','atlas:material-tile']){
   const read=ipcMain._invokeHandlers.get(channel);ipcMain.removeHandler(channel);ipcMain.handle(channel,async(...args)=>{
    const s=globalThis.qaTileLoads;s.started++;s.active++;s.peak=Math.max(s.peak,s.active);
    try{return await read(...args);}finally{s.active--;}
   });
  }
 });
 const idle=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];let last;const tick=now=>{if(last!==undefined)intervals.push(now-last);last=now;if(intervals.length<120)requestAnimationFrame(tick);else{intervals.sort((a,b)=>a-b);resolve({samples:120,p50:intervals[59],p95:intervals[113]});}};requestAnimationFrame(tick);}));
 const displays=await native.app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({size:d.size,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency})));
 await page.locator('#atlas-pan').click();
 await page.evaluate(()=>{window.__navFrames=[];window.__navActive=true;let last=performance.now();const tick=now=>{if(!window.__navActive)return;window.__navFrames.push(now-last);last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 for(let i=0;i<20;i++){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(i%2?-30:30),y,{steps:3});await page.mouse.up();}
 const navigation=await page.evaluate(()=>{window.__navActive=false;const intervals=window.__navFrames.slice(1).sort((a,b)=>a-b);return{changes:20,samples:intervals.length,p95FrameMs:intervals[Math.ceil(intervals.length*.95)-1],maxFrameMs:intervals.at(-1)};});
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 navigation.reads=await native.app.evaluate(()=>globalThis.qaTileLoads);assert(navigation.reads.peak<=1,JSON.stringify(navigation));
 await native.capture(page,'04d-navigation.png');
 const loss=await page.evaluate(async()=>{
   const old=document.querySelector('#atlas-terrain-spatial canvas'),gl=old.getContext('webgl2'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('GPU loss extension unavailable');
   window.__lostAtlasCanvas=old;extension.loseContext();return{supported:true};
 });
 await page.waitForFunction(()=>document.querySelector('#atlas-terrain-spatial canvas')!==window.__lostAtlasCanvas);
 await native.capture(page,'04c-gpu-recovered.png');assert.equal(await page.locator('#atlas-terrain-spatial canvas').count(),1);assert.equal(revision(),saved);
 // Hold a real write boundary so the second local gesture is definitely queued.
 const failures=[];
 for(const outcome of ['rejected','unknown']){
   await page.locator('[data-atlas-tool="land-color"]').click();
   await native.app.evaluate(({ipcMain},outcome)=>{
     const original=ipcMain._invokeHandlers.get('atlas:commit');globalThis.qaRasterWrites=[];globalThis.qaRasterOriginal=original;
     ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',async(e,c)=>{
       globalThis.qaRasterWrites.push(c.commandId);
       await new Promise(resolve=>globalThis.qaRasterRelease=resolve);
       if(outcome==='rejected')return{ok:false,error:'QA: controlled raster write rejection'};
       const result=await original(e,c);if(!result.ok)throw Error(result.error);
       throw Error('QA: receipt lost after durable commit');
     });
   },outcome);
   const base=revision();
   for(const offset of [0,24]){await page.mouse.move(x+offset,y-24);await page.mouse.down();await page.waitForTimeout(90);await page.mouse.up();}
   await page.waitForTimeout(50);assert.equal(await native.app.evaluate(()=>globalThis.qaRasterWrites.length),1);
   await native.app.evaluate(()=>globalThis.qaRasterRelease());
   await page.waitForFunction(()=>!document.querySelector('#atlas-region-retry').hidden);
   await page.mouse.move(x-24,y-24);await page.mouse.down();await page.mouse.up();
   assert.equal(await native.app.evaluate(()=>globalThis.qaRasterWrites.length),1,'Dependent and later strokes must stay frozen');
   assert.equal(revision(),base+(outcome==='unknown'?1:0));
   await native.app.evaluate(({ipcMain})=>{ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',globalThis.qaRasterOriginal);});
   if(!await page.locator('#atlas-status-popup').isVisible())await page.locator('#atlas-status').click();
   if(outcome==='unknown')await page.locator('#atlas-recover').click();else await page.locator('#atlas-region-retry').click();
   if(await page.locator('#atlas-status-popup').isVisible())await page.locator('#atlas-status').click();
   await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready'&&document.querySelector('#campaign-map').dataset.terrainDraft===undefined,null,{timeout:60000});
   assert.equal(revision(),base+(outcome==='unknown'?1:0),'Recovery may not replay a rejected dependent gesture');
   failures.push({outcome,before:base,after:revision(),writes:1});saved=revision();
 }
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});
 await native.close();await open();assert.equal(revision(),saved);await native.capture(page,'05-reopened.png');await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail',null,{timeout:60000});await native.close();assert.deepEqual(errors,[]);
 await native.finish({before,after,undone,saved,measurements,openTimes,navigation,idle,displays,loss,failures,scope:'Native Workbench raster opt-in: two height and two pigment gestures, immediate follow-up input, Undo/Redo, fresh reopen.'});console.log(output);
}catch(error){if(page)console.log(await page.evaluate(()=>({status:document.querySelector('#land-status')?.textContent,save:document.querySelector('#atlas-save-status')?.textContent,canvas:document.querySelector('#campaign-map')?.dataset,error:document.querySelector('#status')?.textContent,reactions:window.__reactions,pointerSources:window.__pointerSources,trace:window.__saltTerrainTrace})).catch(()=>null));await native.fail(error);throw error;}finally{await native.dispose();}
