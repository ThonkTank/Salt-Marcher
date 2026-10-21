import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build,buildSync} from 'esbuild';
import {parseHTML} from './helpers/dom.mjs';

const base='.build/party-rest-confirmation';
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';",resolveDir:process.cwd(),loader:'ts'},outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
// Exercise the real UI and store. Only the Live screen bridge is replaced;
// its unrelated editor/flushing lifecycle is outside these controlled cases.
await build({entryPoints:['src/app/party-topbar-ui.ts'],outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'party-live-boundary',setup(b){
  b.onResolve({filter:/^\.\/live$/},args=>args.importer.endsWith('/party-topbar-ui.ts')?{path:'live',namespace:'party-test'}:undefined);
  b.onLoad({filter:/.*/,namespace:'party-test'},()=>({contents:'export const runPartyProgress=(token,action)=>window.commitPartyProgress(token,action);export const runPartyLive=()=>{throw Error("Unexpected live write")};export const openPartyMove=()=>{throw Error("Unexpected move dialog")};',loader:'js'}));
}}]});
const require=createRequire(import.meta.url),{CampaignStore}=require('../'+base+'/store.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(t){
  const root=mkdtempSync(path.join(tmpdir(),'party-confirm-')),store=new CampaignStore(path.join(root,'store.sqlite'));
  const campaign=store.create('Rastentscheidung'),workspace=store.activate(campaign.id);
  const command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,action});
  const hero=store.executeLive(command({kind:'create-character',profile:{name:'Ada'}})).character;
  let live=store.live(workspace.token);
  const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:live.rosterRevision})).scene;
  live=store.live(workspace.token);
  store.executeLive(command({kind:'membership',characterId:hero.id,expectedRevision:hero.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision}));
  const p=()=>store.progress(workspace.token).characters.find(c=>c.characterId===hero.id);
  store.executeProgress(command({kind:'xp',characterId:hero.id,expectedRevision:p().revision,mode:'set',amount:1000,reason:'Start'}));
  const member=store.live(workspace.token).roster.find(c=>c.id===hero.id);
  store.executeProgress(command({kind:'party-award',expectedRosterRevision:store.live(workspace.token).rosterRevision,poolXp:0,loadXp:240,reason:'Belastung',participants:[{characterId:hero.id,revision:p().revision,membershipRevision:member.membershipRevision,receiveXp:false,receiveLoad:true}]}));
  const prior={window:globalThis.window,document:globalThis.document},dom=parseHTML(readFileSync('src/app/index.html','utf8'));
  Object.assign(globalThis,{window:dom.window,document:dom.document});
  for(const input of dom.document.querySelectorAll('input[type=checkbox]'))Object.defineProperty(input,'checked',{get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',v);},configurable:true});
  // Dynamically rendered member checkboxes use the same native checked semantics.
  const create=dom.document.createElement.bind(dom.document);
  dom.document.createElement=(tag,...args)=>{const node=create(tag,...args);if(tag==='input')Object.defineProperty(node,'checked',{get(){return this.hasAttribute('checked');},set(v){this.toggleAttribute('checked',v);}});return node;};
  const get=id=>dom.document.getElementById('party-'+id),commits=[];
  const preferences=new Map();dom.window.localStorage={getItem:key=>preferences.get(key)??null,setItem:(key,value)=>preferences.set(key,value)};
  dom.window.innerWidth=1000;dom.window.innerHeight=800;
  get('shortcut').getBoundingClientRect=()=>({left:700,right:800,top:20,bottom:60,width:100,height:40});
  let open=false;
  const toggle=state=>{const event=new dom.window.Event('beforetoggle');event.newState=state;get('popover').dispatchEvent(event);open=state==='open';};
  get('popover').matches=()=>open;get('popover').showPopover=()=>toggle('open');get('popover').hidePopover=()=>toggle('closed');
  Object.defineProperty(get('level'),'value',{value:'',writable:true});
  dom.window.campaign={live:async token=>({ok:true,value:store.live(token)}),progress:async token=>({ok:true,value:store.progress(token)})};
  dom.window.commitPartyProgress=async(token,action)=>{commits.push(structuredClone(action));return store.executeProgress(command(action));};
  delete require.cache[require.resolve('../'+base+'/ui.cjs')];
  const ui=require('../'+base+'/ui.cjs');ui.initPartyTopbar(()=>{});ui.activatePartyTopbar(workspace);
  t.after(()=>{ui.activatePartyTopbar(null);Object.assign(globalThis,prior);store.close();rmSync(root,{recursive:true,force:true});});
  const openParty=async()=>{get('shortcut').onclick();await tick();get('rest').open=true;};
  const click=kind=>get(kind+'-rest').onclick();
  const digest=()=>createHash('sha256').update(store.db.serialize()).digest('hex');
  return{store,workspace,command,hero,scene,get,commits,ui,p,dom,openParty,click,digest};
}
test('first rest click is read-only; second identical click commits the displayed group and time exactly once',async t=>{
  const x=fixture(t);await x.openParty();const before=x.digest(),clock=x.store.live(x.workspace.token).scene.clock.instantMs;
  x.click('short');await tick();assert.equal(x.commits.length,0);assert.equal(x.digest(),before);
  assert.match(x.get('rest-status').textContent,/Ada/);assert.match(x.get('rest-status').textContent,/60 Minuten/);
  assert.match(x.get('short-rest').textContent,/bestätigen/);
  x.click('short');x.click('short');await tick();assert.equal(x.commits.length,1);
  assert.equal(x.p().rest.baseline,240);assert.equal(x.p().rest.sections,1);
  assert.equal(x.store.live(x.workspace.token).scene.clock.instantMs-clock,3600000);
  assert.equal(x.get('rest-cancel').hidden,true);
  assert.match(x.get('rest-status').textContent,/^Gebucht: Kurze Rast für Ada · 60 Minuten Szenenzeit · HP unverändert\.$/);
});
test('a rest receipt clears on a new selection and is never shown for an unconfirmed write',async t=>{
  const x=fixture(t);await x.openParty();x.click('short');x.click('short');await tick();
  assert.match(x.get('rest-status').textContent,/^Gebucht:/);
  const pick=x.get('rest-members').querySelector('input');pick.checked=false;pick.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));
  assert.equal(x.get('rest-status').textContent,'');
  pick.checked=true;pick.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));
  x.dom.window.commitPartyProgress=async()=>{throw Error('Buchung nicht bestätigt. Originalbeleg prüfen.');};
  const before=x.digest();x.click('short');x.click('short');await tick();
  assert.equal(x.digest(),before);assert.match(x.get('rest-status').textContent,/^Buchung nicht bestätigt/);assert(!x.get('rest-status').textContent.includes('Gebucht:'));
});
test('a confirmed long rest shows actual HP for namesakes, zero HP and unknown HP in the rest panel',async t=>{
  const x=fixture(t);let live=x.store.live(x.workspace.token),first=live.roster.find(c=>c.id===x.hero.id);
  x.store.executeLive(x.command({kind:'profile',characterId:first.id,expectedRevision:first.profileRevision,profile:{name:'Ada',playerName:'Nora'}}));
  const second=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Ada',playerName:'Noah'}})).character;
  const unknown=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Bela'}})).character;
  for(const hero of [second,unknown]){live=x.store.live(x.workspace.token);x.store.executeLive(x.command({kind:'membership',characterId:hero.id,expectedRevision:hero.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));}
  for(const [hero,hp] of [[first,5],[second,0]]){const p=x.store.progress(x.workspace.token).characters.find(c=>c.characterId===hero.id);x.store.executeProgress(x.command({kind:'health',characterId:hero.id,expectedRevision:p.revision,operation:'set',reason:'Vor der Rast',health:{hp,maxHp:20,tempHp:0,conditions:'',concentrating:false}}));}
  await x.openParty();const labels=new Map([...x.get('rest-members').querySelectorAll('label')].map(l=>[l.querySelector('input').value,l.textContent]));
  x.get('rest-hp').checked=true;x.click('long');assert(!x.get('rest-status').textContent.includes('HP nach der Rast:'));
  x.click('long');await tick();assert.equal(x.commits.length,1);
  const result=x.get('rest-status').textContent;
  assert(result.includes(labels.get(first.id)+': 20/20 HP'));
  assert(result.includes(labels.get(second.id)+': 0/20 HP'));
  assert(result.includes(labels.get(unknown.id)+': HP offen'));
  x.get('rest-hp').checked=false;x.get('rest-hp').dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));
  assert.equal(x.get('rest-status').textContent,'');
});
test('the rest HP result comes from the receipt even when a later progress read has changed',async t=>{
  const x=fixture(t),health={hp:5,maxHp:20,tempHp:0,conditions:'',concentrating:false};
  x.store.executeProgress(x.command({kind:'health',characterId:x.hero.id,expectedRevision:x.p().revision,operation:'set',reason:'Vor der Rast',health}));
  const write=x.dom.window.commitPartyProgress;
  x.dom.window.commitPartyProgress=async(...args)=>{
    const receipt=await write(...args);
    x.store.executeProgress(x.command({kind:'health',characterId:x.hero.id,expectedRevision:x.p().revision,operation:'damage',amount:3,reason:'Nach der Rast'}));
    return receipt;
  };
  await x.openParty();x.get('rest-hp').checked=true;x.click('long');x.click('long');await tick();
  assert.equal(x.p().health.hp,17);assert.match(x.get('active').textContent,/HP 17 \/ 20/);
  assert.match(x.get('rest-status').textContent,/HP nach der Rast: Ada: 20\/20 HP/);
});
for(const change of ['dismiss','reopen','collapse','collapse and reopen','campaign'])test('a late rest confirmation cannot publish a receipt after '+change,async t=>{
  const x=fixture(t);await x.openParty();let release;
  const write=x.dom.window.commitPartyProgress;
  x.dom.window.commitPartyProgress=async(...args)=>{await new Promise(resolve=>release=resolve);await write(...args);};
  x.click('short');x.click('short');
  if(change.startsWith('collapse')){x.get('rest').open=false;x.get('rest').dispatchEvent(new x.dom.window.Event('toggle'));if(change==='collapse and reopen')x.get('rest').open=true;}
  else if(change==='campaign')x.ui.activatePartyTopbar(null);
  else{x.get('popover').hidePopover();if(change==='reopen')await x.openParty();}
  release();await tick();assert.equal(x.commits.length,1);assert(!x.get('rest-status').textContent.includes('Gebucht:'));
});
for(const invalidate of ['selection ABA','duration ABA','time option','HP option','other rest type','cancel','dismiss','refresh','revision','clock revision','reactivate'])test('rest confirmation is invalidated by '+invalidate,async t=>{
  const x=fixture(t);await x.openParty();x.click('short');
  const input=(id,type='input')=>x.get(id).dispatchEvent(new x.dom.window.Event(type,{bubbles:true}));
  if(invalidate==='selection ABA'){const pick=x.get('rest-members').querySelector('input');pick.checked=false;pick.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));pick.checked=true;pick.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));}
  if(invalidate==='duration ABA'){x.get('rest-short').value='30';input('rest-short');x.get('rest-short').value='60';input('rest-short');}
  if(invalidate==='time option'){x.get('rest-time').checked=false;input('rest-time','change');}
  if(invalidate==='HP option'){x.get('rest-hp').checked=true;input('rest-hp','change');}
  if(invalidate==='other rest type')x.click('long');
  if(invalidate==='cancel')x.get('rest-cancel').onclick();
  if(invalidate==='dismiss'){x.get('popover').hidePopover();await x.openParty();}
  if(invalidate==='refresh'){x.get('refresh').onclick();await tick();}
  if(invalidate==='revision'||invalidate==='clock revision'){
    const l=x.store.live(x.workspace.token);
    if(invalidate==='revision')x.store.executeProgress(x.command({kind:'xp',characterId:x.hero.id,expectedRevision:x.p().revision,mode:'add',amount:1,reason:'Andere Korrektur'}));
    else x.store.executeLive(x.command({kind:'advance-clock',sceneId:x.scene.id,expectedRevision:l.scene.clock.revision,amount:1,unit:'minutes',calendarVersion:'relative-v1',reason:'Andere Zeit'}));
    x.dom.document.dispatchEvent(new x.dom.window.Event('campaign-party-changed'));await tick();
  }
  if(invalidate==='reactivate'){x.ui.activatePartyTopbar(x.workspace);await x.openParty();}
  x.click('short');await tick();assert.equal(x.commits.length,0);assert.match(x.get('rest-status').textContent,/Ada/);
  x.click('short');await tick();assert.equal(x.commits.length,1);
});
test('guard-only rest does not advance time or emit a clock receipt; replay remains exact',async t=>{
  const x=fixture(t);await x.openParty();x.get('rest-time').checked=false;
  const before=x.store.live(x.workspace.token).scene.clock;
  x.click('long');await tick();assert.equal(x.commits.length,0);assert.match(x.get('rest-status').textContent,/ohne Zeitfortschreibung/);
  x.click('long');await tick();assert.equal(x.commits.length,1);assert.ok(x.commits[0].scene);
  assert.match(x.get('rest-status').textContent,/^Gebucht: Lange Rast für Ada · ohne Zeitfortschreibung · HP unverändert\.$/);
  assert.deepEqual(x.store.live(x.workspace.token).scene.clock,before);
  assert.deepEqual(x.p().rest,{known:true,longXp:0,shortXp:0,baseline:0,sections:0});
  assert.equal(x.store.db.prepare("SELECT count(*) AS n FROM live_receipt WHERE command_id LIKE '%|rest-clock'").get().n,0);
  const l=x.store.live(x.workspace.token),action={kind:'rest',rest:'short',recipients:[{characterId:x.hero.id,revision:x.p().revision}],scene:{id:l.scene.id,expectedMembershipRevision:l.scene.membershipRevision,expectedClockRevision:l.scene.clock.revision,expectedFocusRevision:l.focusRevision}},command=x.command(action);
  x.store.executeProgress(command);const bytes=x.digest();x.store.executeProgress(command);assert.equal(x.digest(),bytes);
  const event=x.store.progressHistory(x.workspace.token,x.hero.id,null).items[0];assert.equal(event.facts.sceneId,l.scene.id);assert.equal(event.facts.duration,undefined);
});
test('guard-only rest rejects a stale scene membership atomically without consuming the rest',async t=>{
  const x=fixture(t),l=x.store.live(x.workspace.token),action={kind:'rest',rest:'short',recipients:[{characterId:x.hero.id,revision:x.p().revision}],scene:{id:l.scene.id,expectedMembershipRevision:l.scene.membershipRevision,expectedClockRevision:l.scene.clock.revision,expectedFocusRevision:l.focusRevision}};
  x.store.executeLive(x.command({kind:'membership',characterId:x.hero.id,expectedRevision:l.roster[0].membershipRevision,expectedRosterRevision:l.rosterRevision,active:false,targetSceneId:null,expectedFocusRevision:l.focusRevision}));
  const bytes=x.digest();assert.throws(()=>x.store.executeProgress(x.command(action)),/Rastgruppe/);assert.equal(x.digest(),bytes);
});
test('rest in a focused split rejects another scene, foreign members and stale focus or clock without writes',t=>{
  const x=fixture(t),other=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Bela'}})).character;
  let l=x.store.live(x.workspace.token);
  x.store.executeLive(x.command({kind:'membership',characterId:other.id,expectedRevision:other.membershipRevision,expectedRosterRevision:l.rosterRevision,active:true,targetSceneId:l.scene.id,expectedFocusRevision:l.focusRevision}));
  l=x.store.live(x.workspace.token);
  const split=x.store.executeLive(x.command({kind:'move',sceneId:l.scene.id,expectedRosterRevision:l.rosterRevision,expectedFocusRevision:l.focusRevision,expectedClockRevision:l.scene.clock.revision,expectedSceneMembershipRevision:l.scene.membershipRevision,memberIds:[other.id],target:{kind:'new',title:'Bela unterwegs',expectedContentRevision:l.scene.revision}})).session.createdScene;
  l=x.store.live(x.workspace.token);x.store.executeLive(x.command({kind:'focus',sceneId:split.id,expectedRevision:l.focusRevision}));
  l=x.store.live(x.workspace.token);
  assert.notEqual(l.scene.id,l.primaryId);
  const before=x.p(),p=x.store.progress(x.workspace.token).characters.find(c=>c.characterId===other.id),action={kind:'rest',rest:'long',recipients:[{characterId:other.id,revision:p.revision}],scene:{id:l.scene.id,expectedMembershipRevision:l.scene.membershipRevision,expectedClockRevision:l.scene.clock.revision,expectedFocusRevision:l.focusRevision}},bytes=x.digest();
  for(const damage of ['scene','member','focus','clock']){
    const changed=structuredClone(action);
    if(damage==='scene')changed.scene.id=l.primaryId;
    if(damage==='member')changed.recipients=[{characterId:x.hero.id,revision:before.revision}];
    if(damage==='focus')changed.scene.expectedFocusRevision++;
    if(damage==='clock')changed.scene.expectedClockRevision++;
    assert.throws(()=>x.store.executeProgress(x.command(changed)),/Rastgruppe|Figuren dieser Szene/);assert.equal(x.digest(),bytes);
  }
  x.store.executeProgress(x.command(action));
  assert.deepEqual(x.p(),before);
  assert.equal(x.store.progress(x.workspace.token).characters.find(c=>c.characterId===other.id).revision,p.revision+1);
  assert.deepEqual(x.store.live(x.workspace.token).scene.clock,l.scene.clock);
});
test('empty duration or missing selected progress cannot arm a misleading rest preview',async t=>{
  const x=fixture(t);await x.openParty();x.get('rest-short').value='';x.click('short');await tick();assert.equal(x.commits.length,0);assert.match(x.get('rest-status').textContent,/Dauer/);
  x.get('rest-short').value='60';x.dom.window.campaign.progress=async()=>({ok:true,value:{characters:[]}});x.get('refresh').onclick();await tick();x.click('short');await tick();assert.equal(x.commits.length,0);assert.match(x.get('rest-status').textContent,/Fortschritt/);
});
test('guard-only rest rolls back an earlier recipient when a later progress guard fails',t=>{
  const x=fixture(t),other=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Bela'}})).character;
  let l=x.store.live(x.workspace.token);x.store.executeLive(x.command({kind:'membership',characterId:other.id,expectedRevision:other.membershipRevision,expectedRosterRevision:l.rosterRevision,active:true,targetSceneId:l.scene.id,expectedFocusRevision:l.focusRevision}));l=x.store.live(x.workspace.token);
  const second=x.store.progress(x.workspace.token).characters.find(c=>c.characterId===other.id),action={kind:'rest',rest:'long',recipients:[{characterId:x.hero.id,revision:x.p().revision},{characterId:other.id,revision:second.revision+1}],scene:{id:l.scene.id,expectedMembershipRevision:l.scene.membershipRevision,expectedClockRevision:l.scene.clock.revision,expectedFocusRevision:l.focusRevision}};
  const bytes=x.digest();assert.throws(()=>x.store.executeProgress(x.command(action)),/Raststand/);assert.equal(x.digest(),bytes);
  action.recipients[1].revision=second.revision;action.scene.unit='hours';assert.throws(()=>x.store.executeProgress(x.command(action)),/gemeinsam/);assert.equal(x.digest(),bytes);
});
test('a failed refresh discards the confirmation and cannot reuse stale recipients',async t=>{
  const x=fixture(t);await x.openParty();x.click('short');const bytes=x.digest(),live=x.dom.window.campaign.live;
  x.dom.window.campaign.live=async()=>({ok:false,error:'Read nicht verfügbar'});x.get('refresh').onclick();await tick();x.click('short');await tick();
  assert.equal(x.commits.length,0);assert.equal(x.digest(),bytes);assert.equal(x.get('rest-cancel').hidden,true);assert.match(x.get('status').textContent,/Read nicht verfügbar/);
  x.dom.window.campaign.live=live;x.get('refresh').onclick();await tick();x.click('short');await tick();assert.equal(x.commits.length,0);x.click('short');await tick();assert.equal(x.commits.length,1);
});

test('compact Party details and installation quick fields only change presentation, with current rest average',async t=>{
 const x=fixture(t);await x.openParty();const bytes=x.digest(),card=()=>x.get('active').querySelector('.party-card');
 assert.equal(card().querySelector('.party-card-details').hidden,true);
 assert.match(x.get('rest-average').textContent,/Rast Ø/);assert.match(x.get('rest-average').firstChild.title,/1 von 1/);
 card().querySelector('.party-member-toggle').onclick();assert.equal(card().querySelector('.party-card-details').hidden,false);assert.equal(card().querySelector('.party-quick-facts'),null,'collapsed members have only their name and meters');
 const languages=x.get('quick-fields').querySelector('input[value=languages]');languages.checked=true;languages.onchange();
 assert.equal(card().querySelector('.party-card-details').hidden,false);assert.match(x.dom.window.localStorage.getItem('party-quick-fields-v1'),/languages/);
 assert.match(card().querySelector('.party-card-details').textContent,/Sprachenoffen/);card().querySelector('.party-member-toggle').onclick();assert.equal(card().querySelector('.party-card-details').hidden,true);
 assert.equal(x.digest(),bytes);assert.equal(x.commits.length,0);
});

for(const players of [['Nora','Noah'],['Nora','Nora'],[null,null]])test('rest choices and their confirmation distinguish namesakes: '+JSON.stringify(players),async t=>{
 const x=fixture(t);let live=x.store.live(x.workspace.token),first=live.roster.find(c=>c.id===x.hero.id);
 x.store.executeLive(x.command({kind:'profile',characterId:first.id,expectedRevision:first.profileRevision,profile:{...first.profile,...(players[0]?{playerName:players[0]}:{})}}));
 const second=x.store.executeLive(x.command({kind:'create-character',profile:{name:'Ada',...(players[1]?{playerName:players[1]}:{})}})).character;
 live=x.store.live(x.workspace.token);x.store.executeLive(x.command({kind:'membership',characterId:second.id,expectedRevision:second.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));
 const secondBefore=x.store.progress(x.workspace.token).characters.find(c=>c.characterId===second.id);
 await x.openParty();const rows=[...x.get('rest-members').querySelectorAll('label')],label=id=>rows.find(row=>row.querySelector('input').value===id),firstLabel=label(first.id).textContent,secondLabel=label(second.id).textContent;
 assert.notEqual(firstLabel,secondLabel);assert(firstLabel.includes(players[0]??'Spieler offen'));assert(secondLabel.includes(players[1]??'Spieler offen'));
 const other=label(second.id).querySelector('input');other.checked=false;other.dispatchEvent(new x.dom.window.Event('change',{bubbles:true}));
 x.click('short');assert(x.get('rest-status').textContent.includes(firstLabel));assert(!x.get('rest-status').textContent.includes(secondLabel));assert.equal(x.commits.length,0);
 x.click('short');await tick();assert.equal(x.commits.length,1);assert.deepEqual(x.commits[0].recipients.map(p=>p.characterId),[first.id]);assert.equal(x.p().rest.sections,1);
 assert.deepEqual(x.store.progress(x.workspace.token).characters.find(c=>c.characterId===second.id),secondBefore);
 const fresh=new CampaignStore(path.join(x.store.db.name));try{const w=fresh.activate(x.workspace.campaign.id);assert.deepEqual(fresh.progress(w.token).characters.find(c=>c.characterId===second.id),secondBefore);}finally{fresh.close();}
});
