import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from 'linkedom';

const require = createRequire(import.meta.url);
buildSync({ stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {newLocation} from './src/features/location/location-schema';",resolveDir:process.cwd(),loader:'ts'}, outfile: '.build/planner-player-visual-contract/live-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
buildSync({ stdin: { contents: "export * from './live'; export { initWorld, activateWorld } from './world-ui';export {initPlayerUI,deactivatePlayer} from './player-ui';", resolveDir: path.resolve('src/app'), sourcefile: 'live-world-dom.ts' }, outfile: '.build/planner-player-visual-contract/live-ui.cjs', bundle: true, platform: 'node', format: 'cjs' });
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const field of ['character-name', 'running-notes', 'running-read-aloud']) {
  test(`leaving live view saves ${field} input made during a delayed acknowledgement`, async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'live-dom-'));
    const { CampaignStore } = require('../.build/planner-player-visual-contract/live-store.cjs');
    const store = new CampaignStore(path.join(root, 'store.sqlite'));
    const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
    const persisted=new Map();window.localStorage={getItem:key=>persisted.get(key)??null,setItem:(key,value)=>persisted.set(key,String(value)),removeItem:key=>persisted.delete(key)};
    for (const select of document.querySelectorAll('select')) Object.defineProperty(select, 'value', { value: '', writable: true });
    const saved = { Event:globalThis.Event,window: globalThis.window, document: globalThis.document, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
    Object.assign(globalThis, { window, document, Event:window.Event,setTimeout: () => 1, clearTimeout: () => {} });
    try {
      const campaign = store.create('Abend'), context = store.activate(campaign.id);
      store.executeLive({ commandId: randomUUID(), campaignId: campaign.id, token: context.token, action: { kind: 'create-character', profile: { name: 'Vorher' } } });
      let deferNext = false, release;
      window.campaign = {
        live: async token => ({ ok: true, value: store.live(token) }),progress:async token=>({ok:true,value:store.progress(token)}),ledgerParties:async token=>({ok:true,value:store.ledgerParties(token)}),
        preparation: async token => ({ ok: true, value: store.preparation(token) }),
        sceneWorld: async (token, id) => ({ ok: true, value: store.sceneWorld(token, id) }),
        executeLive: async command => {
          const value = store.executeLive(command);
          if (deferNext) { deferNext = false; return new Promise(resolve => { release = () => resolve({ ok: true, value }); }); }
          return { ok: true, value };
        },
      };
      delete require.cache[require.resolve('../.build/planner-player-visual-contract/live-ui.cjs')];const ui = require('../.build/planner-player-visual-contract/live-ui.cjs');
      ui.initWorld(() => {}, () => ui.flushLive(), async () => {}, async () => {}); ui.activateWorld(context);
      ui.initLive(() => {}, async () => {}); ui.activateLive(context); await ui.openLive();
      document.getElementById('live-continue').click(); await tick(); await tick();
      assert.equal(document.getElementById('running-editor').hidden, false);
      assert.ok(document.getElementById('live-world-summary').textContent);
      assert.ok(!document.getElementById('live-world-summary').textContent.startsWith('Weltanzeige:'));
      const input = document.getElementById(field);
      const enter = text => { input.value = text; input.oninput(); };
      enter('Erste Eingabe'); deferNext = true;
      const leaving = ui.flushLive(); await tick(); assert.equal(typeof release, 'function');
      enter('Weitere Eingabe während Speicherung'); release();
      assert.equal(await leaving, true);
      // Navigation reopens the authoritative view and must not discard the second input.
      await ui.openLive();
      assert.equal(document.getElementById(field).value, 'Weitere Eingabe während Speicherung');
      store.close();
      const fresh = new CampaignStore(path.join(root, 'store.sqlite'));
      try {
        const current = fresh.live(fresh.activate(campaign.id).token);
        assert.equal(field === 'character-name' ? current.roster[0].profile.name : field==='running-read-aloud'?current.scene.readAloud:current.scene.notes, 'Weitere Eingabe während Speicherung');
      } finally { fresh.close(); }
    } finally {
      Object.assign(globalThis, saved);
      if (store) { try { store.close(); } catch {} }
      rmSync(root, { recursive: true, force: true });
    }
  });
}


for(const field of ['character-name','running-notes','running-read-aloud'])test(`text autosaving permits the first create-character intent and serializes its write: ${field}`,async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'live-intent-'));
  const {CampaignStore}=require('../.build/planner-player-visual-contract/live-store.cjs'),store=new CampaignStore(path.join(root,'store.sqlite'));
  const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));
  const persisted=new Map();window.localStorage={getItem:key=>persisted.get(key)??null,setItem:(key,value)=>persisted.set(key,String(value)),removeItem:key=>persisted.delete(key)};
  for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
  const saved=Object.fromEntries(['window','document','Event','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{window,document,Event:window.Event,setTimeout:()=>1,clearTimeout:()=>{}});
  let releaseSave,releaseCreate;
  try {
    const campaign=store.create('Klick während Speicherung'),context=store.activate(campaign.id),calls=[];
    store.executeLive({commandId:randomUUID(),campaignId:campaign.id,token:context.token,action:{kind:'create-character',profile:{name:'Vorher'}}});
    let holding=false;
    window.campaign={
      live:async token=>({ok:true,value:store.live(token)}),preparation:async token=>({ok:true,value:store.preparation(token)}),sceneWorld:async(token,id)=>({ok:true,value:store.sceneWorld(token,id)}),
      progress:async token=>({ok:true,value:store.progress(token)}),ledgerParties:async token=>({ok:true,value:store.ledgerParties(token)}),progressHistory:async(token,id,after)=>({ok:true,value:store.progressHistory(token,id,after)}),treasures:async(token,after)=>({ok:true,value:store.treasures(token,after)}),treasure:async(token,id)=>({ok:true,value:store.treasure(token,id)}),ledger:async(token,query)=>({ok:true,value:store.ledger(token,query)}),ledgerItem:async(token,id)=>({ok:true,value:store.ledgerItem(token,id)}),
      executeLive:async command=>{calls.push(command.action.kind);const value=store.executeLive(command);if(holding&&(command.action.kind==='scene-content'||command.action.kind==='profile'))return new Promise(resolve=>{releaseSave=()=>resolve({ok:true,value});});if(holding&&command.action.kind==='create-character')return new Promise(resolve=>{releaseCreate=()=>resolve({ok:true,value});});return {ok:true,value};},
    };
    delete require.cache[require.resolve('../.build/planner-player-visual-contract/live-ui.cjs')];const ui=require('../.build/planner-player-visual-contract/live-ui.cjs');
    ui.initWorld(()=>{},()=>ui.flushLive(),async()=>{},async()=>{});ui.activateWorld(context);ui.initLive(()=>{},async()=>{});ui.activateLive(context);await ui.openLive();
    const dialog=document.getElementById('character-dialog');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
    document.getElementById('live-continue').click();await tick();await tick();calls.length=0;holding=true;
    const input=document.getElementById(field);input.value='Neue Eingabe';input.oninput();
    const saving=ui.flushLive();await tick();assert.equal(typeof releaseSave,'function');
    assert.equal(document.getElementById('character-new').disabled,false,'The pointer target must remain clickable when blur begins a text save');
    document.getElementById('character-new').click();assert.equal(dialog.open,true);
    const name=document.getElementById('new-character-name');assert.equal(name.disabled,false);name.value='Nera';
    document.getElementById('character-form').onsubmit({preventDefault(){}});
    await tick();assert.equal(store.live(context.token).roster.length,1,'Creation must wait for the pending text save');
    releaseSave();assert.equal(await saving,true);for(let i=0;i<50&&!releaseCreate;i++)await tick();assert.equal(typeof releaseCreate,'function');
    assert.equal(document.getElementById('character-create').disabled,true,'The creation itself still prevents duplicate structural writes');
    assert.equal(name.disabled,true);releaseCreate();for(let i=0;i<50&&dialog.open;i++)await tick();assert.equal(dialog.open,false);
    assert.deepEqual(calls,[field==='character-name'?'profile':'scene-content','create-character']);
    assert.equal(store.live(context.token).roster.filter(c=>c.profile.name==='Nera').length,1);
    assert.equal(field==='character-name'?store.live(context.token).roster[0].profile.name:field==='running-read-aloud'?store.live(context.token).scene.readAloud:store.live(context.token).scene.notes,'Neue Eingabe');
  }finally{if(releaseSave)releaseSave();if(releaseCreate)releaseCreate();await tick();await tick();Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});}
});

for(const {kind,saveFails} of [{kind:'follow'},{kind:'location'},{kind:'location',saveFails:true},{kind:'knowledge'}])test(kind==='knowledge'?'prepared read-aloud text is adopted and saved without publishing player content':saveFails?'failed location save cannot grant publication authority':`immediate ${kind} publication uses the visible location draft after saving it`,async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'live-player-location-')),{CampaignStore,newLocation}=require('../.build/planner-player-visual-contract/live-store.cjs'),store=new CampaignStore(path.join(root,'store.sqlite'));
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),saved=Object.fromEntries(['window','document','Event','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]]));
 const persisted=new Map();window.localStorage={getItem:key=>persisted.get(key)??null,setItem:(key,value)=>persisted.set(key,String(value)),removeItem:key=>persisted.delete(key)};
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
 Object.assign(globalThis,{window,document,Event:window.Event,setTimeout:()=>1,clearTimeout:()=>{}});
 for(const dialog of document.querySelectorAll('dialog')){dialog.close=function(){this.open=false;};dialog.showModal=function(){this.open=true;};}
 let ui;t.after(()=>{ui?.deactivatePlayer();Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});});
 const campaign=store.create('Neue sichtbare Ortsauswahl'),context=store.activate(campaign.id),command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:context.token,action});
 const hero=store.executeLive(command({kind:'create-character',profile:{name:'Ada'}})).character,scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:1})).scene;
 store.executeLive(command({kind:'membership',characterId:hero.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}));
 const locationId=randomUUID(),artId=randomUUID();store.changePreparation({...command(null),change:{kind:'location',expectedRevision:null,document:newLocation(locationId,'Der gewählte Ort','poi',[randomUUID(),randomUUID()])}});
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTfcAAAAASUVORK5CYII=','base64'),sha256=createHash('sha256').update(image).digest('hex');mkdirSync(root+'/player-images');writeFileSync(root+'/player-images/'+sha256+'.png',image);store.registerPlayerAsset(context.token,{id:artId,kind:'location',subjectId:locationId,title:'Ortsbild',sha256,extension:'.png',bytes:image.length});
 const readAloud='  Öffentlich vorlesen.\r\n';if(kind==='knowledge')store.changePreparation({...command(null),change:{kind:'note',expectedRevision:null,note:{version:1,id:randomUUID(),revision:1,kind:'rumor',title:'Gerücht',readAloud,gmNotes:'Nur für den GM',relations:[],creatureId:null,deleted:false}}});
 const writes=[],messages=[],ok=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={live:async token=>ok(()=>store.live(token)),preparation:async token=>ok(()=>store.preparation(token)),progress:async token=>ok(()=>store.progress(token)),ledgerParties:async token=>ok(()=>store.ledgerParties(token)),sceneWorld:async(token,id)=>ok(()=>store.sceneWorld(token,id)),executeLive:async c=>saveFails&&c.action.kind==='scene-content'?{ok:false,error:'Ortswechsel nicht gespeichert'}:ok(()=>store.executeLive(c)),playerView:async token=>ok(()=>store.playerView(token)),executePlayer:async c=>{writes.push(c);return ok(()=>store.executePlayer(c));},playerWindow:async(token,open)=>ok(()=>store.playerWindowOpen(token,open))};
 for(const method of ['treasures','treasure','sceneDesk','combat','chase','scenePreparation','sceneRules','progressHistory','ledger','ledgerItem'])window.campaign[method]=async(...args)=>ok(()=>store[method](...args));
 delete require.cache[require.resolve('../.build/planner-player-visual-contract/live-ui.cjs')];ui=require('../.build/planner-player-visual-contract/live-ui.cjs');
 const status=(text,error)=>messages.push({text,error});ui.initWorld(status,()=>ui.flushLive(),async()=>{},async()=>{});ui.activateWorld(context);ui.initLive(status,async()=>{});ui.initPlayerUI(status,()=>context,()=>ui.flushLive());ui.activateLive(context);await ui.openLive();
 document.getElementById('live-continue').click();await tick();await tick();
 if(kind==='knowledge'){const button=[...document.querySelectorAll('#live-knowledge-results button')].find(b=>b.textContent==='Als Vorlesetext einsetzen');assert.ok(button);assert.equal(document.getElementById('running-player-scene'),null);button.click();assert.equal(document.getElementById('running-read-aloud').value,readAloud);assert.equal(await ui.flushLive(),true);assert.equal(store.live(context.token).scene.readAloud,readAloud);assert.equal(writes.length,0);const fresh=new CampaignStore(path.join(root,'store.sqlite'));try{assert.equal(fresh.live(fresh.activate(campaign.id).token).scene.readAloud,readAloud);}finally{fresh.close();}return;}
 const choice=document.getElementById('running-location');choice.value=locationId;choice.onchange();
 assert.equal(store.live(context.token).scene.locationId,null,'Autosave is deliberately pending');assert.equal(document.getElementById('running-player-location').disabled,false);
 document.getElementById(kind==='location'?'running-player-location':'running-player-follow').click();for(let i=0;i<60;i++)await tick();
 if(saveFails){assert.equal(store.live(context.token).scene.locationId,null);assert.equal(writes.length,0);assert.equal(store.playerView(context.token).settings.blank,true);assert.ok(messages.some(m=>m.error&&m.text.includes('Ortswechsel nicht gespeichert')));return;}
 assert.equal(store.live(context.token).scene.locationId,locationId);assert.equal(writes.length,1,JSON.stringify(messages));assert.equal(writes[0].expectedFocusLocationId,locationId);
 assert.equal(store.playerView(context.token).frame.mode,'image');assert.equal(store.playerView(context.token).frame.imageId,artId);
});
