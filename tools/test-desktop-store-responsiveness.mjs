import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const require=createRequire(import.meta.url);
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/store-responsiveness-fixture.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require('../.build/store-responsiveness-fixture.cjs'),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/store-responsiveness');
const session=await createNativeSession({name:'store-responsiveness',output});
const store=new CampaignStore(session.profile+'/workbench.sqlite');
const room={scopeId:'local',floorId:'ground',revision:0,polygons:[{outer:[{x:0,y:0},{x:16,y:0},{x:16,y:12},{x:0,y:12}],holes:[]}],sections:[]};
const campaign=store.create('Große Kopie',Array.from({length:2000},(_,i)=>({...room,id:'room-'+i,number:String(i),name:'Raum '+i})));store.tutorial('skipped');store.close();
try{
 const page=await session.launch();await page.locator('.campaign-card').filter({hasText:campaign.name}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();await atlasCanvasReady(page);
 await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="land"]').click();await page.locator('[data-atlas-tool="land-shape"]').click();
 await page.locator('#land-radius-slider').focus();
 await page.evaluate(()=>{const field=document.querySelector('#land-radius-slider'),label=document.querySelector('#land-radius-value');window.qaVisibleInput={before:label.value};field.addEventListener('keydown',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.qaVisibleInput={...window.qaVisibleInput,after:label.value,elapsedMs:performance.now()-start};}));},{once:true,capture:true});});
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.qaVisibleInput.elapsedMs!==undefined);const visibleInput=await page.evaluate(()=>window.qaVisibleInput);assert.notEqual(visibleInput.before,visibleInput.after);await session.capture(page,'visible-brush-size');
 if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();await page.locator('#campaign-manager').click();
 await session.app.evaluate(()=>{globalThis.qaMainSamples=[];globalThis.qaMainStart=performance.now();let last=performance.now();globalThis.qaMainTimer=setInterval(()=>{const now=performance.now();globalThis.qaMainSamples.push(Math.max(0,now-last-5));last=now;},5);});
 await page.locator('#campaign-copy').click();await page.locator('#campaign-transfer-dialog').waitFor({state:'visible',timeout:120000});await page.waitForTimeout(30);
 const main=await session.app.evaluate(()=>{clearInterval(globalThis.qaMainTimer);const samples=globalThis.qaMainSamples.sort((a,b)=>a-b);return{elapsedMs:performance.now()-globalThis.qaMainStart,samples:samples.length,p95LagMs:samples[Math.floor(samples.length*.95)],maxLagMs:samples.at(-1)};});
 assert(main.samples>0);assert.match(await page.locator('#campaign-transfer-summary').innerText(),/2000 Räume/);await session.capture(page,'copy-preview');await page.locator('#campaign-transfer-cancel').click();await page.locator('#campaign-manager-close').click();
 await session.close();await session.finish({main,visibleInput,method:{main:'Electron Main 5ms timer lag during the real 2000-room copy preview',visibleInput:'native ArrowRight -> changed visible brush-radius label -> two renderer animation frames; presentation opportunity, no physical scanout or terrain-paint latency'}});
}catch(error){await session.fail(error);throw error;}finally{await session.dispose();}
