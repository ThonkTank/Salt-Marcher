// Isolated diagnosis of navigation/brush latency while automatic recovery runs.
// Source must be a retained synthetic world, never a live user database.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),Database=require('better-sqlite3'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const source=process.env.BACKUP_PROBE_SOURCE;assert(source,'Set BACKUP_PROBE_SOURCE to a retained synthetic workbench.sqlite');
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/backup-impact'),native=await createNativeSession({output,name:'backup-impact'});
const db=new Database(source,{readonly:true});
const id=db.prepare('SELECT id FROM campaign').get().id;await db.backup(native.profile+'/workbench.sqlite');db.close();
const result={events:[]};let page,cdp,profiling=false;
const mark=async name=>{result.events.push({name,time:performance.now()});console.log(name);await writeFile(output+'/progress.json',JSON.stringify(result,null,2));};
async function stopProfile(){if(!profiling)return;profiling=false;const {profile}=await cdp.send('Profiler.stop');await writeFile(output+'/renderer.cpuprofile',JSON.stringify(profile));const main=await native.app.evaluate(()=>new Promise((r,j)=>global.__profileSession.post('Profiler.stop',(e,v)=>{global.__profileSession.disconnect();e?j(e):r(v.profile);})));await writeFile(output+'/main.cpuprofile',JSON.stringify(main));}
try {
 page=await native.launch();page.setDefaultTimeout(90000);await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900));
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-20000000,y:-12500000,width:40000000,height:25000000})),id);
 await mark('open');await page.locator('.campaign-card').getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert,null,{timeout:90000});
 await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});await mark('ready');
 await page.locator('#atlas-section').selectOption('terrain');await atlasCanvasReady(page);await page.locator('#atlas-units').selectOption('metric');await page.locator('[data-tool-group="land"]').click();
 await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();await setBrushWorldRadius(page,'land-radius',4023360);await page.locator('#land-height-target-enabled').uncheck();await page.locator('#land-height-strength').fill('500');
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready',null,{timeout:90000});
 cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await native.app.evaluate(async()=>{const {Session}=process.getBuiltinModule('node:inspector');global.__profileSession=new Session();global.__profileSession.connect();await new Promise((r,j)=>global.__profileSession.post('Profiler.enable',e=>e?j(e):r()));await new Promise((r,j)=>global.__profileSession.post('Profiler.start',e=>e?j(e):r()));});profiling=true;
 await page.evaluate(()=>{window.__settle={long:[],changes:[],frames:[]};let prev=performance.now();const frame=t=>{if(t-prev>50)window.__settle.frames.push({t,gap:t-prev});prev=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);new PerformanceObserver(l=>window.__settle.long.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});const map=document.querySelector('#campaign-map');new MutationObserver(()=>window.__settle.changes.push({time:performance.now(),view:map.dataset.atlasView,revision:map.dataset.terrainRevision,quality:map.dataset.terrainQuality,tiles:map.dataset.terrainTiles})).observe(map,{attributes:true,attributeFilter:['data-atlas-view','data-terrain-revision','data-terrain-quality','data-terrain-tiles']});});
 const box=await page.locator('#campaign-map').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await mark('down');await page.mouse.down();await wait(3000);await page.mouse.move(x+60,y+20,{steps:5});await wait(1000);await page.mouse.up();await mark('released');await wait(1000);
 await mark('wheel-send');await page.mouse.wheel(0,-120);await mark('wheel-ack');await wait(250);result.after=await page.locator('#campaign-map').evaluate(n=>({view:n.dataset.atlasView,pending:document.querySelector('#land-tool').disabled,time:performance.now()}));await mark('state-returned');
 await page.waitForFunction(()=>!document.querySelector('#land-tool').disabled,null,{timeout:90000});await mark('settled');await wait(3000);await stopProfile();result.trace=await page.evaluate(()=>window.__settle);await native.capture(page,'settled');await native.close();await native.finish(result);console.log(JSON.stringify({events:result.events,after:result.after}));
}catch(e){await stopProfile().catch(err=>console.error('profile stop',err));await native.fail(e);throw e;}finally{await native.dispose();}
