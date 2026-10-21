import {createNativeSession} from './native-session.mjs';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),require=createRequire(root+'/package.json'),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/ambience-mix-native');
await mkdir(output,{recursive:true});await rm(path.join(output,'result.json'),{force:true});
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/ambience-mix-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/ambience-mix-store.cjs'),Database=require('better-sqlite3');
for(const zoom of [1,2]){
 const native=await createNativeSession({root,output:path.join(output,String(zoom)),name:'ambience-mix'});let db;
 try{
  const store=new CampaignStore(native.profile+'/workbench.sqlite',require(root+'/package.json').version),campaign=store.create('Regen, Wind und Lagerfeuer'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action}),ids={};
  try{
   const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:0})).scene;
   store.executeWorld(command({kind:'weather-override',sceneId:scene.id,expectedClockRevision:0,expectedOverrideRevision:null,weather:{label:'Sturmregen',kind:'rain',intensity:.5,windKmh:30,effects:{visibilityMeters:1000,travelFactor:1.1,perception:'Sturmregen',temperatureC:10,ambience:['Regen','Wind'],combatNote:''},source:'GM'}}));
   await mkdir(native.profile+'/audio');
   for(const [name,hz] of [['Regen',220],['Wind',330],['Feuer',440]]){
    const samples=8000*120,bytes=Buffer.alloc(44+samples*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
    for(let i=0;i<samples;i++)bytes.writeInt16LE(Math.round(32*Math.sin(2*Math.PI*hz*i/8000)),44+i*2);
    const sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(native.profile+'/audio/'+sha256+'.wav',bytes);
    const a=store.ingestAudio(w.token,{sha256,extension:'.wav',bytes:bytes.length,mime:'audio/wav',originalName:name+'.wav'});ids[name]=a.id;
    store.executeMusic(command({kind:'asset',expectedRevision:a.revision,asset:{...a,name,kind:'ambience',vibes:[name],notes:'  Original\r\n- '+name}}));
   }
   const state=store.music(w.token).state;store.executeMusic(command({kind:'settings',...state,expectedRevision:state.revision,autoplay:false,autoAmbience:true,ambienceVolume:.3,fadeSeconds:0}));store.tutorial('skipped');
  }finally{store.close();}
  db=new Database(native.profile+'/workbench.sqlite',{readonly:true});
  const state=()=>JSON.parse(db.prepare('SELECT payload FROM music_state WHERE campaign_id=?').get(campaign.id).payload);
  const protectedRows=()=>['audio_asset','world_record','scene_clock'].map(table=>db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),original=protectedRows();
  let page;
  async function open(){
   page=await native.launch(zoom);await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).setSize(1600,1000));
   assert.equal(await native.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')).webContents.getZoomFactor()),zoom);
   await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
   await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
   if(!await page.locator('#music-tab').isVisible()){
    if(await page.locator('#atlas-navigation').isVisible())await page.locator('#atlas-navigation').click();
    if(!await page.locator('#music-tab').isVisible())await page.locator('#workspace-nav-summary').click();
   }
   await page.locator('#music-tab').click();await page.locator('#audio-list article').first().waitFor();
  }
  async function playing(names){
   const expected=names.map(n=>ids[n]).sort(),gain=names.length ? .3/Math.sqrt(names.length) : 0;
   await page.waitForFunction(({expected,gain})=>{
    const sounds=[...document.querySelectorAll('audio')].filter(a=>!a.paused);
    return JSON.stringify(sounds.map(a=>a.dataset.ambienceId).sort())===JSON.stringify(expected)&&sounds.every(a=>a.readyState>=2&&a.currentTime>.05&&Math.abs(a.volume-gain)<.00001);
   },{expected,gain});
   assert.equal(state().current,null);assert.equal(state().status,'stopped');
  }
  const active=name=>page.locator('#music-layers > div').filter({hasText:new RegExp('^'+name+' ·')});
  const release=name=>page.getByRole('button',{name:name+' wieder freigeben',exact:true}).click();
  await open();await playing([]);await page.locator('#music-ambience-release').click();await playing(['Regen','Wind']);
  await page.locator('#audio-list article').filter({has:page.getByRole('heading',{name:'Feuer',exact:true})}).getByRole('button',{name:'Sound hinzufügen',exact:true}).click();await playing(['Regen','Wind','Feuer']);
  for(const name of ['Wind','Regen'])await active(name).getByRole('button',{name:'Unterdrücken',exact:true}).click();
  await playing(['Feuer']);
  assert.match(await page.locator('#music-layers').innerText(),/Wind.*Unterdrückt/s);assert.match(await page.locator('#music-layers').innerText(),/Regen.*Unterdrückt/s);
  assert.deepEqual(new Set(state().mutedAmbience),new Set([ids.Wind,ids.Regen]));
  await native.capture(page,'two-muted','#music-layers');await release('Wind');await playing(['Wind','Feuer']);
  assert.deepEqual(state().mutedAmbience,[ids.Regen]);assert.deepEqual(state().forcedAmbience,[ids.Feuer]);assert.deepEqual(protectedRows(),original);
  await native.capture(page,'selectively-released','#music-layers');await native.close();
  await open();await playing([]);assert.deepEqual(state().mutedAmbience,[ids.Regen]);assert.deepEqual(state().forcedAmbience,[ids.Feuer]);
  await release('Regen');await playing(['Regen']);assert.deepEqual(state().forcedAmbience,[ids.Feuer]);
  await page.locator('#music-ambience-release').click();await playing(['Regen','Wind']);
  assert.deepEqual(state().forcedAmbience,[]);assert.deepEqual(state().mutedAmbience,[]);assert.deepEqual(protectedRows(),original);
  await native.capture(page,'automatic-again','#music-layers');await native.close();
  await native.finish({checks:['Two automatic layers plus a manual addition use equal-power gain','Both suppressed sounds are named and exactly one is released','Fresh stays silent while manual choices remain canonical','Explicit single-layer release and subsequent automatic mix preserve metadata, weather and clocks']});console.log('Ambience mix, named suppression and normal restart verified',zoom);
 }catch(error){await native.fail(error);throw error;}finally{db?.close();await native.dispose();}
}
const runs=await Promise.all([1,2].map(async z=>JSON.parse(await readFile(path.join(output,String(z),'result.json'),'utf8'))));
await writeFile(path.join(output,'result.json'),JSON.stringify({runs},null,2));
