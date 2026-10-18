import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';

const source=process.cwd(),output=path.resolve(process.argv[2]??'.build/day-refresh-evidence');
await mkdir(output,{recursive:true});
const require=createRequire(source+'/package.json'),{_electron}=require('playwright-core');
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/day-refresh-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(source+'/.build/day-refresh-store.cjs');
const profile=await mkdtemp('/tmp/day-refresh-'),file=profile+'/workbench.sqlite',store=new CampaignStore(file),campaign=store.create('Tagesplan und Vergleichsgruppe'),w=store.activate(campaign.id);
const command=action=>({campaignId:campaign.id,token:w.token,commandId:randomUUID(),action});
store.executeLive(command({kind:'initialize',expectedRosterRevision:0}));
for(let i=1;i<=2;i++){
 const c=store.executeLive(command({kind:'create-character',profile:{name:'Figur '+String(i).padStart(2,'0')}})).character,live=store.live(w.token);
 store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:live.scene.id,expectedFocusRevision:live.focusRevision}));
 store.executeProgress(command({kind:'xp',characterId:c.id,expectedRevision:0,mode:'set',amount:300,reason:'Bestätigter Start'}));
}
const facts=()=>['roster_member','character_progress','live_scene'].map(table=>store.db.prepare('SELECT * FROM '+table+' ORDER BY id').all());
const before=facts();store.close();
const busPath=profile+'/bus',proxy=spawn('xdg-dbus-proxy',[process.env.DBUS_SESSION_BUS_ADDRESS,busPath,'--filter','--talk=org.freedesktop.portal.Desktop','--talk=org.freedesktop.Notifications'],{stdio:'ignore'});
for(let i=0;i<100;i++){if(await stat(busPath).then(()=>true).catch(()=>false))break;await new Promise(r=>setTimeout(r,20));}
let app,closed=true;const errors=[],results=[],artifacts={};
for(const p of ['main.cjs','preload.cjs','ui/renderer.js','ui/index.html'])artifacts[p]=createHash('sha256').update(await readFile('.build/desktop/'+p)).digest('hex');
try{
 for(const scale of [1,2]){
  app=await _electron.launch({executablePath:source+'/node_modules/electron/dist/electron',args:[source+'/.build/desktop/main.cjs','--ozone-platform=x11','--force-device-scale-factor='+scale,'--data-dir',profile],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'unix:path='+busPath},timeout:30000});closed=false;
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(15000);
  await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
  if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
  await app.evaluate(({ipcMain})=>{
   globalThis.__dayReads=[];globalThis.__dayFailNext=false;
   const read=ipcMain._invokeHandlers.get('campaign:adventuring-day');
   ipcMain.removeHandler('campaign:adventuring-day');
   ipcMain.handle('campaign:adventuring-day',async(event,token,input)=>{
    globalThis.__dayReads.push(structuredClone(input));
    if(globalThis.__dayFailNext){globalThis.__dayFailNext=false;return{ok:false,error:'Kontrollierter Tagesplan-Lesefehler'};}
    return read(event,token,input);
   });
  });
  await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
  await page.locator('#day-trigger').click();
  const settled=async()=>page.waitForFunction(()=>document.querySelector('#day-popover').getAttribute('aria-busy')==='false');
  await settled();
  if(scale===2){
   assert.equal(await page.locator('#day-custom').getAttribute('aria-pressed'),'true');
   assert.equal(await page.getByRole('spinbutton',{name:'Level Zeile 1',exact:true}).inputValue(),'4');
   assert.equal(await page.locator('#day-total-xp').inputValue(),'600');
  }
  await page.locator('#day-active').click();await settled();
  await page.locator('#day-mode-progress').click();await page.locator('#day-total-xp').fill('600');await settled();
  // Deliver both actions in one renderer task so this race test is independent
  // of automation/host speed. The actual DOM handlers, preload and SQLite read run.
  const before=await app.evaluate(()=>globalThis.__dayReads.length);
  await page.evaluate(()=>{
   const level=document.querySelector('#day-rows input');level.value='4';level.dispatchEvent(new Event('input',{bubbles:true}));
   document.querySelector('#day-active').click();
  });
  await settled();await page.waitForTimeout(200);
  const partyReads=await app.evaluate((_electron,n)=>globalThis.__dayReads.slice(n),before);
  await page.screenshot({path:output+'/party-'+scale+'.png'});
  assert.equal(partyReads.length,1,'choosing the active party consumes the queued edit');assert.equal(partyReads[0].source,'active');
  await page.locator('#day-custom').click();await settled();
  assert.equal(await page.getByRole('spinbutton',{name:'Level Zeile 1',exact:true}).inputValue(),'4');
  assert.match(await page.locator('#day-summary').innerText(),/3.400 XP Tagesbudget/);
  await app.evaluate(()=>{globalThis.__dayFailNext=true;});
  const failuresBefore=await app.evaluate(()=>globalThis.__dayReads.length);
  await page.evaluate(()=>{
   const count=document.querySelectorAll('#day-rows input')[1];count.value='3';count.dispatchEvent(new Event('input',{bubbles:true}));
   document.querySelector('#day-close').click();document.querySelector('#day-trigger').click();
  });
  await settled();await page.waitForTimeout(200);
  const failedReads=await app.evaluate((_electron,n)=>globalThis.__dayReads.slice(n),failuresBefore);
  assert.equal(failedReads.length,1,'a failed reopening must not retry itself');
  assert.match(await page.locator('#day-status').innerText(),/Kontrollierter Tagesplan-Lesefehler/);
  assert.equal(await page.locator('#day-summary').locator('*').count(),0);
  assert.equal(await page.getByRole('spinbutton',{name:'Anzahl Zeile 1',exact:true}).inputValue(),'3');
  await page.screenshot({path:output+'/failure-'+scale+'.png'});
  await page.locator('#day-close').click();await page.locator('#day-trigger').click();await settled();
  assert.match(await page.locator('#day-summary').innerText(),/5.100 XP Tagesbudget/);
  assert.match(await page.locator('#day-summary').innerText(),/200 XP je Figur/);
  assert.equal(await page.locator('#day-total-xp').inputValue(),'600');
  await page.getByRole('spinbutton',{name:'Anzahl Zeile 1',exact:true}).fill('2');await settled();
  // Give the debounced input its own read before restarting.
  await page.waitForFunction(()=>document.querySelector('#day-summary').textContent.includes('3.400 XP Tagesbudget'));
  const devicePixelRatio=await page.evaluate(()=>window.devicePixelRatio);assert.equal(devicePixelRatio,scale);
  await page.locator('#day-summary').scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/recovered-'+scale+'.png'});
  const ended=new Promise(resolve=>app.process().once('exit',(code,signal)=>resolve({code,signal})));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).close());
  const exit=await ended;assert.deepEqual(exit,{code:0,signal:null});closed=true;
  results.push({scale,devicePixelRatio,partyReads:partyReads.length,failedReads:failedReads.length,exit});
 }
 const checked=new CampaignStore(file);try{for(const [i,table]of ['roster_member','character_progress','live_scene'].entries())assert.deepEqual(checked.db.prepare('SELECT * FROM '+table+' ORDER BY id').all(),before[i]);}finally{checked.close();}
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'result.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),profile,results,errors,artifacts,partyFactsUnchanged:true},null,2));
 console.log(JSON.stringify({results,partyFactsUnchanged:true}));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,profile,results,errors},null,2));if(app&&!closed)try{await(await app.firstWindow()).screenshot({path:path.join(output,'failure.png')});}catch{}throw error;}
finally{if(app&&!closed)await app.close();proxy.kill();}
