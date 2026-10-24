// Real Live-desk travel on the shared Atlas. Run through tools/ui-session.py after build:desktop.
// GM_QA_ZOOM=2 repeats at actual 200% browser zoom, including Undo/Redo and fresh reopening.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {currentProcessGroup} from './process-group.mjs';
const root=process.cwd(),out=process.env.QA_EVIDENCE_DIR??path.join(root,'.build/travel-checkpoints');
const zoom=Number(process.env.GM_QA_ZOOM??1);assert([1,2].includes(zoom));
await mkdir(out,{recursive:true});await rm(path.join(out,'result.json'),{force:true});
const result={checkout:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),zoom,hashes:{},launches:[],errors:[],maps:[],limitations:['The two-hex native task does not qualify every time consumer or owner acceptance.'],installedPackageAcceptance:false,humanAcceptance:false};
for(const file of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html','ui/app.css'])result.hashes[file]=createHash('sha256').update(await readFile(root+'/.build/desktop/'+file)).digest('hex');
const require=createRequire(root+'/package.json'),{_electron}=require('playwright-core');
const bundle='.build/travel-checkpoint-store-'+process.pid+'.cjs';
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:bundle,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/'+bundle),profile=await mkdtemp('/tmp/gm-travel-checkpoints-'),filename=profile+'/workbench.sqlite';result.profile=profile;
const store=new CampaignStore(filename),campaign=store.create('Reise am Küstenweg'),workspace=store.activate(campaign.id);
const command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,action});
const pc=store.executeLive(command({kind:'create-character',profile:{name:'Iri',speedFeet:30}})).character;
const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:store.live(workspace.token).rosterRevision})).scene;
store.executeLive(command({kind:'membership',characterId:pc.id,expectedRevision:pc.membershipRevision,expectedRosterRevision:store.live(workspace.token).rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:store.live(workspace.token).focusRevision}));
const prose='  Eigene Reiseprosa\r\nbleibt erhalten.  ',current=store.liveScene(workspace.token,scene.id);
store.executeLive(command({kind:'scene-content',sceneId:scene.id,expectedRevision:current.revision,title:'Küstenreise',notes:prose,locationId:null}));
const base=store.world(workspace.token).maps[0],cell={r:0,level:0,terrain:'plains',elevationM:20,climate:null,road:false,river:false,label:'',faction:'',interrupt:''};
store.executeWorld(command({kind:'map',expectedRevision:base.revision,map:{...base,name:'Küstenweg',cells:[0,1,2].map(q=>({...cell,q,interrupt:q===1?'Frische Spuren am Weg':''}))}}));
store.executeWorld(command({kind:'place-scene',sceneId:scene.id,position:{mapId:base.id,q:0,r:0,locationId:null},expectedSceneRevision:store.liveScene(workspace.token,scene.id).revision,expectedPositionRevision:0}));
store.executeWorld(command({kind:'weather-override',sceneId:scene.id,expectedClockRevision:0,expectedOverrideRevision:null,weather:{label:'Klar',kind:'clear',intensity:0,windKmh:0,effects:{visibilityMeters:10000,travelFactor:1,perception:'Normal',temperatureC:15,ambience:[],combatNote:''},source:'GM-Override'}}));
store.tutorial('skipped');store.close();
const group=await currentProcessGroup(),bus=profile+'/bus';
const proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,bus,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
let app,page,closed=true;
async function shot(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await writeFile(path.join(out,name+'.png'),Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.capturePage()).toPNG())));}
async function launch(){
 app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[root+'/.build/desktop/main.cjs','--data-dir',profile,'--ozone-platform=x11'],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+bus},timeout:20000});closed=false;
 const pid=app.process().pid;assert((await readFile('/proc/'+pid+'/cmdline','utf8')).includes(profile));assert.equal((await readFile('/proc/'+pid+'/cgroup','utf8')).trim().split('::')[1],group);result.launches.push({pid,cgroup:group});
 page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>result.errors.push(error.stack));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');await app.evaluate(({BrowserWindow},zoom)=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.setZoomFactor(zoom),zoom);
 await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/Öffnen|Fortsetzen/}).click();
 await page.waitForFunction(()=>!document.querySelector('#workspace-navigation').inert);
 if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();
 if(!await page.locator('#live-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#live-tab').click();
 if(await page.locator('#live-continue').isVisible())await page.locator('#live-continue').click();await page.locator('#running-notes').waitFor({state:'visible'});
 await page.locator('#live-travel-toggle').click();await page.locator('#travel-mode-target').waitFor({state:'visible'});
}
async function close(){
 const process=app.process(),ended=new Promise(resolve=>process.once('exit',(code,signal)=>resolve({code,signal})));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());let timer;
 const exit=await Promise.race([ended,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Normal close timed out')),10000))]).finally(()=>clearTimeout(timer));
 assert.deepEqual(exit,{code:0,signal:null});closed=true;result.launches.at(-1).exit=exit;
 assert.equal(await stat('/proc/'+process.pid).then(()=>true).catch(()=>false),false);result.launches.at(-1).pidAbsent=true;
}
// Sample the composited map: runtime markers are drawn above the Deck surface.
// Reading only the input canvas misses these visible pixels.
async function mapState(q,route,name){
 if(!await page.locator('#campaign-map').isVisible()){assert.equal(await page.locator('#live-center-scene').isVisible(),true);await page.locator('#live-travel-map-open').click();}
 await page.waitForFunction(()=>document.getElementById('campaign-atlas').dataset.regionState==='ready'&&document.getElementById('campaign-map').dataset.canvasState==='loaded');
 const {PNG}=require('pngjs'),deadline=Date.now()+20000;let matched=false;
 while(Date.now()<deadline){
  const box=await page.locator('#campaign-map').evaluate(c=>JSON.parse(c.dataset.atlasView));
  const png=PNG.sync.read(await page.locator('#campaign-map').screenshot()),scale=Math.min(png.width/box.width,png.height/box.height);
  const pixel=q=>{const x=Math.round((png.width-box.width*scale)/2+(q*4828.032-box.x)*scale),y=Math.round((png.height-box.height*scale)/2-box.y*scale);if(x<0||x>=png.width||y<0||y>=png.height)return [];const offset=(y*png.width+x)*4;return [...png.data.subarray(offset,offset+3)];};
  result.lastPixelProbe={box,scale,width:png.width,height:png.height,q,party:pixel(q),route:pixel(1.4)};
  matched=JSON.stringify(pixel(q))==='[36,79,135]'&&(JSON.stringify(pixel(1.4))==='[190,89,57]')===route;
  if(matched)break;await page.waitForTimeout(100);
 }
 assert(matched,JSON.stringify(result.lastPixelProbe));
 result.maps.push({name,q,remainingRoute:route,canvas:await page.locator('#campaign-map').evaluate(c=>({view:JSON.parse(c.dataset.atlasView),version:c.dataset.sceneVersion,width:c.width,height:c.height}))});
 await page.locator('#campaign-map').evaluate(c=>c.scrollIntoView({block:'center'}));
 const visible=await page.locator('#campaign-map').evaluate(c=>{const r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,height:innerHeight,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id};});assert(visible.y>0&&visible.y<visible.height);assert.equal(visible.hit,'campaign-map');
 await shot(name+'-map');await page.locator('#world-journey-status').scrollIntoViewIfNeeded();await shot(name+'-status');
}
function canonical(q,instant,status,timeSteps=q){
 const fresh=new CampaignStore(filename);try{
  const w=fresh.activate(campaign.id),state=fresh.sceneWorld(w.token,scene.id);
  assert.equal(state.position.q,q);assert.equal(state.position.r,0);assert.equal(state.scene.clock.instantMs,instant);assert.equal(state.journey.status,status);assert.equal(state.scene.notes,prose);assert.equal(state.scene.title,'Küstenreise');
  assert.equal(fresh.db.prepare('SELECT count(*) n FROM scene_time_step WHERE campaign_id=? AND scene_id=?').get(campaign.id,scene.id).n,timeSteps);
  return {position:state.position,clock:state.scene.clock,journey:state.journey,knowledge:state.knowledge};
 }finally{fresh.close();}
}
try{
 for(let i=0;i<100&&!await stat(bus).then(()=>true).catch(()=>false);i++)await new Promise(r=>setTimeout(r,20));assert(await stat(bus));
 await launch();await page.locator('#travel-mode-target').click();await page.locator('#travel-advanced > summary').click();await page.locator('#travel-q').fill('2');await page.locator('#travel-r').fill('0');await page.locator('#travel-final-hours').fill('2');await page.locator('#travel-preview-open').click();
 await page.waitForFunction(()=>!document.querySelector('#journey-play').disabled&&document.querySelector('#travel-preview-summary').textContent.includes('2.00 Stunden'));
 result.preview=await page.locator('#travel-evaluation').innerText();assert.match(result.preview,/2.00 h/);await shot('preview');await page.locator('#journey-play').click();
 await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.includes('Zur GM-Entscheidung angehalten'));
 assert.equal(await page.locator('#journey-step').isDisabled(),true);await mapState(1,true,'interrupted');await close();result.interrupted=canonical(1,'3600000','interrupted');
 await launch();await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.includes('Zur GM-Entscheidung angehalten'));await mapState(1,true,'fresh-interrupted');
 assert.equal(await page.locator('#journey-play').isEnabled(),true);await page.locator('#journey-play').click();await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.includes('Angekommen'));await mapState(2,false,'arrived');await close();result.arrived=canonical(2,'7200000','arrived');
 await launch();await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.includes('Angekommen'));await mapState(2,false,'fresh-arrived');assert.equal(await page.locator('#journey-play').isDisabled(),true);await page.locator('#travel-undo').click();
 await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.startsWith('Pausiert'));
 await mapState(1,true,'undone');await close();result.undone=canonical(1,'3600000','paused',3);
 await launch();await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.startsWith('Pausiert'));
 await mapState(1,true,'fresh-undone');assert.equal(await page.locator('#travel-redo').isEnabled(),true);
 await page.locator('#travel-redo').click();await page.waitForFunction(()=>document.querySelector('#world-journey-status').textContent.startsWith('Angekommen'));
 await mapState(2,false,'redone');await close();result.redone=canonical(2,'7200000','arrived',4);
 assert.deepEqual(result.redone.knowledge,result.arrived.knowledge);
 assert.deepEqual(result.errors,[]);result.checkpointWorkflowComplete=true;result.causalUndoRedoComplete=true;await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log('COMPLETE checkpoint interruption, explicit restart resume, Undo/Redo, exact clock and Canvas at '+zoom+' zoom.');
}catch(error){await writeFile(path.join(out,'failure.json'),JSON.stringify({error:error.stack,...result},null,2));if(app&&!closed){await writeFile(path.join(out,'pixels.json'),JSON.stringify(await page.evaluate(()=>window.__travelPixelProbe))).catch(()=>{});await shot('failure').catch(()=>{});}throw error;
}finally{
 if(app&&!closed){const process=app.process(),timer=setTimeout(()=>{if(process.exitCode===null)process.kill('SIGKILL');},5000);try{await app.close().catch(()=>{});}finally{clearTimeout(timer);}}
 proxy.kill();
}
