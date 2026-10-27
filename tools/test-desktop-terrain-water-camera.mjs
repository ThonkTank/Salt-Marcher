// TW02: real shared-owner mouse/keyboard/sea interactions, isolated terrain-only profile.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import os from 'node:os';
import {createNativeSession} from './native-session.mjs';
import {setBrushWorldRadius} from './atlas-brush-probe.mjs';
import {createTerrainWaterKeyboard} from './terrain-water-native-keyboard.mjs';
import {focusTerrainWindow} from './terrain-water-focus.mjs';
/** Require an outstanding reply before the one planned navigation attempt. */
export async function requireHeldTerrainReply(app,{timeoutMs=15000}={}){
 const deadline=Date.now()+timeoutMs;
 do{
  const held=await app.evaluate(()=>globalThis.twTileHeld.length);
  if(held>0)return held;
  if(Date.now()>=deadline)break;
  await new Promise(resolve=>setTimeout(resolve,20));
 }while(true);
 assert.fail('Navigation qualification requires at least one actually open terrain reply; no replacement attempt');
}
async function main(){
const {createTerrainWaterFixture,heightPayloadHash}=await import('./terrain-water-fixture.mjs');
const root=process.cwd(),output=path.resolve('.build/terrain-water-camera',`${Date.now()}-${process.pid}`);
const skipFocus=process.argv.includes('--skip-focus'),focusOnly=process.argv.includes('--focus-only');
assert(!(skipFocus&&focusOnly));
const uiScale=Number(process.argv[process.argv.indexOf('--ui-scale')+1])||1;
const native=await createNativeSession({root,output,name:'terrain-water-camera'}),require=createRequire(import.meta.url),Database=require('better-sqlite3');
let page,fixture,focusSession,nativeKeyboard;
const result={isolatedVirtualSession:process.env.TW_VIRTUAL_SESSION==='1',virtualSessionEvidence:process.env.TW_VIRTUAL_OUTPUT??null,uiScale,steps:[],host:{cpus:os.cpus().map(c=>c.model),memoryBytes:os.totalmem(),loadAtStart:os.loadavg(),node:process.version},limits:['TW02 interaction qualification; continuous world-to-room LOD/frame-time matrix remains TW06/TW07.']};
const sourceFiles=['src/app/atlas-canvas.ts','src/app/atlas-camera-navigation.ts','src/app/atlas-presentation.ts','src/app/atlas-raster-presentation.ts','src/app/atlas-landscape-ui.ts','src/app/atlas-workspace-layout.ts','src/app/campaign-atlas-ui.ts','src/app/atlas-deck-surface.ts','tools/test-desktop-terrain-water-camera.mjs','tools/native-session.mjs','tools/terrain-water-virtual-session.mjs','tools/terrain-water-native-keyboard.mjs','tools/terrain-water-eis-keyboard.py','tools/terrain-water-fixture.mjs','tools/fixtures/terrain-water/v1.json','tools/terrain-water-focus.mjs','tools/terrain-water-focus-reporter.py','tests/atlas-camera-navigation.test.mjs','tests/desktop-atlas-canvas.test.mjs'];
result.sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>{const bytes=await readFile(file),snapshot=path.join(output,'source-snapshot',file);await mkdir(path.dirname(snapshot),{recursive:true});await writeFile(snapshot,bytes);return[file,createHash('sha256').update(bytes).digest('hex')];})));
await writeFile(path.join(output,'source.diff'),execFileSync('git',['diff','HEAD'],{cwd:root}));
function state(){const db=new Database(fixture.filename,{readonly:true});try{return{heights:heightPayloadHash(db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?').all(fixture.campaignId).map(r=>JSON.parse(r.payload))),revision:db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(fixture.campaignId).revision,sea:db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?').all(fixture.campaignId).map(r=>JSON.parse(r.payload)).find(r=>r.terrainSettings)?.terrainSettings.seaLevelM??0};}finally{db.close();}}
async function ready(expected=state().revision){await page.waitForFunction(expected=>{const m=document.querySelector('#campaign-map');return m?.dataset.terrainReady==='ready'&&m.dataset.terrainQuality==='detail'&&!m.dataset.terrainDraft&&Number(m.dataset.terrainRevision)===expected;},expected,{timeout:90000});}
const view=()=>page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.atlasView));
const camera=()=>page.locator('#campaign-map').evaluate(n=>JSON.parse(n.dataset.terrainCamera));
async function pixels(){return page.evaluate(()=>{const c=document.querySelector('#atlas-terrain-spatial canvas'),g=c.getContext('webgl2'),d=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.bindFramebuffer(g.READ_FRAMEBUFFER,null);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,d);let hash=2166136261,opaque=0;for(let i=0;i<d.length;i+=4*17){hash=Math.imul(hash^d[i],16777619);hash=Math.imul(hash^d[i+1],16777619);hash=Math.imul(hash^d[i+2],16777619);opaque+=Number(d[i+3]>240);}return{hash:hash>>>0,opaque,buffer:[g.drawingBufferWidth,g.drawingBufferHeight]};});}
async function frame(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.waitForTimeout(180);}
async function record(kind,extra={}){result.steps.push({kind,state:state(),view:await view(),camera:await camera(),pixels:await pixels(),...extra});await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));}
async function drag(button,dx,dy){const b=await page.locator('#campaign-map').boundingBox(),x=b.x+b.width*.55,y=b.y+b.height*.58;await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up({button});await frame();}
async function open(initial=false){
 page=await native.launch(uiScale);
 await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setContentSize(1920,1080));
 await page.addInitScript(()=>{window.__twCameraEvents=[];for(const kind of ['pointerdown','pointerup','wheel','keydown','keyup','focus','blur'])window.addEventListener(kind,e=>window.__twCameraEvents.push({kind,code:e.code,button:e.button,trusted:e.isTrusted,target:e.target===window?'window':e.target.id,at:performance.now(),focused:document.hasFocus()}),true);});
 if(initial)await page.evaluate(id=>localStorage.setItem('atlas-camera:'+id,JSON.stringify({x:-5000,y:-3333.3333333333335,width:10000,height:6666.666666666667})),fixture.campaignId);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await page.locator('.campaign-card').filter({hasText:fixture.campaignName}).getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
 await page.waitForFunction(()=>!document.querySelector('main').inert&&document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:90000});
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await ready();await page.locator('#atlas-section').selectOption('terrain');await page.locator('[data-tool-group="land"]').click();await page.locator('#atlas-units').selectOption('metric');
}
async function clearEye(){
 const pose=await camera(),box=await view(),height=await page.locator('#campaign-map').evaluate(n=>n.clientHeight);
 const distance=height*pose.metersPerPixel*1.5,t=pose.tilt*Math.PI/180,a=pose.rotation*Math.PI/180;
 const eye={x:pose.focus.x+Math.sin(a)*Math.sin(t)*distance,y:pose.focus.y+Math.cos(a)*Math.sin(t)*distance,heightM:pose.focusHeightM+Math.cos(t)*distance/pose.exaggeration};
 const db=new Database(fixture.filename,{readonly:true});let ground;
 try{const {TerrainSampler}=require(path.join(root,'.build/terrain-water-fixture/store.cjs'));ground=new TerrainSampler(db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=?').all(fixture.campaignId).map(r=>JSON.parse(r.payload))).sample(eye).heightM;}finally{db.close();}
 assert(eye.heightM>=ground+Math.max(.05,box.width*1e-6)-1e-6,'UI view change leaves the physical eye above terrain');return{eye,ground};
}
async function poseControl(name,value){
 const control=page.locator('#terrain-'+name),bounds=await control.boundingBox(),range=await control.evaluate(n=>({min:Number(n.min),max:Number(n.max)}));
 await control.click({position:{x:8+(bounds.width-16)*(value-range.min)/(range.max-range.min),y:bounds.height/2}});
 const actual=Number(await control.inputValue());assert(Number.isInteger(actual)&&actual>=range.min&&actual<=range.max,'Range value is a bounded integer');
 for(let n=actual;n!==value;n+=Math.sign(value-actual))await control.press(actual<value?'ArrowRight':'ArrowLeft');
 assert.equal(Number(await control.inputValue()),value);
}
async function top(){await page.locator('#atlas-view').click();await page.locator('#terrain-top').click();await page.locator('#atlas-view').click();await frame();}
async function lockCheck(){if(process.env.TW_VIRTUAL_SESSION==='1'){result.lock={isolated:true,hostLockIndependent:true,session:process.env.TW_VIRTUAL_OUTPUT};return;}const raw=execFileSync('gdbus',['call','--session','--dest','org.freedesktop.ScreenSaver','--object-path','/ScreenSaver','--method','org.freedesktop.ScreenSaver.GetActive'],{encoding:'utf8',timeout:5000}).trim();result.lock={raw,at:new Date().toISOString()};assert.equal(raw,'(false,)','Real keyboard focus needs an unlocked desktop session');}
try{
 if(!skipFocus)await lockCheck();else result.limits.push('Real WASD/window-blur focus checks explicitly omitted; separate unlocked run required.');fixture=await createTerrainWaterFixture(native.profile);result.fixture=fixture;await open(true);
 const initial=state();assert(await page.locator('#land-sea-level').isVisible(),'Sea level is directly reachable with the land brush');assert(await page.locator('#land-finish').isHidden());assert(await page.locator('#land-cancel').isHidden());
 result.display=await page.evaluate(()=>{const c=document.querySelector('#atlas-terrain-spatial canvas'),g=c.getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{innerWidth,innerHeight,devicePixelRatio,render:c.getBoundingClientRect().toJSON(),gpu:e?{vendor:g.getParameter(e.UNMASKED_VENDOR_WEBGL),renderer:g.getParameter(e.UNMASKED_RENDERER_WEBGL)}:null};});
 await native.capture(page,'01-terrain');await record('initial');
 if(!focusOnly){
 const startPixels=await pixels(),startView=await view();await drag('right',100,145);let pose=await camera();assert(pose.tilt>30&&pose.tilt<60);assert(pose.rotation>20);assert.equal(state().revision,initial.revision);assert.notEqual((await pixels()).hash,startPixels.hash);await record('RMB orbit+tilt');
 await drag('right',0,500);pose=await camera();assert.equal(pose.tilt,75);assert.equal(state().revision,initial.revision);await record('75-degree limit');
 const beforePan=await view();await drag('middle',70,-25);assert.notDeepEqual(await view(),beforePan);assert.equal(state().revision,initial.revision);await record('MMB pan after orbit, no drawing wait');
 const pannedView=await view();
 await page.getByRole('button',{name:'Vorige Ansicht',exact:true}).click();await frame();assert.deepEqual(await view(),beforePan);await record('previous UI view clears retained terrain',await clearEye());await native.capture(page,'01b-history');
 await page.getByRole('button',{name:'Nächste Ansicht →',exact:true}).click();await frame();assert.deepEqual(await view(),pannedView);await record('next UI view clears retained terrain',await clearEye());
 await page.locator('#atlas-view').click();await page.locator('#atlas-reset-view').click();await page.locator('#atlas-view').click();await frame();assert.notDeepEqual(await view(),pannedView);await record('reset UI view clears retained terrain',await clearEye());
 await page.getByRole('button',{name:'Vorige Ansicht',exact:true}).click();await frame();assert.deepEqual(await view(),pannedView);

 // Above the horizon, zoom remains bounded around the current focus.
 const skyBox=await page.locator('#campaign-map').boundingBox(),skyBefore=await camera();
 await page.mouse.move(skyBox.x+skyBox.width/2,skyBox.y+2);await page.mouse.wheel(0,-80);await frame();const skyAfter=await camera();
 assert(Object.values(skyAfter.focus).every(Number.isFinite));assert(skyAfter.metersPerPixel<skyBefore.metersPerPixel);assert(Math.hypot(skyAfter.focus.x-skyBefore.focus.x,skyAfter.focus.y-skyBefore.focus.y)<1e-5);await record('bounded sky zoom fallback');
 // Camera remains usable while new source replies are deliberately held.
 await native.app.evaluate(({ipcMain})=>{globalThis.twTileOriginal=ipcMain._invokeHandlers.get('atlas:terrain-tile');globalThis.twTileHeld=[];ipcMain.removeHandler('atlas:terrain-tile');ipcMain.handle('atlas:terrain-tile',async(e,...args)=>{await new Promise(r=>globalThis.twTileHeld.push(r));return globalThis.twTileOriginal(e,...args);});});
 const b=await page.locator('#campaign-map').boundingBox();await page.mouse.move(b.x+b.width*.65,b.y+b.height*.7);await page.mouse.wheel(0,-500);await frame();const heldRepliesBefore=await requireHeldTerrainReply(native.app);const loadingView=await view();await drag('middle',25,15);assert.notDeepEqual(await view(),loadingView);await record('navigation while source loading',{heldRepliesBefore,heldReplies:await native.app.evaluate(()=>globalThis.twTileHeld.length)});
 await native.app.evaluate(({ipcMain})=>{ipcMain.removeHandler('atlas:terrain-tile');ipcMain.handle('atlas:terrain-tile',globalThis.twTileOriginal);globalThis.twTileHeld.splice(0).forEach(r=>r());});
 await ready();await top();pose=await camera();assert.equal(pose.tilt,0);assert.equal(pose.rotation,0);await record('mouse top-view control');
 await page.locator('#atlas-pan').click();const hand=await view();await drag('left',55,20);assert.notDeepEqual(await view(),hand);assert.equal(state().revision,initial.revision);await record('hand LMB pan');
 await page.locator('[data-tool-group="land"]').click();await page.locator('[data-tool-select="land-tool"][data-tool-value="height"]').first().click();await setBrushWorldRadius(page,'land-radius',100);
 // A pressed brush owns input. Releasing an extra mouse button must not finish it.
 const brushBox=await page.locator('#campaign-map').boundingBox(),x=brushBox.x+brushBox.width*.5,y=brushBox.y+brushBox.height*.6;
 await ready();const brushView=await view(),brushPose=await camera();await page.mouse.move(x,y);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='height');await page.mouse.wheel(0,-400);await page.mouse.down({button:'right'});await page.mouse.move(x+25,y+15);await page.mouse.up({button:'right'});await page.keyboard.press('w');await frame();assert.deepEqual(await view(),brushView);assert.equal((await camera()).tilt,brushPose.tilt);assert.equal(state().revision,initial.revision,'RMB release must not end the held LMB stroke');await page.keyboard.press('Escape');await page.mouse.up();await ready();assert.equal(state().revision,initial.revision);await record('brush owns wheel, RMB and WASD');
 // One fresh released stroke after camera navigation; the TW01 thirty-sample series is not repeated.
 const paintBefore=state();await page.mouse.move(x,y);await page.mouse.down();await page.waitForFunction(()=>document.querySelector('#campaign-map').dataset.terrainDraft==='height');await page.waitForTimeout(180);await page.mouse.down({button:'right'});await page.mouse.up();await ready(paintBefore.revision+1);await page.mouse.up({button:'right'});await frame();assert.equal(state().revision,paintBefore.revision+1);assert.notEqual(state().heights,paintBefore.heights);await record('LMB release commits one stroke while RMB remains held');await page.locator('#atlas-undo').click();await ready(paintBefore.revision+2);assert.equal(state().heights,paintBefore.heights);await record('Undo restores the pre-camera-task terrain');
 }
 // Verify actual native focus transitions, then focus-bound keyboard navigation.
 if(!skipFocus){
 assert.equal(process.env.TW_VIRTUAL_SESSION,'1','Run focus qualification through terrain-water-virtual-session.mjs');nativeKeyboard=await createTerrainWaterKeyboard();result.nativeKeyboard=nativeKeyboard.evidence;
 await lockCheck();focusSession=await page.context().newCDPSession(page);await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 const title='TW02 Kamera '+native.app.process().pid;await native.app.evaluate(async({BrowserWindow},title)=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));w.setTitle(title);const away=new BrowserWindow({parent:w,width:240,height:120,title:'TW02 Fokusprüfung',show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});globalThis.twFocusWindow=away;await away.loadURL('about:blank');away.setTitle('TW02 Fokusprüfung');},title);
 result.focusAway=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:'TW02 Fokusprüfung'});result.focusBack=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:title});await page.waitForFunction(()=>document.hasFocus());
 assert(/KWin::XdgToplevelWindow/.test(result.focusBack.report.after.className),'Compositor must prove native Wayland');
 await drag('right',170,0);const keyBearing=(await camera()).rotation;assert(keyBearing>40);
 await page.locator('#campaign-map').focus();const keyBefore=await view();await nativeKeyboard.down('w');await page.waitForTimeout(220);await nativeKeyboard.up('w');await frame();const keyAfter=await view();assert(keyAfter.y<keyBefore.y&&keyAfter.x<keyBefore.x);assert(Math.abs((keyAfter.x-keyBefore.x)/(keyAfter.y-keyBefore.y)-Math.tan(keyBearing*Math.PI/180))<1e-6,'W follows the rotated view bearing');await page.waitForTimeout(180);assert.deepEqual(await view(),keyAfter);await record('focused W navigation and release');
 await page.locator('#atlas-search').fill('');await page.locator('#atlas-search').focus();const textBefore=await view();for(const name of 'wasd')await nativeKeyboard.press(name);await page.waitForFunction(()=>document.querySelector('#atlas-search').value==='wasd');await frame();assert.deepEqual(await view(),textBefore);await record('WASD leaves text focus unchanged');
 await page.locator('#campaign-map').focus();await nativeKeyboard.down('d');await page.waitForTimeout(100);result.heldKeyBlur=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:'TW02 Fokusprüfung'});await page.waitForFunction(()=>!document.hasFocus());const blurred=await view();await page.waitForTimeout(250);assert.deepEqual(await view(),blurred);await nativeKeyboard.up('d');result.focusReturn=await focusTerrainWindow(native.app,{output,profile:native.profile,titleIncludes:title});await page.waitForFunction(()=>document.hasFocus());await page.waitForTimeout(150);assert.deepEqual(await view(),blurred);await record('trusted blur clears held keyboard input');
 await native.app.evaluate(()=>globalThis.twFocusWindow.destroy());await focusSession.detach();focusSession=null;await nativeKeyboard.close();nativeKeyboard=null;
 }
 if(!focusOnly){
 await ready();await page.locator('#atlas-view').click();await poseControl('tilt',45);await poseControl('rotation',37);await page.locator('#atlas-view').click();await drag('middle',35,-20);await ready();await record('restart setup has nonzero tilt, bearing and shifted viewport');
 const beforeSeaState=state(),beforeSea=await pixels();await page.locator('#land-sea-level').fill('1000');await page.locator('#land-sea-level').press('Tab');await page.waitForFunction(()=>document.querySelector('#atlas-save-status').textContent==='Gespeichert',null,{timeout:30000});await ready();assert.equal(state().sea,1000);assert.equal(state().revision,beforeSeaState.revision+1);assert.notEqual((await pixels()).hash,beforeSea.hash,'Sea level changes the actual terrain framebuffer');assert(await page.locator('#land-finish').isHidden());await record('direct sea-level change persists and visibly floods terrain');await native.capture(page,'02-sea');
 const saved=state(),savedView=await view(),savedCamera=await camera();assert.equal(savedCamera.tilt,45);assert.equal(savedCamera.rotation,37);const savedPreference=await page.evaluate(id=>JSON.parse(localStorage.getItem('atlas-camera:'+id)),fixture.campaignId);for(const key of ['tilt','rotation','exaggeration','focusHeightM'])assert.equal(savedPreference.pose[key],savedCamera[key],'Preference matches visible pose before close: '+key);result.restart={saved:{state:saved,view:savedView,camera:savedCamera,preference:savedPreference}};result.events=await page.evaluate(()=>window.__twCameraEvents);if(!skipFocus)assert(result.events.some(e=>e.kind==='blur'&&e.target==='window'&&e.trusted));assert(result.events.filter(e=>['pointerdown','wheel','keydown'].includes(e.kind)).every(e=>e.trusted));await native.close();await open();assert.deepEqual(state(),saved);assert.equal(await page.locator('#land-sea-level').inputValue(),'1000');assert(await page.locator('#land-finish').isHidden());assert(await page.locator('#land-cancel').isHidden());const reopened=await view();for(const key of ['x','y','width','height'])assert(Math.abs(reopened[key]-savedView[key])<1e-8,'Restart viewport agrees within 10 nanometres: '+key);const reopenedCamera=await camera();for(const key of ['tilt','rotation','exaggeration','focusHeightM'])assert(Math.abs(reopenedCamera[key]-savedCamera[key])<1e-8,'Restart camera pose agrees: '+key);result.restart.reopened={state:state(),view:reopened,camera:reopenedCamera};await record('normal native restart retains tilt, bearing, exaggeration, focus height, sea and viewport; empty draft stays hidden');await native.capture(page,'03-reopened');await native.close();
 }else{result.events=await page.evaluate(()=>window.__twCameraEvents);assert(result.events.some(e=>e.kind==='blur'&&e.target==='window'&&e.trusted));await native.capture(page,'02-keyboard');await native.close();}
 result.host.loadAtEnd=os.loadavg();await native.finish(result);console.log(output);
}catch(error){result.error=error.stack;if(page)result.last=await page.evaluate(()=>({map:document.querySelector('#campaign-map')?.dataset,status:document.querySelector('#atlas-save-status')?.textContent,events:window.__twCameraEvents})).catch(()=>null);await writeFile(path.join(output,'progress.json'),JSON.stringify(result,null,2));if(native.app)await native.app.evaluate(()=>globalThis.twFocusWindow?.destroy()).catch(()=>{});if(focusSession)await focusSession.detach().catch(()=>{});if(nativeKeyboard)await nativeKeyboard.close().catch(()=>{});await native.fail(error);console.log(output);throw error;}finally{await native.dispose();}

}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
