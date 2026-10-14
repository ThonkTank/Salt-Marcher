import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url);
for(const [source,out]of [['src/app/storage/store.ts','player-focus-store'],['src/app/player-ui.ts','player-focus-ui']])buildSync({entryPoints:[source],outfile:'.build/'+out+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(r=>setImmediate(r));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert(check(),'Expected player state');}
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'player-focus-')),{CampaignStore}=require('../.build/player-focus-store.cjs'),store=new CampaignStore(root+'/campaign.sqlite'),campaign=store.create('Zwei Gruppen'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 const a=store.executeLive(command({kind:'create-character',profile:{name:'Ada'}})).character,b=store.executeLive(command({kind:'create-character',profile:{name:'Borin'}})).character;
 const primary=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
 for(const [i,c]of [a,b].entries())store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:0,expectedRosterRevision:2+i,active:true,targetSceneId:primary.id,expectedFocusRevision:0}));
 const split=store.executeLive(command({kind:'move',sceneId:primary.id,expectedRosterRevision:4,expectedFocusRevision:0,expectedClockRevision:0,expectedSceneMembershipRevision:2,memberIds:[b.id],target:{kind:'new',title:'Nachhut',expectedContentRevision:0}})),secondary=split.session.createdScene.id;
 for(const [id,text]of [[primary.id,'Öffentliches Tor'],[secondary,'Geheime Nachhut']])store.executeLive(command({kind:'scene-content',sceneId:id,expectedRevision:0,title:'Interner Titel',readAloud:text,notes:'GM-Privat',locationId:null}));
 const settings={blank:false,mode:'scene',imageId:null,title:'Vorhut',labels:false,light:'daylight',displayId:null,fullscreen:false};
 const basis=()=>{const v=store.playerView(w.token);return{expectedRevision:v.settings.revision,expectedFocusId:v.focusId,expectedFocusRevision:v.focusRevision};};
 const request=action=>({...command(action),...basis()});
 const focus=id=>{const live=store.live(w.token);store.executeLive(command({kind:'focus',sceneId:id,expectedRevision:live.focusRevision}));};
 const rows=()=>store.db.prepare('SELECT * FROM player_record ORDER BY kind,id').all();
 return{root,store,campaign,w,a,b,primary:primary.id,secondary,settings,basis,request,focus,rows,cleanup(){store.close();rmSync(root,{recursive:true,force:true});}};
}
for(const kind of ['scene','follow','image','observer','discover','forget','mask'])test('stale '+kind+' command cannot gain another focused group',()=>{const x=fixture();try{
 const action=['scene','follow','image'].includes(kind)?{kind:'settings',settings:{...x.settings,mode:kind,imageId:kind==='image'?'old-image':null}}:kind==='observer'?{kind,observer:{characterId:x.a.id,enabled:false,rangeMeters:0,darkvisionMeters:0,eyeHeightMeters:1.7}}:kind==='mask'?{kind,mapId:'old-map',q:0,r:0,hidden:true,blocksSight:true,publicLabel:'Geheim'}:{kind,characterIds:[x.a.id],mapId:'old-map',q:0,r:0,locationId:null,publicLabel:'Geheim'};
 const c=x.request(action),old=x.rows(),receipts=x.store.db.prepare('SELECT count(*) n FROM player_receipt').get().n;x.focus(x.secondary);
 assert.throws(()=>x.store.executePlayer(c),/Fokussierte Gruppe geändert/);assert.deepEqual(x.rows(),old);assert.equal(x.store.db.prepare('SELECT count(*) n FROM player_receipt').get().n,receipts);assert.equal(x.store.currentPlayerFrame().mode,'blank');
}finally{x.cleanup();}});
test('focus revision rejects A-B-A even when the visible group identity matches again',()=>{const x=fixture();try{const c=x.request({kind:'settings',settings:x.settings});x.focus(x.secondary);x.focus(x.primary);assert.throws(()=>x.store.executePlayer(c),/Fokussierte Gruppe geändert/);assert.equal(x.store.currentPlayerFrame().mode,'blank');}finally{x.cleanup();}});
test('missing focus authority fails closed rather than publishing for a legacy caller',()=>{const x=fixture();try{const c=x.request({kind:'settings',settings:x.settings});delete c.expectedFocusId;delete c.expectedFocusRevision;assert.throws(()=>x.store.executePlayer(c),/Fokussierte Gruppe geändert/);assert.equal(x.store.currentPlayerFrame().mode,'blank');}finally{x.cleanup();}});
test('receipt replay after a focus change never republishes or rebinds the prior intent',()=>{const x=fixture();try{const c=x.request({kind:'settings',settings:x.settings}),v=x.store.executePlayer(c);assert.equal(v.settings.boundSceneId,x.primary);x.focus(x.secondary);const old=x.rows(),replay=x.store.executePlayer(c);assert.deepEqual(x.rows(),old);assert.equal(replay.frame.mode,'blank');assert.equal(replay.settings.boundSceneId,x.primary);}finally{x.cleanup();}});
test('an emergency blank ignores stale focus and display revisions',()=>{const x=fixture();try{const emergency=x.request({kind:'blank'});x.store.executePlayer(x.request({kind:'settings',settings:x.settings}));x.focus(x.secondary);x.store.executePlayer(x.request({kind:'settings',settings:x.settings}));const v=x.store.executePlayer(emergency);assert.equal(v.settings.blank,true);assert.equal(v.frame.mode,'blank');}finally{x.cleanup();}});
async function uiFixture(){
 const x=fixture(),old={window:globalThis.window,document:globalThis.document,HTMLInputElement:globalThis.HTMLInputElement},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,HTMLInputElement:window.HTMLInputElement});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.__qaValue??this.options[0]?.value??'';},set(v){this.__qaValue=v;}});
 window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};
 const response=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}},waiting=[],writes=[],messages=[];let hold=false;
 window.campaign={playerScreens:async()=>({ok:true,value:[]}),playerView:async()=>response(()=>x.store.playerView(x.w.token)),playerWindow:async()=>({ok:true,value:undefined}),executePlayer:async c=>{writes.push(c);if(hold){hold=false;return new Promise(resolve=>waiting.push(()=>resolve(response(()=>x.store.executePlayer(c)))));}return response(()=>x.store.executePlayer(c));}};
 delete require.cache[require.resolve('../.build/player-focus-ui.cjs')];const ui=require('../.build/player-focus-ui.cjs');ui.initPlayerUI((text,error)=>messages.push({text,error}),()=>x.w,async()=>true);const el=id=>document.getElementById(id);el('player-open-controls').onclick();await until(()=>el('player-dialog').open);
 return{...x,ui,el,writes,messages,waiting,hold:()=>{hold=true;},release:()=>waiting.shift()(),cleanup(){ui.deactivatePlayer();Object.assign(globalThis,old);x.cleanup();}};
}
test('the controller captures the preview focus before an asynchronous publication',async()=>{const x=await uiFixture();try{x.hold();x.el('player-show-scene').onclick();await until(()=>x.waiting.length===1);assert.equal(x.writes[0].expectedFocusId,x.primary);assert.equal(x.writes[0].expectedFocusRevision,0);x.el('player-close-controls').onclick();x.focus(x.secondary);x.release();await tick();assert.equal(x.store.currentPlayerFrame().mode,'blank');assert.equal(x.store.playerView(x.w.token).settings.blank,true);}finally{x.cleanup();}});
test('stale-publication error is local and refresh preserves edits until explicit confirmation',async()=>{const x=await uiFixture();try{
 assert.match(x.el('player-target').textContent,/Ada/);assert.doesNotMatch(x.el('player-target').textContent,/Borin/);x.el('player-title').value='  Titelentwurf  ';x.focus(x.secondary);x.el('player-show-scene').onclick();await until(()=>!x.el('player-feedback').hidden);assert.match(x.el('player-feedback').textContent,/Fokussierte Gruppe geändert/);assert.equal(x.el('player-title').value,'  Titelentwurf  ');assert.equal(x.store.currentPlayerFrame().mode,'blank');
 x.el('player-refresh').onclick();await until(()=>x.el('player-feedback').hidden);assert.equal(x.el('player-title').value,'  Titelentwurf  ');assert.match(x.el('player-target').textContent,/Borin/);assert.doesNotMatch(x.el('player-target').textContent,/Ada/);x.el('player-show-scene').onclick();await until(()=>x.store.currentPlayerFrame().mode==='scene');assert.equal(x.writes.at(-1).expectedFocusId,x.secondary);assert.equal(x.store.currentPlayerFrame().title,'  Titelentwurf  ');assert.equal(x.store.currentPlayerFrame().scene.text,'Geheime Nachhut');
}finally{x.cleanup();}});
