import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));
for(const [source,name] of [['src/app/storage/store.ts','music-stop-store'],['src/app/music-ui.ts','music-stop-ui']])buildSync({entryPoints:[source],outfile:'.build/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
async function until(check){for(let i=0;i<70;i++){if(check())return;await tick();}assert.ok(check(),'Expected music choice did not arrive');}
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'music-stop-')),{CampaignStore}=require('../.build/music-stop-store.cjs'),store=new CampaignStore(root+'/store.sqlite'),campaign=store.create('Ruhige Szene'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 mkdirSync(root+'/audio');const assets=[];for(const [name,kind] of [['Bühne','song'],['Regen','ambience'],['Wind','ambience']]){const bytes=Buffer.from('Own state fixture '+name),sha256=createHash('sha256').update(bytes).digest('hex');writeFileSync(root+'/audio/'+sha256+'.wav',bytes);let asset=store.ingestAudio(w.token,{sha256,extension:'.wav',bytes:bytes.length,mime:'audio/wav',originalName:name+'.wav'});store.executeMusic(command({kind:'asset',asset:{...asset,kind},expectedRevision:asset.revision}));assets.push(store.audioAsset(asset.id));}
 const execute=action=>store.executeMusic(command({...action,expectedRevision:store.music(w.token).state.revision}));const [song,rain,wind]=assets;const state=store.music(w.token).state;execute({kind:'settings',...state,fadeSeconds:0});execute({kind:'ambience',assetId:wind.id,operation:'add'});
 const saved=Object.fromEntries(['window','document','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});
 const create=document.createElement.bind(document);document.createElement=tag=>{const a=create(tag);if(tag==='audio'){for(const [key,value] of Object.entries({paused:true,ended:false,volume:1,currentTime:0,duration:60,readyState:1}))Object.defineProperty(a,key,{value,writable:true,configurable:true});a.play=async()=>{a.paused=false;};a.pause=()=>{a.paused=true;};a.load=()=>{a.currentTime=0;};}return a;};
 const result=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};let hold=null,reply=null;
 window.campaign={onAudioTransfer:()=>{},music:async token=>result(()=>store.music(token)),musicPosition:async()=>({ok:true}),preparation:async token=>result(()=>store.preparation(token)),audioAssets:async q=>result(()=>store.audioAssets(q)),audioAsset:async id=>result(()=>store.audioAsset(id)),executeMusic:async c=>{const r=result(()=>store.executeMusic(c));if(c.action.kind===hold||c.action.operation===hold){hold=null;return new Promise(resolve=>{reply=()=>{resolve(r);reply=null;};});}return r;}};
 delete require.cache[require.resolve('../.build/music-stop-ui.cjs')];const ui=require('../.build/music-stop-ui.cjs');ui.initMusic(()=>{},async()=>{});for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});ui.activateMusic(w);await ui.openMusic();
 const audible=()=>Array.from(document.querySelectorAll('audio')).filter(a=>!a.paused),click=(name,button)=>Array.from(document.querySelectorAll('#audio-list article')).find(a=>a.querySelector('h4').textContent===name).querySelectorAll('button').forEach(b=>{if(b.textContent===button)b.click();}),transport=operation=>document.querySelector('#music-mini [data-music-transport='+operation+']').click();
 return{root,store,w,ui,song,rain,wind,document,execute,audible,click,transport,hold:op=>{hold=op;},hasReply:()=>!!reply,release:()=>reply(),async cleanup(){if(reply)reply();await tick();ui.deactivateMusic();store.close();Object.assign(globalThis,saved);rmSync(root,{recursive:true,force:true});}};
}
async function startAndStop(x){x.click('Bühne','Abspielen');await until(()=>x.audible().some(a=>a.dataset.musicSlot));x.click('Wind','Sound hinzufügen');await until(()=>x.audible().some(a=>a.dataset.ambienceId===x.wind.id));x.transport('stop');await until(()=>x.store.music(x.w.token).state.manualHold==='stop'&&x.audible().length===0);}
function onlyRain(x){assert.equal(x.audible().length,1);assert.equal(x.audible()[0].dataset.ambienceId,x.rain.id);assert(Math.abs(x.audible()[0].volume-.3)<.00001);assert.equal(x.store.music(x.w.token).state.status,'stopped');assert.match(x.document.getElementById('music-mini-title').textContent,/1 Sound aktiv/);}
test('Stop followed by an explicit sound plays only that layer at the configured ambience gain',async()=>{
 const x=await fixture();try{await startAndStop(x);x.click('Regen','Sound hinzufügen');await until(()=>x.audible().length===1);onlyRain(x);await x.ui.refreshMusic();onlyRain(x);assert.match(x.document.getElementById('music-layers').textContent,/Bereit/);
 }finally{await x.cleanup();}
});
test('a delayed pre-stop Play cannot authorize its old song or stored wind after a new rain choice',async()=>{
 const x=await fixture();try{x.hold('select');x.click('Bühne','Abspielen');await until(x.hasReply);await x.ui.refreshMusic();x.transport('stop');await until(()=>x.store.music(x.w.token).state.manualHold==='stop');x.click('Regen','Sound hinzufügen');await until(()=>x.audible().length===1);x.release();await tick();await tick();onlyRain(x);
 }finally{await x.cleanup();}
});
test('a late Stop reply cannot revoke rain explicitly chosen after that confirmed stop',async()=>{
 const x=await fixture();try{x.click('Bühne','Abspielen');await until(()=>x.audible().length===2);x.hold('stop');x.transport('stop');await until(x.hasReply);await x.ui.refreshMusic();assert.equal(x.audible().length,0);x.click('Regen','Sound hinzufügen');await until(()=>x.audible().length===1);x.release();await tick();await tick();onlyRain(x);
 }finally{await x.cleanup();}
});
test('fresh activation stays silent and a single explicit sound keeps other stored choices dormant',async()=>{
 const x=await fixture();try{await startAndStop(x);x.click('Regen','Sound hinzufügen');await until(()=>x.audible().length===1);x.ui.activateMusic(x.w);await x.ui.openMusic();assert.equal(x.audible().length,0);x.click('Regen','Sound hinzufügen');await until(()=>x.audible().length===1);onlyRain(x);
 }finally{await x.cleanup();}
});
test('adding or unmuting an explicit layer after Stop keeps autoplay music stopped',async()=>{
 const x=await fixture();try{const s=x.store.music(x.w.token).state;x.execute({kind:'settings',...s,autoplay:true,autoAmbience:true,fadeSeconds:0});x.execute({kind:'select',assetId:x.song.id});x.execute({kind:'transport',operation:'stop'});const rain=x.execute({kind:'ambience',operation:'add',assetId:x.rain.id});assert.equal(rain.state.status,'stopped');assert.equal(rain.state.manualHold,'track');assert.equal(rain.state.autoplay,true);x.execute({kind:'ambience',operation:'mute',assetId:x.wind.id});x.execute({kind:'transport',operation:'stop'});const wind=x.execute({kind:'ambience',operation:'unmute',assetId:x.wind.id});assert.equal(wind.state.status,'stopped');assert.equal(wind.state.manualHold,'track');
 }finally{await x.cleanup();}
});
