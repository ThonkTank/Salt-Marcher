// Hold a real commit acknowledgement: camera input must not wait for storage/display.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const require=createRequire(import.meta.url);
require('esbuild').buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';",resolveDir:process.cwd()},outfile:'.build/navigation-pending-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/navigation-pending-store.cjs');
const session=await createNativeSession({name:'navigation-pending',output:path.resolve(process.env.QA_EVIDENCE_DIR??'.build/navigation-pending')});
const store=new CampaignStore(session.profile+'/workbench.sqlite');
store.create('Navigation beim Speichern',[{id:'navigation-room',scopeId:'local',floorId:'ground',number:'1',name:'Kamerareferenz',revision:0,polygons:[{outer:[{x:0,y:0},{x:16,y:0},{x:16,y:12},{x:0,y:12}],holes:[]}],sections:[]}]);
store.tutorial('skipped');store.close();
const checks=[];let pose;
let page;
const view=()=>page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.atlasView));
const writes=()=>session.app.evaluate(()=>globalThis.qaNavigationWrites.length);
async function gesture(name,action){
 const before=await view(),start=Date.now();
 await page.evaluate(()=>{
  const map=document.querySelector('#campaign-map'),original=map.dataset.atlasView;
  const sample=window.qaCameraSample={event:null,viewChangedMs:null,authorReadyMs:null};let raf;
  const input=e=>{if(sample.event===null && e.target===map && (e.type==='wheel'||e.buttons===1))sample.event=e.timeStamp;};
  window.addEventListener('wheel',input,true);window.addEventListener('pointermove',input,true);
  const tick=()=>{if(sample.event!==null&&map.dataset.atlasView!==original){sample.viewChangedMs??=performance.now()-sample.event;if(map.dataset.canvasState==='loaded')sample.authorReadyMs??=performance.now()-sample.event;}raf=requestAnimationFrame(tick);};
  raf=requestAnimationFrame(tick);window.qaCameraSampleStop=()=>{cancelAnimationFrame(raf);window.removeEventListener('wheel',input,true);window.removeEventListener('pointermove',input,true);return sample;};
 });
 await action();await page.waitForTimeout(250);
 const after=await view(),changed=JSON.stringify(before)!==JSON.stringify(after);
 checks.push({name,changed,before,after,observationMs:Date.now()-start,frame:await page.evaluate(()=>window.qaCameraSampleStop())});
}
try{
 page=await session.launch();
 await page.locator('.campaign-card').filter({hasText:'Navigation beim Speichern'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){
  if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();
  await page.locator('#atlas-tab').click();
 }
 await atlasCanvasReady(page);
 await page.locator('#atlas-search').fill('Kamerareferenz');
 await page.locator('#atlas-search-results button').filter({hasText:'Kamerareferenz'}).click();
 await atlasCanvasReady(page);await page.locator('#atlas-search').fill('');
 if(await page.locator('#atlas-secondary-close').isVisible())await page.locator('#atlas-secondary-close').click();
 await page.locator('#atlas-section').selectOption('terrain');
 await page.locator('[data-tool-group="land"]').click();
 await page.locator('[data-atlas-tool="land-shape"]').click();await atlasCanvasReady(page);
 await session.app.evaluate(({ipcMain})=>{
  const original=ipcMain._invokeHandlers.get('atlas:commit');if(!original)throw Error('Missing real commit handler');
  let hold=true;globalThis.qaNavigationWrites=[];
  ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',async(e,c)=>{
   const entry={id:c.commandId,kind:c.action.kind};globalThis.qaNavigationWrites.push(entry);
   const result=await original(e,c);entry.ok=result.ok;entry.revision=result.value?.revision;
   if(hold&&c.action.kind==='landscape-height-stroke'){
    hold=false;globalThis.qaNavigationHeld=true;globalThis.qaNavigationReply=result;
    await new Promise(resolve=>globalThis.qaNavigationRelease=resolve);
   }
   return result;
  });
  const frame=ipcMain._invokeHandlers.get('atlas:terrain-frame');let holdFrame=true;
  ipcMain.removeHandler('atlas:terrain-frame');ipcMain.handle('atlas:terrain-frame',async(e,token,request)=>{
   const result=await frame(e,token,request);
   if(holdFrame&&request.refinement&&result.ok){
    holdFrame=false;globalThis.qaNavigationFrameHeld=true;
    await new Promise(resolve=>globalThis.qaNavigationFrameRelease=resolve);
   }
   return result;
  });
 });
 const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.5;
 await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(300);
 await gesture('wheel during held pointer',()=>page.mouse.wheel(0,-120));
 assert.equal(checks.at(-1).changed,false,'active brush anchors must stay fixed');
 assert(await page.locator('#land-radius-value').isDisabled());
 await page.mouse.up();
 for(let i=0;i<100&&!await session.app.evaluate(()=>!!globalThis.qaNavigationHeld);i++)await page.waitForTimeout(50);
 assert(await session.app.evaluate(()=>!!globalThis.qaNavigationHeld),'actual commit acknowledgement must be held');
 assert.equal(await session.app.evaluate(()=>globalThis.qaNavigationReply.ok),true);
 const pendingWrites=await writes();
 await page.mouse.down();await page.waitForTimeout(150);await page.mouse.up();
 assert.equal(await writes(),pendingWrites,'a second brush must not start during pending acknowledgement');
 await gesture('wheel while acknowledgement pending',()=>page.mouse.wheel(0,-120));
 await gesture('Space drag while acknowledgement pending',async()=>{
  await page.locator('#campaign-map').focus();await page.keyboard.down('Space');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+20,{steps:4});await page.mouse.up();await page.keyboard.up('Space');
 });
 await page.locator('#atlas-pan').click();
 await gesture('hand drag while acknowledgement pending',async()=>{
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-70,y-20,{steps:4});await page.mouse.up();
 });
 assert(await page.locator('#land-radius-value').isDisabled(),'camera movement must not unlock brush parameters');
 assert.equal(await writes(),pendingWrites,'navigation must not write');
 await page.locator('#atlas-view').click();
 await page.locator('#terrain-tilt').evaluate(n=>{n.value='35';n.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#terrain-rotation').evaluate(n=>{n.value='25';n.dispatchEvent(new Event('input',{bubbles:true}));});
 pose=await page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.terrainProjection));
 if(process.env.PENDING_BASELINE!=='1'){assert.equal(pose.tilt,35);assert.equal(pose.rotation,25);}
 await page.locator('#atlas-view').click();
 await session.capture(page,'pending-navigation');
 await session.app.evaluate(()=>globalThis.qaNavigationRelease());
 for(let i=0;i<200&&!await session.app.evaluate(()=>!!globalThis.qaNavigationFrameHeld);i++)await page.waitForTimeout(50);
 assert(await session.app.evaluate(()=>!!globalThis.qaNavigationFrameHeld),'actual fine terrain response must be held');
 assert(await page.locator('#land-tool').isDisabled(),'writer settlement still owns author controls');
 await page.mouse.move(x,y);
 await gesture('wheel while terrain refinement pending',()=>page.mouse.wheel(0,120));
 await session.app.evaluate(()=>globalThis.qaNavigationFrameRelease());
 await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled&&document.querySelector('#land-status').textContent.includes('Gespeichert'),null,{timeout:60000});
 await atlasCanvasReady(page);
 const committed=await writes();assert(committed>=pendingWrites);
 await page.locator('#atlas-undo').click();await atlasCanvasReady(page);
 await page.locator('#atlas-redo').click();await atlasCanvasReady(page);
 const receipts=await session.app.evaluate(()=>globalThis.qaNavigationWrites);
 assert.deepEqual(receipts.slice(-2).map(r=>[r.kind,r.ok]),[['undo',true],['redo',true]]);
 await session.capture(page,'settled-navigation');
 await session.close();
 if(process.env.PENDING_BASELINE!=='1')for(const check of checks.slice(1))assert(check.changed,check.name);
 await session.finish({checks,pose,committed,receipts,baseline:process.env.PENDING_BASELINE==='1'});
}catch(error){await session.fail(error);throw error;}finally{await session.dispose();}
