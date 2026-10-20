// Verifies the literal repository development command with an isolated campaign profile.
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,readFile,writeFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
import {terrainContourPixels} from './terrain-contour-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-development-start');
await mkdir(out,{recursive:true});const base=path.join(homedir(),'.cache/saltmarcher/ui');await mkdir(base,{recursive:true});const profile=await mkdtemp(base+'/atlas-development-');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';"},outfile:'.build/atlas-development-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord}=require(root+'/.build/atlas-development-store.cjs'),store=new CampaignStore(profile+'/workbench.sqlite'),campaign=store.create('Repository-Start'),token=store.activate(campaign.id).token;
for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)store.executeAtlasCommit({token,campaignId:campaign.id,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*1024,y*1024,16,Float32Array.from({length:4096},(_,i)=>{const px=x*1024+i%64*16,py=y*1024+Math.floor(i/64)*16;return 20+90*Math.exp(-(px*px+py*py)/40000);}))}});
store.tutorial('skipped');store.close();
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const args=['run','start:desktop','--','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--data-dir',profile];
const child=spawn('npm',args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
let outcome;const exited=new Promise(r=>child.once('exit',(code,signal)=>{outcome={code,signal};r(outcome);}));
let browser,page;const result={root,command:['npm',...args],profile,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],errors:[]};
try{
 for(let i=0;i<600;i++){
  if(outcome)throw Error('Development command exited before UI: '+JSON.stringify(outcome)+'\n'+logs);
  try{const response=await fetch('http://127.0.0.1:'+port+'/json/version');if(response.ok)break;}catch{}
  if(i===599)throw Error('Development command did not expose its window');await new Promise(r=>setTimeout(r,100));
 }
 browser=await require('playwright-core').chromium.connectOverCDP('http://127.0.0.1:'+port);
 page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/index.html'));assert(page,'Real desktop index window missing');page.setDefaultTimeout(20000);page.on('pageerror',e=>result.errors.push(e.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.evaluate(()=>{
  window.__terrainLoads=[];
  new MutationObserver(()=>{
   const el=document.querySelector('#campaign-map'),quality=el?.dataset.terrainQuality;
   if(!quality||el.dataset.terrainReady!=='ready')return;
   const rows=window.__terrainLoads,last=rows.at(-1);
   if(last?.quality!==quality)rows.push({quality,time:performance.now(),view:JSON.parse(el.dataset.terrainProjection)});
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-terrain-ready','data-terrain-quality']});
 });
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-450,y:-300,width:900,height:600})),campaign.id);
 await page.locator('.campaign-card').filter({hasText:'Repository-Start'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 const ready=async()=>{await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready');};await ready();
 assert.equal(await page.locator('#campaign-map').getAttribute('data-terrain-view'),'main');const surface=await page.locator('#atlas-terrain-spatial').elementHandle();assert.equal(await page.locator('#vegetation-spatial-dialog').count(),0);
 await page.waitForFunction(()=>window.__terrainLoads.some(r=>r.quality==='overview'));
 const early=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),area=await page.locator('#campaign-map').boundingBox();
 await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.wheel(0,-60);
 await page.waitForFunction(w=>JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width<w,early.width);
 const cameraQuality=await page.locator('#campaign-map').getAttribute('data-terrain-quality');
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail');
 result.loading={stages:await page.evaluate(()=>window.__terrainLoads),cameraQuality};
 assert.deepEqual(result.loading.stages.slice(0,2).map(r=>r.quality),['overview','detail']);
 assert.equal(cameraQuality,'overview','camera must respond while detail is still pending');
 assert(await surface.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
 result.checks.push('Overview geometry becomes usable before fine colour; wheel navigation responds during refinement on the same canvas.');
 await page.screenshot({path:out+'/01-repository-atlas.png'});
 assert.equal(await page.locator('#land-contours').inputValue(),'-1','automatic contours are the default');
 result.contours=await terrainContourPixels(page);
 await page.locator('#atlas-view').click();await page.locator('#terrain-tilt').fill('45');await page.locator('#terrain-tilt').dispatchEvent('input');await page.locator('#terrain-rotation').fill('25');await page.locator('#terrain-rotation').dispatchEvent('input');await page.keyboard.press('Escape');await ready();
 assert(await surface.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
 const before=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),bounds=await page.locator('#campaign-map').boundingBox();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.wheel(0,-300);await page.waitForFunction(w=>JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width<w,before.width);await ready();
 result.camera=JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection'));assert.equal(result.camera.tilt,45);assert.equal(result.camera.rotation,25);assert(await surface.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
 assert(result.camera.refinement);assert.equal(result.camera.columns,257);assert.equal(result.camera.rows,257);
 result.refinementCapture={before:await page.locator('#campaign-map').getAttribute('data-terrain-quality')};
 await page.screenshot({path:out+'/03-navigation-overview.png'});
 result.refinementCapture.after=await page.locator('#campaign-map').getAttribute('data-terrain-quality');
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail');
 await page.screenshot({path:out+'/02-repository-tilt-zoom.png'});result.checks.push('npm run start:desktop launches this repository; campaign navigation opens the main Atlas.','Tilt, rotation and wheel zoom retain the same main canvas.');
 result.checks.push('Automatic GPU contours match screen-space reference ink across four scales; tiled output retains identical levels.');
 result.artifacts={};for(const file of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html'])result.artifacts[file]=createHash('sha256').update(await readFile('.build/desktop/'+file)).digest('hex');
 await page.close({runBeforeUnload:true});const closed=await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Development command did not exit normally')),15000))]);assert.deepEqual(closed,{code:0,signal:null});assert.deepEqual(result.errors,[]);result.exit=closed;
 await assert.rejects(stat('/proc/'+child.pid),{code:'ENOENT'});result.pidAbsent=true;await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.checks));
}catch(error){result.error=error.stack;if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify(result,null,2));throw error;}
finally{await writeFile(out+'/development-command.log',logs);await browser?.close().catch(()=>{});if(!outcome)child.kill('SIGTERM');}
