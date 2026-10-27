/** TW03/TW04/TW05 functional form probe. No timing/LOD qualification or baseline changes. */
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {createNativeSession} from './native-session.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {installTerrainWaterObserver} from './terrain-water-replay.mjs';
const root=process.cwd(),arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const form=arg('--form','mountain'),hills=form==='hills',canyon=form==='canyon';assert(['mountain','hills','canyon'].includes(form));
const uiScale=Number(arg('--ui-scale',1)),shapeOnly=process.argv.includes('--shape-only'),output=path.resolve(canyon?'.build/terrain-water-canyons':hills?'.build/terrain-water-hills':'.build/terrain-water-mountains',`${Date.now()}-${process.pid}`),require=createRequire(import.meta.url);
const baselineHeight=Number(arg('--baseline-height',canyon?850:250)),straightDepth=Number(arg('--straight-depth',canyon?700:hills?256:700));
const wideOnly=process.argv.includes('--wide-only');
assert(Number.isFinite(baselineHeight)&&Number.isFinite(straightDepth)&&straightDepth>0);
assert(process.env.TW_VIRTUAL_SESSION==='1','Use terrain-water-virtual-session.mjs for the isolated native Wayland proof');
const native=await createNativeSession({root,output,name:canyon?'terrain-water-canyons':hills?'terrain-water-hills':'terrain-water-mountains'}),Database=require('better-sqlite3');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {heightRecord,TerrainSampler} from './src/app/terrain-height';export {applyTerrainBrush} from './src/app/terrain-brush';",resolveDir:root},outfile:path.join(output,'fixture.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,TerrainSampler,applyTerrainBrush}=require(path.join(output,'fixture.cjs'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const payloadHash=rs=>hash(JSON.stringify(rs.filter(r=>r.height).map(r=>[r.id,r.height]).sort((a,b)=>a[0].localeCompare(b[0]))));
const sourceFiles=['src/app/terrain-brush.ts','src/app/terrain-brush-form.ts','src/app/terrain-brush-draft.ts','src/app/atlas-surface-draft.ts','src/app/storage/terrain-scale.ts','src/app/landscape-tool-settings.ts','src/app/landscape-brush-session.ts','src/app/atlas-raster-presentation.ts','src/app/atlas-deck-surface.ts','src/app/campaign-atlas-ui.ts','tools/test-desktop-terrain-water-mountains.mjs','tools/terrain-water-virtual-session.mjs','tools/native-session.mjs','tools/terrain-water-replay.mjs','tests/terrain-mountain-brush.test.mjs','tests/terrain-hills-brush.test.mjs','tests/terrain-canyon-brush.test.mjs','tests/terrain-mountain-settings.test.mjs'];
const result={kind:canyon?'TW05 native canyon form probe':hills?'TW04 native hills form probe':'TW03 native form probe',isolatedVirtualSession:true,virtualSessionEvidence:process.env.TW_VIRTUAL_OUTPUT,uiScale,diagnosticOnly:shapeOnly,seed:4711,started:new Date().toISOString(),sourceHashes:{},forms:[],limits:['Synthetic flat world and functional form checks only; no M3 performance or complete LOD matrix claim.','Local image and writer share a field; native captures retain normal display sampling differences.']};
for(const file of sourceFiles){const bytes=await readFile(file),snapshot=path.join(output,'source-snapshot',file);await mkdir(path.dirname(snapshot),{recursive:true});await writeFile(snapshot,bytes);result.sourceHashes[file]=hash(bytes);}
await writeFile(path.join(output,'source.diff'),execFileSync('git',['diff','HEAD'],{cwd:root}));
result.host={cpus:os.cpus().map(c=>c.model),memoryBytes:os.totalmem(),loadAtStart:os.loadavg(),node:process.version};
await writeFile(path.join(output,'prelaunch.json'),JSON.stringify({...result,artifacts:native.artifacts,command:[process.execPath,...process.argv.slice(1)]},null,2));
const filename=path.join(native.profile,'workbench.sqlite');let page,campaignId,campaignName=canyon?'TW05 Schluchtenformen':hills?'TW04 Hügellandschaft':'TW03 Bergformen';
const records=()=>{const db=new Database(filename,{readonly:true});try{return db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id').all(campaignId).map(r=>JSON.parse(r.payload));}finally{db.close();}};
const state=()=>{const db=new Database(filename,{readonly:true});try{return{revision:db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(campaignId).revision,hash:payloadHash(records())};}finally{db.close();}};
async function ready(revision=state().revision){await page.waitForFunction(revision=>{const n=document.querySelector('#campaign-map');return n?.dataset.terrainReady==='ready'&&n.dataset.terrainQuality==='detail'&&!n.dataset.terrainDraft&&Number(n.dataset.terrainRevision)===revision;},revision,{timeout:90000});}
async function frame(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function open(first=false){
 page=await native.launch(uiScale);await installTerrainWaterObserver(page,result.seed);
 await native.app.evaluate(({BrowserWindow,ipcMain})=>{
  BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setContentSize(1920,1080);
  globalThis.twMountainCommands=[];const original=ipcMain._invokeHandlers.get('atlas:commit');ipcMain.removeHandler('atlas:commit');ipcMain.handle('atlas:commit',async(e,c)=>{if(c.action?.kind==='landscape-height-stroke')globalThis.twMountainCommands.push(structuredClone(c.action.stroke));return original(e,c);});
 });
 if(first)await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-5000,y:-3333.3333333333335,width:10000,height:6666.666666666667})),campaignId);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:campaignName}).getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
 await page.waitForFunction(()=>!document.querySelector('main').inert&&document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:90000});
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await ready();await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="land"]').click();await page.locator('#atlas-units').selectOption('metric');
}
async function settings(radius,strength){
 await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();
 await page.locator(canyon?'[data-preset="4"]':hills?'[data-preset="0"]':'[data-preset="1"]').click();await setBrushWorldRadius(page,'land-radius',radius);
 await page.locator('#land-height-strength').fill(String(strength));await page.locator('#land-height-strength').press('Tab');
 assert.equal(await page.locator('#land-preset-status').textContent(),canyon?'Schluchtenpinsel':hills?'Hügelpinsel':'Bergpinsel');
 assert(await page.locator('#land-height-feather').isHidden());assert(await page.locator('#land-height-target-enabled').isHidden());
 assert(await page.locator('#land-finish').isHidden());assert(await page.locator('#land-cancel').isHidden());
}
async function paint(id,pathPoints,radius,strength,mode){
 await ready();
 if(mode){
  await page.locator('[data-tool-select="land-tool"][data-tool-value="'+(mode==='smooth'?'smooth':'height')+'"]').first().click();
  if(mode==='lower'||mode==='raise')await page.locator('[data-direction="'+mode+'"]').click();
  await setBrushWorldRadius(page,'land-radius',radius);await page.locator('#land-height-strength').fill(String(strength));await page.locator('#land-height-strength').press('Tab');
 }else await settings(radius,strength);
 if(id==='01-straight'){const input=page.locator('#land-height-strength');await input.focus();await input.press('Control+A');await input.pressSequentially('0.4');assert.equal(await input.inputValue(),'0.4','Decimal fragments must survive normal keyboard editing');await input.press('Tab');assert.equal(Number(await input.inputValue()),.4);result.manualDecimalInput=true;await input.fill(String(strength));await input.press('Tab');}
 const before=state(),sources=records(),commandCount=await native.app.evaluate(()=>globalThis.twMountainCommands.length),b=await page.locator('#campaign-map').boundingBox();
 const css=pathPoints.map(p=>({x:b.x+b.width*(.5+p[0]),y:b.y+b.height*.5+b.width*p[1]}));
 await page.mouse.move(css[0].x,css[0].y);await page.mouse.down();
 for(const p of css.slice(1)){await page.mouse.move(p.x,p.y,{steps:3});await frame();}
 await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='height',null,{timeout:15000});await frame();
 assert.equal(state().revision,before.revision,'No storage transaction before release');await native.capture(page,id+'-local.png');
 await page.mouse.up();await ready(before.revision+1);const after=state(),command=await native.app.evaluate(()=>globalThis.twMountainCommands.at(-1));
 assert.equal(await native.app.evaluate(()=>globalThis.twMountainCommands.length),commandCount+1,'Exactly one commit invocation per released gesture');
 assert.equal(command.form,mode?undefined:form);if(mode)assert.equal(command.mode,mode);assert.equal(command.radius,radius);assert.equal(command.seed,result.seed);
 const saved=records(),tiles=applyTerrainBrush(sources,command),expected=[...sources.filter(r=>!tiles.some(t=>t.id===r.id)),...tiles];assert.equal(payloadHash(saved),payloadHash(expected),'Canonical native write matches the shared form field');
 const sample=new TerrainSampler(saved,false),probes=command.samples.filter((_,i)=>i%Math.max(1,Math.floor(command.samples.length/12))===0).map(p=>({x:p.x,y:p.y,heightM:sample.sample(p).heightM}));
 await native.capture(page,id+'-canonical.png');
 assert.notEqual(after.hash,before.hash,'Every gesture changes authored height payloads');
 const entry={id,radius,strength,path:pathPoints,before,after,expectedHash:payloadHash(expected),command,commitInvocations:1,probes,tileCrossings:[...new Set(tiles.map(r=>`${r.height.x}/${r.height.y}`))]};result.forms.push(entry);await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({id,revision:after.revision,tiles:tiles.length,output}));return entry;
}
async function history(kind,expected){const before=state();await page.locator('#atlas-'+kind).click();await ready(before.revision+1);const after=state();assert.equal(after.hash,expected);(result.historyTransitions??=[]).push({kind,before,after,expectedHash:expected});}
async function undo(expected){await history('undo',expected);}
async function redo(expected){await history('redo',expected);}
async function tilt(){await page.locator('#atlas-view').click();const control=page.locator('#terrain-tilt');await control.evaluate(n=>{n.value='45';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));});await page.keyboard.press('Escape');await frame();}
async function top(){if(!await page.locator('#terrain-top').isVisible())await page.locator('#atlas-view').click();await page.locator('#terrain-top').click();await page.keyboard.press('Escape');await frame();}
try{
 const store=new CampaignStore(filename);try{const campaign=store.create(campaignName,[]);campaignId=campaign.id;const active=store.activate(campaignId);
  for(const y of [-1,0])for(const x of [-1,0])store.executeAtlasCommit({commandId:randomUUID(),campaignId,token:active.token,action:{kind:'landscape-put',expectedRevision:null,record:heightRecord(x*8192,y*8192,128,new Float32Array(4096).fill(baselineHeight))}});
  store.tutorial('skipped');
 }finally{store.close();}
 await open(true);result.fixture={campaignId,baseline:state(),formula:`constant ${baselineHeight} m, four 8192 m base tiles, pixel 128 m`};
 result.display=await page.evaluate(()=>{const c=document.querySelector('#atlas-terrain-spatial canvas'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{innerWidth,innerHeight,devicePixelRatio,canvas:c.getBoundingClientRect().toJSON(),buffer:[g.drawingBufferWidth,g.drawingBufferHeight],gpu:e?{vendor:g.getParameter(e.UNMASKED_VENDOR_WEBGL),renderer:g.getParameter(e.UNMASKED_RENDERER_WEBGL)}:null};});result.gpuInfo=await native.app.evaluate(({app})=>app.getGPUInfo('complete'));
 await native.capture(page,'00-baseline.png');
 if(wideOnly){
  await paint('05-wide',hills||canyon?[[-.23,-.08],[.23,-.08],[.23,.08],[-.23,.08]]:[[-.27,.04],[-.16,-.04],[0,.02],[.15,-.04],[.26,.04]],hills||canyon?1800:1450,canyon?700:hills?576:1000);
  await tilt();await ready();await native.capture(page,'05-wide-tilted.png');
  result.scope='TW06-F1 focused replay of the unchanged wide form, local/canonical and tilted; no complete form, LOD or performance qualification';
 }else{
 const straight=await paint('01-straight',[[-.32,.02],[.32,.02]],800,straightDepth);assert(straight.tileCrossings.length>=6,'Cross several positive/negative author tile edges');await tilt();await native.capture(page,'01-straight-tilted.png');await top();
 if(!shapeOnly){
 const overlap=await paint('02-overlap',[[-.13,-.15],[.02,.04],[.18,.16]],800,canyon?650:hills?220:650);await tilt();await native.capture(page,'02-overlap-tilted.png');await top();
 await undo(straight.after.hash);await undo(result.fixture.baseline.hash);await redo(straight.after.hash);await redo(overlap.after.hash);result.history={twoUndoTwoRedo:true,hash:state().hash};
 if(canyon){assert(straight.probes.every(p=>p.heightM>0),'straight canyon bed remains dry');assert(overlap.probes.some(p=>p.heightM<0),'crossing incision passes below the sea');result.seaCut={seaLevelM:0,dryBed:straight.probes,submergedCrossing:overlap.probes,waterAuthorRecords:records().filter(r=>r.surface==='freshwater'||r.kind==='river'||r.route).length,nonHeightRecords:records().filter(r=>!r.height).map(r=>({id:r.id,kind:r.kind,surface:r.surface}))};assert.equal(result.seaCut.waterAuthorRecords,0);assert.deepEqual(result.seaCut.nonHeightRecords,[]);}
 await undo(straight.after.hash);await undo(result.fixture.baseline.hash);
 const curved=await paint('04-curved',[[-.32,.08],[-.23,-.01],[-.1,-.1],[.04,-.08],[.16,.02],[.29,.08]],800,canyon?700:hills?256:700);await tilt();await native.capture(page,'04-curved-tilted.png');await top();await undo(result.fixture.baseline.hash);
 await redo(curved.after.hash);await undo(result.fixture.baseline.hash);
 // Preserve the original mountain regression geometry and radius. Correction
 // coverage must not silently substitute the hills/canyon broad return path.
 const wide=await paint('05-wide',hills||canyon?[[-.23,-.08],[.23,-.08],[.23,.08],[-.23,.08]]:[[-.27,.04],[-.16,-.04],[0,.02],[.15,-.04],[.26,.04]],hills||canyon?1800:1450,canyon?700:hills?576:1000);await tilt();await native.capture(page,'05-wide-tilted.png');
 {
  await top();await undo(result.fixture.baseline.hash);await redo(wide.after.hash);const lower=await paint(canyon?'06-raise':'06-lower',[[-.03,0],[.03,0]],420,180,canyon?'raise':'lower');await tilt();await native.capture(page,(canyon?'06-raise':'06-lower')+'-tilted.png');await top();
  const smooth=await paint('07-smooth',[[-.04,0],[.04,0]],650,300,'smooth');await tilt();await native.capture(page,'07-smooth-tilted.png');await top();
  await undo(lower.after.hash);await undo(wide.after.hash);await redo(lower.after.hash);await redo(smooth.after.hash);result.correctionHistory={basicAndSmoothUndoRedo:true,hash:state().hash};result.gestureHistory={allPaintedGesturesUndoRedo:true,gestures:result.forms.map(f=>f.id)};
  const saved=state();await native.close();await open();assert.equal(state().hash,saved.hash);assert.equal(state().hash,smooth.expectedHash);result.fresh={hash:state().hash,expectedHash:smooth.expectedHash,newNativeProcess:true,includesBasicCorrections:true};await native.capture(page,'03-fresh-reopen.png');
 }
 }
 }
 result.host.loadAtEnd=os.loadavg();result.finished=new Date().toISOString();await native.close();
 const savedDb=new Database(filename);try{await savedDb.backup(path.join(output,'synthetic-world.sqlite'));}finally{savedDb.close();}
 await native.finish(result);console.log(output);
}catch(error){await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));await native.fail(error);console.error(output);throw error;}finally{
 await native.dispose();await rm(native.profile,{recursive:true,force:true});
 const profileRemoved=await stat(native.profile).then(()=>false,()=>true);assert(profileRemoved,'Own synthetic profile must be removed');
 const finalPath=path.join(output,'result.json'),final=await readFile(finalPath,'utf8').then(JSON.parse).catch(()=>null);
 if(final)await writeFile(finalPath,JSON.stringify({...final,cleanup:{profileRemoved,profile:native.profile}},null,2));
}
