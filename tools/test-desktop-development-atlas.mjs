import {terrainCoveragePixels} from './terrain-coverage-probe.mjs';
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
import {terrainDetailPixels} from './terrain-detail-probe.mjs';
const root=process.cwd(),require=createRequire(root+'/package.json'),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-development-start');
await mkdir(out,{recursive:true});const base=path.join(homedir(),'.cache/saltmarcher/ui');await mkdir(base,{recursive:true});const profile=await mkdtemp(base+'/atlas-development-');
require('esbuild').buildSync({stdin:{resolveDir:root,contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export {terrainHorizon} from './src/app/terrain-coverage';"},outfile:'.build/atlas-development-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,terrainHorizon}=require(root+'/.build/atlas-development-store.cjs'),store=new CampaignStore(profile+'/workbench.sqlite'),campaign=store.create('Repository-Start'),token=store.activate(campaign.id).token;
if(process.env.TERRAIN_COVERAGE_PROBE==='1')for(let y=-1;y<1;y++)for(let x=-1;x<1;x++)store.executeAtlasCommit({token,campaignId:campaign.id,commandId:randomUUID(),action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*65536,y*65536,1024,new Float32Array(4096).fill(20))}});
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
  window.__terrainLoads=[];window.__terrainTileLoads=[];
  new MutationObserver(()=>{
   const el=document.querySelector('#campaign-map'),quality=el?.dataset.terrainQuality;
   if(!quality||el.dataset.terrainReady!=='ready')return;
   const tiles=el.dataset.terrainTiles,tileRows=window.__terrainTileLoads;if(tiles&&tileRows.at(-1)?.tiles!==tiles)tileRows.push({tiles,time:performance.now()});
   const rows=window.__terrainLoads,last=rows.at(-1);
   if(last?.quality!==quality)rows.push({quality,time:performance.now(),view:JSON.parse(el.dataset.terrainProjection)});
  }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-terrain-ready','data-terrain-quality','data-terrain-tiles']});
 });
 await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-450,y:-300,width:900,height:600})),campaign.id);
 await page.locator('.campaign-card').filter({hasText:'Repository-Start'}).getByRole('button',{name:/^(Fortsetzen|Öffnen)$/}).click();
 await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 const ready=async()=>{await atlasCanvasReady(page);await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainReady==='ready');};await ready();
 assert.equal(await page.locator('#campaign-map').getAttribute('data-terrain-view'),'main');assert.equal(await page.locator('#campaign-map').getAttribute('data-atlas-terrain-raster'),'false');assert.equal(await page.locator('#campaign-map').getAttribute('data-atlas-landscape-tiles'),'0');const surface=await page.locator('#atlas-terrain-spatial').elementHandle();assert.equal(await page.locator('#vegetation-spatial-dialog').count(),0);
 await page.waitForFunction(()=>window.__terrainLoads.some(r=>r.quality==='overview'));
 const early=JSON.parse(await page.locator('#campaign-map').getAttribute('data-atlas-view')),area=await page.locator('#campaign-map').boundingBox();
 await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.wheel(0,-60);
 await page.waitForFunction(w=>JSON.parse(document.querySelector('#campaign-map').dataset.atlasView).width<w,early.width);
 const cameraQuality=await page.locator('#campaign-map').getAttribute('data-terrain-quality');
 await page.waitForFunction(()=>{const parts=document.querySelector('#campaign-map').dataset.terrainTiles?.split('/').map(Number);return parts&&parts[0]>0&&parts[0]<parts[1];});
 await page.screenshot({path:out+'/06-first-color-tiles.png'});
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainQuality==='detail');
 result.loading={stages:await page.evaluate(()=>window.__terrainLoads),cameraQuality,tiles:await page.evaluate(()=>window.__terrainTileLoads)};
 assert.equal(result.loading.stages[0].quality,'overview');assert(result.loading.stages.some(r=>r.quality==='refining'));assert.equal(result.loading.stages.at(-1).quality,'detail');assert(result.loading.tiles.some(r=>{const [done,total]=r.tiles.split('/').map(Number);return done>0&&done<total;}));
 assert(['overview','refining'].includes(cameraQuality),'camera must respond while detail is still pending');
 assert(await surface.evaluate(el=>el===document.querySelector('#atlas-terrain-spatial')));
 result.checks.push('Overview geometry becomes usable before fine colour; center-first colour tiles appear incrementally and wheel navigation responds during refinement on the same canvas.');
 await page.screenshot({path:out+'/01-repository-atlas.png'});
 assert.equal(await page.locator('#land-contours').inputValue(),'-1','automatic contours are the default');
 result.contours=await terrainContourPixels(page);
 result.detailUploads=await terrainDetailPixels(page);
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
 // Real GPU context loss must request a complete fallback region before presenting it.
 await page.evaluate(()=>document.querySelector('#atlas-terrain-spatial').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.renderer==='canvas2d'&&document.querySelector('#campaign-map').dataset.atlasTerrainRaster==='true');await atlasCanvasReady(page);
 assert(Number(await page.locator('#campaign-map').getAttribute('data-atlas-landscape-tiles'))>0);await page.screenshot({path:out+'/04-graphics-fallback.png'});
 await page.locator('#atlas-view').click();await page.locator('#atlas-camera-retry').click();await page.keyboard.press('Escape');await ready();
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.atlasTerrainRaster==='false');assert.equal(await page.locator('#campaign-map').getAttribute('data-renderer'),'webgl');
 await page.screenshot({path:out+'/05-camera-recovered.png'});result.checks.push('Main view omits duplicate ground images; actual GPU loss reloads complete Canvas terrain and explicit retry restores the main camera.');
 if(process.env.TERRAIN_COVERAGE_PROBE==='1'){
  await page.waitForFunction(()=>document.querySelector('#atlas-save-status').dataset.error!=='true'&&document.querySelector('#status').dataset.error!=='true');
  const canvas=await page.locator('#atlas-terrain-spatial').elementHandle();
  await page.locator('#atlas-view').click();
  await page.locator('#terrain-tilt').evaluate(n=>{n.value='75';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.keyboard.press('Escape');await ready();
  await page.waitForFunction(()=>{const v=JSON.parse(document.querySelector('#campaign-map').dataset.terrainProjection);return v.tilt===75&&v.box.width/Math.max(v.frame.width,v.frame.height)>50;});
  const wide=JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection'));
  result.coverageGpu=await page.locator('#atlas-terrain-spatial').evaluate(n=>{
   const gl=n.getContext('webgl2'),program=gl.getParameter(gl.CURRENT_PROGRAM),uniforms={};
   for(const name of ['fogNear','fogFar']){const location=gl.getUniformLocation(program,name);uniforms[name]=location?gl.getUniform(program,location):null;}
   const c=document.createElement('canvas');c.width=n.width;c.height=n.height;c.getContext('2d').drawImage(n,0,0);const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sky=0;
   for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-197)<2&&Math.abs(pixels[i+1]-215)<2&&Math.abs(pixels[i+2]-223)<2)sky++;
   return {uniforms,skyFraction:sky/(c.width*c.height),status:['status','atlas-save-status'].map(id=>({id,text:document.getElementById(id)?.textContent,error:document.getElementById(id)?.dataset.error})),retryHidden:document.getElementById('atlas-camera-retry')?.hidden};
  });
  const horizon=terrainHorizon(wide);assert(Math.abs(result.coverageGpu.uniforms.fogFar-horizon.far)<horizon.far*1e-5);assert(result.coverageGpu.skyFraction<.2,'only the actual sky above the horizon may remain in the inland fixture');
  await page.screenshot({path:out+'/07-wide-horizon.png'});
  await page.locator('#atlas-view').click();await page.locator('#terrain-rotation').evaluate(n=>{n.value='110';n.dispatchEvent(new Event('input',{bubbles:true}));});await page.keyboard.press('Escape');await ready();
  const rotated=JSON.parse(await page.locator('#campaign-map').getAttribute('data-terrain-projection'));
  assert.deepEqual(rotated.box,wide.box);assert.equal(rotated.rotation,110);assert(await canvas.evaluate(n=>n===document.querySelector('#atlas-terrain-spatial')));
  await page.screenshot({path:out+'/08-rotated-horizon.png'});
  result.coverage={wide,rotated,pixels:await terrainCoveragePixels(page,out)};
  result.checks.push('Steep tilt expands terrain coverage in the normal Atlas; rotation retains the same coverage and main canvas; horizon and tiled export pixel checks pass.');
 }
 result.artifacts={};for(const file of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html'])result.artifacts[file]=createHash('sha256').update(await readFile('.build/desktop/'+file)).digest('hex');
 await page.close({runBeforeUnload:true});const closed=await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Development command did not exit normally')),15000))]);assert.deepEqual(closed,{code:0,signal:null});assert.deepEqual(result.errors,[]);result.exit=closed;
 await assert.rejects(stat('/proc/'+child.pid),{code:'ENOENT'});result.pidAbsent=true;await writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.checks));
}catch(error){result.error=error.stack;if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify(result,null,2));throw error;}
finally{await writeFile(out+'/development-command.log',logs);await browser?.close().catch(()=>{});if(!outcome)child.kill('SIGTERM');}
