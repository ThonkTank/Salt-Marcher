import {attachAtlasAuthorRecovery} from './helpers/atlas-author-recovery.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from './helpers/build.mjs';
import {parseHTML} from './helpers/dom.mjs';
const base='.build/marker-selection',require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/world-ui';export {restoreAtlasWrites,pendingAtlasWrite} from './src/app/campaign-atlas-author';",resolveDir:process.cwd()},outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.ok(check(),'Expected marker state did not arrive');}
async function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'marker-selection-')),{CampaignStore}=require('../'+base+'/store.cjs'),store=new CampaignStore(path.join(root,'world.sqlite')),cam=store.create('Zwei Orte'),w=store.activate(cam.id),cmd=action=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});
 const map={...store.world(w.token).maps[0],revision:0,name:'Karte',hexMeters:4828.032,climate:'temperate',seed:'fixed',cells:[]};store.executeWorld(cmd({kind:'map',map,expectedRevision:store.world(w.token).maps[0].revision}));Object.assign(map,store.world(w.token).maps[0]);
 const ids=[randomUUID(),randomUUID()];for(const [i,id]of ids.entries()){store.changePreparation({...cmd(null),change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id,name:i?'Bela':'Ada',type:'poi',sections:[{id:randomUUID(),title:'GM',markdown:'  Originalprosa\r\n'}],detailMaps:[],keyLinks:[]}}});store.executeWorld(cmd({kind:'place',mapId:map.id,locationId:id,expectedRevision:null,hex:{q:i,r:0}}));store.executeWorld(cmd({kind:'place-presentation',locationId:id,expectedRevision:null,presentation:{title:i?'Marker B':'Marker A',symbol:'pin',size:1,labelPosition:'above',curve:0}}));}
 const saved={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,Event:window.Event,CustomEvent:window.CustomEvent});let hold=false,beforeHold=false,lose=false,release,releaseBefore;const sent=[],messages=[];
 const response=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 window.campaign={world:async token=>response(()=>store.world(token)),preparation:async token=>response(()=>store.preparation(token)),live:async token=>response(()=>store.live(token)),sceneWorld:async(token,id)=>response(()=>store.sceneWorld(token,id)),reconcileWorld:async(c,token)=>response(()=>store.reconcileWorld(c,token)),executeWorld:async c=>{sent.push(structuredClone(c));if(lose==='before'){lose=false;throw new Error('IPC-Auftrag nicht angekommen');}const result=response(()=>store.executeAtlas({...c,action:{kind:'world',command:c}}).result);if(lose){lose=false;throw new Error('IPC-Antwort verloren');}if(hold){hold=false;return new Promise(resolve=>release=()=>resolve(result));}return result;}};
 window.campaign.executeAtlas=async envelope=>{const reply=await window.campaign.executeWorld(envelope.action.command);return reply.ok?{ok:true,value:{atlas:store.campaignAtlas(envelope.token),result:reply.value}}:reply;};
 attachAtlasAuthorRecovery(window.campaign,store,root);
 delete require.cache[require.resolve('../'+base+'/ui.cjs')];const ui=require('../'+base+'/ui.cjs');ui.initWorld(text=>messages.push(text),async()=>{if(beforeHold){beforeHold=false;await new Promise(resolve=>releaseBefore=resolve);}return true;},async()=>{},async()=>{});
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});ui.activateWorld(w);await ui.openWorld();const get=id=>document.getElementById('world-'+id),choose=id=>{get('anchor-location').value=id;get('anchor-location').onchange();},input=(key,v)=>{get('marker-'+key).value=v;get('marker-'+key).oninput();},flush=()=>get('marker-size').onpointerup();choose(ids[0]);await until(()=>get('marker-title').value==='Marker A');
 t.after(()=>{Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});});return{store,w,cmd,ids,get,ui,choose,input,flush,sent,messages,hold(){hold=true;},beforeHold(){beforeHold=true;},lose(phase){lose=phase;},hasReply:()=>!!release,hasBefore:()=>!!releaseBefore,release:()=>release(),releaseBefore:()=>releaseBefore(),presentation:id=>store.world(w.token).places.find(p=>p.locationId===id).presentation};
}
test('a pending marker selection cannot edit the previous marker through the new location label',async t=>{
 const x=await fixture(t);x.hold();x.input('size','1.8');x.flush();await until(x.hasReply);x.choose(x.ids[1]);assert.equal(x.get('marker-fields').disabled,true);
 x.input('title','Wrong owner');x.flush();x.release();await until(()=>x.get('marker-title').value==='Marker B');assert.equal(x.get('marker-fields').disabled,false);assert.equal(x.presentation(x.ids[0]).title,'Marker A');assert.equal(x.presentation(x.ids[0]).size,1.8);assert.equal(x.sent.length,1);
 x.input('title','Right owner B');x.get('marker-title').onblur();await until(()=>x.presentation(x.ids[1]).title==='Right owner B');assert.equal(x.sent.length,2);assert.equal(x.sent[1].action.locationId,x.ids[1]);assert.equal(x.presentation(x.ids[0]).title,'Marker A');
});
test('only the newest selection can publish editable fields after a delayed old marker save',async t=>{
 const x=await fixture(t),published=[];let disabled=x.get('marker-fields').disabled;Object.defineProperty(x.get('marker-fields'),'disabled',{get:()=>disabled,set:value=>{disabled=value;if(!value)published.push(x.get('anchor-location').value);},configurable:true});
 x.hold();x.input('size','1.8');x.flush();await until(x.hasReply);x.choose(x.ids[1]);x.choose(x.ids[0]);x.choose(x.ids[1]);x.release();await until(()=>x.get('marker-title').value==='Marker B');assert.deepEqual(published,[x.ids[1]]);assert.equal(x.sent.length,1);
});
test('reactivating the same workspace while preparing a save prevents the old marker IPC command',async t=>{
 const x=await fixture(t);x.beforeHold();x.input('size','1.8');x.flush();await until(x.hasBefore);x.ui.activateWorld(x.w);await x.ui.openWorld();x.choose(x.ids[1]);await until(()=>x.get('marker-title').value==='Marker B');x.releaseBefore();await tick();await tick();assert.equal(x.sent.length,0);assert.equal(x.presentation(x.ids[0]).size,1);assert.equal(x.get('marker-title').value,'Marker B');
});
test('a late old save reply cannot replace a newly read marker snapshot after reactivation',async t=>{
 const x=await fixture(t);x.hold();x.input('size','1.8');x.flush();await until(x.hasReply);
 const newer={...x.presentation(x.ids[1]),title:'New server B'};x.store.executeWorld(x.cmd({kind:'place-presentation',locationId:x.ids[1],expectedRevision:1,presentation:newer}));
 x.ui.activateWorld(x.w);await x.ui.openWorld();x.choose(x.ids[1]);await until(()=>x.get('marker-title').value==='New server B');x.release();await tick();await tick();x.choose(x.ids[0]);await until(()=>x.get('marker-title').value==='Marker A');x.choose(x.ids[1]);await until(()=>x.get('marker-title').value==='New server B');assert.equal(x.sent.length,1);
});
for(const phase of ['before','after'])test(`reply loss ${phase} commit retains marker input until read-only recovery, then permits the next write`,async t=>{
 const x=await fixture(t);x.lose(phase);x.input('size','1.8');x.choose(x.ids[1]);await until(()=>x.messages.some(s=>s.includes('Auftrag prüfen')));assert.equal(x.get('anchor-location').value,x.ids[0]);assert.equal(x.get('marker-size').value,'1.8');assert.equal(x.sent.length,1);
 const notices=[...x.messages];x.get('marker-title').onblur();await tick();await tick();assert.deepEqual(x.messages,notices,'Another blur must keep the recovery feedback stable until its button can receive the click');assert.equal(x.sent.length,1);
 const bytes=x.store.db.serialize();assert.equal(await x.ui.reconcileWorldWrite(),true);assert.equal(x.sent.length,1);assert.ok(x.store.db.serialize().equals(bytes));
 if(phase==='before'){assert.equal(x.presentation(x.ids[0]).size,1);assert.equal(x.get('marker-size').value,'1.8');x.flush();await until(()=>x.presentation(x.ids[0]).size===1.8);}
 const count=x.sent.length;x.choose(x.ids[1]);await until(()=>x.get('marker-title').value==='Marker B');assert.equal(x.get('marker-fields').disabled,false);x.input('title','Neue unabhängige Änderung');x.get('marker-title').onblur();await until(()=>x.presentation(x.ids[1]).title==='Neue unabhängige Änderung');assert.equal(x.sent.length,count+1);assert.equal(x.presentation(x.ids[0]).size,1.8);
});

test('a rejected old marker save restores its confirmed fields before another location is editable',async t=>{
 const x=await fixture(t);x.input('size','4');x.choose(x.ids[1]);await until(()=>x.messages.some(s=>s.includes('wiederhergestellt')));await tick();assert.equal(x.get('anchor-location').value,x.ids[0]);assert.equal(x.get('marker-size').value,'1');assert.equal(x.get('marker-title').value,'Marker A');assert.equal(x.get('marker-fields').disabled,false);assert.equal(x.sent.length,1);assert.equal(x.presentation(x.ids[0]).size,1);x.choose(x.ids[1]);await until(()=>x.get('marker-title').value==='Marker B');assert.equal(x.sent.length,1);
});


test('typed Unknown for a non-Atlas World event retains its command and read-only resolution never clears a foreign Atlas reference',async t=>{
 const x=await fixture(t),api=globalThis.window.campaign,ref={version:1,family:'atlas',campaignId:x.w.campaign.id,commandId:randomUUID(),fingerprint:'0'.repeat(64)};
 assert.equal((await api.keepAtlasWriteReference(ref,x.w.token)).ok,true);assert.equal((await x.ui.restoreAtlasWrites(x.w.campaign.id,x.w.token)).ok,true);
 let dispatches=0;api.executeWorld=async()=>{dispatches++;return{ok:false,error:'World outcome unknown',errorKind:'store-outcome-unknown'};};
 await assert.rejects(()=>x.ui.saveAgendaEvent({id:randomUUID()},null,{},x.w.token),/World outcome unknown/);assert.equal(x.get('write-recovery').hidden,false);assert.equal(dispatches,1);
 assert.equal(await x.ui.reconcileWorldWrite(),true);assert.equal(dispatches,1);assert.equal(x.ui.pendingAtlasWrite(x.w.token).commandId,ref.commandId);assert.deepEqual((await api.atlasWriteReferences(x.w.campaign.id,x.w.token)).value,[ref]);
});
