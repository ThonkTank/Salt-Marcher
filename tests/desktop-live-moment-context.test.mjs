import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const base='.build/planner-live-moment',require=createRequire(import.meta.url);
mkdirSync(base,{recursive:true});buildSync({entryPoints:['src/app/storage/store.ts'],outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});buildSync({entryPoints:['src/app/live.ts'],outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
async function setup(t){
 const root=mkdtempSync(path.join(tmpdir(),'moment-context-')),{CampaignStore}=require('../'+base+'/store.cjs'),store=new CampaignStore(path.join(root,'store.sqlite')),campaign=store.create('Abend'),w=store.activate(campaign.id);
 const command=action=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action});
 const heroes=['Ada','Borin'].map(name=>store.executeLive(command({kind:'create-character',profile:{name}})).character);
 const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:2})).scene;
 for(const h of heroes){const v=store.live(w.token);store.executeLive(command({kind:'membership',characterId:h.id,expectedRevision:0,expectedRosterRevision:v.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:v.focusRevision}));}
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),saved={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout},storage=new Map();window.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this._value??this.options[0]?.value??'';},set(v){this._value=v;},configurable:true});for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});Object.assign(globalThis,{window,document,Event:window.Event,setTimeout:()=>1,clearTimeout:()=>{}});
 const x={store,w,scene,heroes,root,CampaignStore,command,window,document,commands:[],messages:[],reply:async ack=>ack,releases:[]};
 const wrap=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 window.campaign={chronicle:async(token,category,search)=>wrap(()=>store.chronicle(token,category,search)),narrative:async(token,id)=>wrap(()=>store.narrative(token,id)),live:async token=>wrap(()=>store.live(token)),progress:async token=>wrap(()=>store.progress(token)),ledgerParties:async token=>wrap(()=>store.ledgerParties(token)),preparation:async token=>wrap(()=>store.preparation(token)),sceneWorld:async(token,id)=>wrap(()=>store.sceneWorld(token,id)),executeLive:async cmd=>{x.commands.push(cmd);return x.reply(wrap(()=>store.executeLive(cmd)),cmd);}};
 delete require.cache[require.resolve('../'+base+'/ui.cjs')];x.ui=require('../'+base+'/ui.cjs');x.ui.initLive((text,error)=>x.messages.push({text,error}),async()=>{});for(const dialog of document.querySelectorAll('dialog')){dialog.close=()=>{dialog.open=false;};dialog.showModal=()=>{dialog.open=true;};}x.ui.activateLive(w);await x.ui.openLive();document.getElementById('live-continue').click();await settle();
 for(const method of ['combat','chase','treasures'])window.campaign[method]=async(...args)=>wrap(()=>store[method](...args));x.el=id=>document.getElementById(id);x.fields=(title,summary)=>{x.el('live-moment-title').value=title;x.el('live-moment-summary').value=summary;x.el('live-moment-category').value='narrative';};x.submit=()=>x.el('live-moment-form').onsubmit(new window.Event('submit',{cancelable:true}));x.end=async()=>{x.el('live-session-end').click();await settle();assert.equal(x.el('live-session-close-dialog').open,true);assert.equal(x.el('live-session-close-confirm').disabled,false);x.el('live-session-close-confirm').click();await settle();};
 x.defer=kind=>{let release;const promise=new Promise(r=>release=r);x.releases.push(()=>release());let held=false;x.reply=async(ack,cmd)=>{if(cmd.action.kind===kind&&!held){held=true;await promise;}return ack;};return release;};
 x.focusOther=async()=>{let v=store.live(w.token);const ack=store.executeLive(command({kind:'move',sceneId:v.scene.id,expectedRosterRevision:v.rosterRevision,expectedFocusRevision:v.focusRevision,expectedClockRevision:v.scene.clock.revision,expectedSceneMembershipRevision:v.scene.membershipRevision,memberIds:[heroes[1].id],target:{kind:'new',title:'Andere Gruppe',expectedContentRevision:v.scene.revision}}));const id=ack.session.createdScene.id;v=store.live(w.token);store.executeLive(command({kind:'focus',sceneId:id,expectedRevision:v.focusRevision}));await x.ui.openLive();return id;};
 t.after(async()=>{for(const release of x.releases)release();await settle();x.ui.activateLive(null);Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});});return x;
}
test('a live moment keeps submitted wording through a flush and preserves later input',async t=>{const x=await setup(t),release=x.defer('scene-content');x.el('running-notes').value='Offene Sceneeingabe';x.el('running-notes').oninput();x.fields('Erster Moment','  Erstes Ergebnis\r\n');x.submit();await settle();x.fields('Nächster Moment','  Neue Eingabe  ');release();await settle();const moments=x.commands.filter(c=>c.action.kind==='live-moment');assert.equal(moments.length,1);assert.equal(moments[0].action.title,'Erster Moment');assert.equal(moments[0].action.summary,'  Erstes Ergebnis\r\n');assert.equal(x.el('live-moment-title').value,'Nächster Moment');assert.equal(x.el('live-moment-summary').value,'  Neue Eingabe  ');assert.ok(x.store.chronicle(x.w.token).entries.some(e=>e.title==='Erster Moment'&&e.summary==='  Erstes Ergebnis\r\n'));});
test('a scene focus change during flush prevents the old live moment from publishing',async t=>{const x=await setup(t),release=x.defer('scene-content');x.el('running-notes').value='Noch speichern';x.el('running-notes').oninput();x.fields('Alter Auftrag','Ursprüngliche Gruppe');x.submit();await settle();const other=await x.focusOther();release();await settle();assert.equal(x.commands.filter(c=>c.action.kind==='live-moment').length,0);assert.equal(x.el('live-moment-title').value,'');x.fields('Moment der neuen Gruppe','Neue Gruppe');x.submit();await settle();assert.equal(x.commands.filter(c=>c.action.kind==='live-moment').at(-1).action.sceneId,other);const v=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'focus',sceneId:x.scene.id,expectedRevision:v.focusRevision}));await x.ui.openLive();assert.equal(x.el('live-moment-title').value,'Alter Auftrag');});
test('a delayed live moment acknowledgement cannot restore its scene over the new focus',async t=>{const x=await setup(t),release=x.defer('live-moment');x.fields('Vorheriger Moment','Alte Gruppe');x.submit();await settle();const id=await x.focusOther();x.fields('Neuer Moment','Neue Gruppe');release();await settle();assert.equal(x.el('scene-focus').value,id);assert.equal(x.el('running-title').value,'Andere Gruppe');assert.equal(x.el('live-moment-title').value,'Neuer Moment');assert.equal(x.el('live-moment-summary').value,'Neue Gruppe');assert.ok(x.store.chronicle(x.w.token).entries.some(e=>e.title==='Vorheriger Moment'));x.submit();await settle();assert.equal(x.commands.filter(c=>c.action.kind==='live-moment').at(-1).action.sceneId,id);});

test('a live moment creates one linked quest and preserves a later follow-up choice',async t=>{
 const x=await setup(t),release=x.defer('live-moment');x.fields('  Offene Spur  ','  Rohnotiz\r\n');x.el('live-moment-follow-up').value='quest';x.submit();await settle();x.fields('Nächste Spur','Noch offen');x.el('live-moment-follow-up').value='rumor';release();await settle();
 const cmd=x.commands.find(c=>c.action.kind==='live-moment');assert.equal(cmd.action.followUp.kind,'quest');const id=cmd.action.followUp.id;
 const narrative=x.store.narrative(x.w.token,id);assert.equal(narrative.state.revision,1);assert.deepEqual(narrative.state.contributors,x.heroes.map(h=>h.id));let notes=x.store.preparation(x.w.token).notes.filter(row=>row.note.id===id);assert.equal(notes.length,1);assert.equal(notes[0].note.kind,'quest');assert.equal(notes[0].note.gmNotes,'  Rohnotiz\r\n');assert.equal(notes[0].note.title,'Offene Spur');
 x.store.executeLive(cmd);notes=x.store.preparation(x.w.token).notes.filter(row=>row.note.id===id);assert.equal(notes.length,1);const events=x.store.chronicle(x.w.token).entries.filter(e=>e.followUp?.id===id);assert.equal(events.length,1);assert.deepEqual(events[0].followUp,{id,kind:'quest'});
 assert.equal(x.el('live-moment-title').value,'Nächste Spur');assert.equal(x.el('live-moment-follow-up').value,'rumor');await x.focusOther();assert.equal(x.el('live-moment-follow-up').value,'');const v=x.store.live(x.w.token);x.store.executeLive(x.command({kind:'focus',sceneId:x.scene.id,expectedRevision:v.focusRevision}));await x.ui.openLive();assert.equal(x.el('live-moment-follow-up').value,'rumor');
});
test('a follow-up collision rolls back its moment, revision and receipt',async t=>{
 const x=await setup(t),id=randomUUID();x.store.changePreparation({commandId:randomUUID(),campaignId:x.w.campaignId,token:x.w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'quest',title:'Vorhanden',readAloud:'',gmNotes:'Original',relations:[],creatureId:null,deleted:false}}});
 const before=x.store.chronicle(x.w.token),revision=x.store.live(x.w.token).scene.revision,cmd=x.command({kind:'live-moment',sceneId:x.scene.id,expectedRevision:revision,category:'narrative',title:'Kollision',summary:'Keine Teilwirkung',followUp:{id,kind:'quest'}});
 assert.throws(()=>x.store.executeLive(cmd));assert.deepEqual(x.store.chronicle(x.w.token),before);assert.equal(x.store.live(x.w.token).scene.revision,revision);cmd.action.followUp.id=randomUUID();assert.doesNotThrow(()=>x.store.executeLive(cmd));assert.equal(x.store.chronicle(x.w.token).entries.filter(e=>e.title==='Kollision').length,1);
});

test('an independent campaign copy binds a moment follow-up to its copied world note',async t=>{
 const x=await setup(t);x.fields('Spur kopieren','Rohtext');x.el('live-moment-follow-up').value='quest';x.submit();await settle();const source=x.store.chronicle(x.w.token).entries.find(e=>e.followUp),snapshot=path.join(x.root,'snapshot.sqlite');await x.store.campaignSnapshot(x.w.token,snapshot);const bytes=readFileSync(snapshot),copy=new x.CampaignStore(path.join(x.root,'copy.sqlite'));
 try{const campaign=copy.acceptCampaignSnapshot(snapshot,'Kopie',{}),w=copy.activate(campaign.id),event=copy.chronicle(w.token).entries.find(e=>e.followUp);assert.notEqual(event.followUp.id,source.followUp.id);assert.ok(copy.preparation(w.token).notes.some(row=>row.note.id===event.followUp.id&&row.note.gmNotes==='Rohtext'));assert.deepEqual(x.store.chronicle(x.w.token).entries.find(e=>e.followUp),source);assert.ok(readFileSync(snapshot).equals(bytes));}finally{copy.close();}
});

test('a failed knowledge refresh still confirms and clears the saved moment exactly once',async t=>{const x=await setup(t);x.fields('Bestätigte Spur','Ergebnis');x.el('live-moment-follow-up').value='quest';x.window.campaign.preparation=async()=>{throw new Error('Kontrollierter Readfehler');};x.submit();await settle();assert.equal(x.el('live-moment-title').value,'');assert.equal(x.el('live-moment-follow-up').value,'');assert.match(x.el('live-moment-result').textContent,/gespeichert/);assert.match(x.el('live-moment-result').textContent,/Wissensbinder/);assert.equal(x.commands.filter(c=>c.action.kind==='live-moment').length,1);assert.equal(x.store.chronicle(x.w.token).entries.filter(e=>e.title==='Bestätigte Spur').length,1);});

test('a newer recap summary survives the acknowledgement of its previous submitted ending',async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();assert.equal(x.store.chronicle(x.w.token).entries[0].sessionMarker,'start');
 const release=x.defer('session-marker');x.el('live-session-summary').value='  Alter Rückblick\r\n';await x.end();x.el('live-session-summary').value='Neuere Notiz';release();await settle();
 assert.equal(x.el('live-session-summary').value,'Neuere Notiz');assert.equal(x.store.chronicle(x.w.token).entries.find(e=>e.sessionMarker==='end').summary,'  Alter Rückblick\r\n');
});
test('a focus change during recap flush cannot publish the former groups session boundary',async t=>{
 const x=await setup(t),release=x.defer('scene-content');x.el('running-notes').value='Offene Scene';x.el('running-notes').oninput();x.el('live-session-start').click();await settle();await x.focusOther();release();await settle();assert.equal(x.commands.filter(c=>c.action.kind==='session-marker').length,0);
});

test('a rejected recap read does not prevent the live group from opening or notes from saving',async t=>{
 const x=await setup(t);x.window.campaign.chronicle=async()=>{throw Error('Chronik nicht erreichbar');};await x.ui.openLive();assert.equal(x.el('live-workspace').hidden,false);assert.equal(x.el('live-session-start').disabled,true);assert.match(x.el('live-session-status').textContent,/Chronik nicht erreichbar/);x.el('running-notes').value='Trotzdem spielbereit';x.el('running-notes').oninput();assert.equal(await x.ui.flushLive(),true);assert.equal(x.store.live(x.w.token).scene.notes,'Trotzdem spielbereit');
});

test('a delayed session ending cannot restore its scene over the newer focused group',async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();const release=x.defer('session-marker');x.el('live-session-summary').value='Alte Gruppe';await x.end();const id=await x.focusOther();x.el('live-session-summary').value='Neue Gruppe';release();await settle();assert.equal(x.el('scene-focus').value,id);assert.equal(x.el('running-title').value,'Andere Gruppe');assert.equal(x.el('live-session-summary').value,'Neue Gruppe');
});
test('recap drafts stay with their campaign when switching away and back',async t=>{
 const x=await setup(t);x.el('live-session-summary').value='Notiz für A';const next=x.store.create('B'),b=x.store.activate(next.id);x.ui.activateLive(b);await x.ui.openLive();assert.equal(x.el('live-session-summary').value,'');x.el('live-session-summary').value='Notiz für B';const a=x.store.activate(x.w.campaign.id);x.ui.activateLive(a);await x.ui.openLive();assert.equal(x.el('live-session-summary').value,'Notiz für A');
});

test('a pending recap read does not block the next confirmed moment and older results cannot replace it',async t=>{
 const x=await setup(t),reads=[];x.window.campaign.chronicle=token=>{const value={ok:true,value:x.store.chronicle(token)};return new Promise(resolve=>{reads.push({resolve,value});x.releases.push(()=>resolve(value));});};
 x.el('live-session-start').click();await settle();assert.equal(reads.length,1);x.fields('Während Rückblick lädt','Eigenständige Eingabe');x.submit();await settle();assert.ok(x.commands.some(c=>c.action.kind==='live-moment'));assert.equal(reads.length,2);
 reads[1].resolve(reads[1].value);await settle();assert.match(x.el('live-session-events').textContent,/Während Rückblick lädt/);reads[0].resolve(reads[0].value);await settle();assert.match(x.el('live-session-events').textContent,/Während Rückblick lädt/);
});

for(const exit of ['live-session-close-x','live-session-close-cancel','escape'])test(`closing the recap review via ${exit} retains its edited note without ending the session`,async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();x.el('live-session-summary').value='Alter Entwurf';x.el('live-session-end').click();await settle();assert.equal(x.el('live-session-close-dialog').open,true);const before=x.store.db.serialize();x.el('live-session-close-summary').value='Bearbeiteter Entwurf';x.el('live-session-close-handoff').value='  Nächster Einstieg\r\n';if(exit==='escape')x.el('live-session-close-dialog').dispatchEvent(new x.window.Event('cancel'));else x.el(exit).click();assert.equal(x.el('live-session-summary').value,'Bearbeiteter Entwurf');assert.equal(x.el('live-session-handoff').value,'  Nächster Einstieg\r\n');assert.ok(x.store.db.serialize().equals(before));assert.equal(x.commands.filter(c=>c.action.kind==='session-marker'&&c.action.marker==='end').length,0);
});
test('an open recap review keeps its note in the original campaign across activation',async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();x.el('live-session-end').click();await settle();x.el('live-session-close-summary').value='Review für A';x.el('live-session-close-handoff').value='Übergabe für A';const next=x.store.create('B'),b=x.store.activate(next.id);x.ui.activateLive(b);await x.ui.openLive();assert.equal(x.el('live-session-summary').value,'');const a=x.store.activate(x.w.campaign.id);x.ui.activateLive(a);await x.ui.openLive();assert.equal(x.el('live-session-summary').value,'Review für A');assert.equal(x.el('live-session-handoff').value,'Übergabe für A');
});

test('opening a pending combat from the recap review retains its edited note',async t=>{
 const x=await setup(t),scene=x.store.live(x.w.token).scene;
 x.store.executeCombat({...x.command({kind:'create',sceneId:scene.id,title:'Torwache',includeParty:true,expectedMembershipRevision:scene.membershipRevision}),combatId:null,expectedRevision:null});
 x.el('live-session-start').click();await settle();x.el('live-session-end').click();await settle();
 x.el('live-session-close-summary').value='Später die Torwache klären';x.el('combat-panel').scrollIntoView=()=>{};
 const before=x.store.combat(x.w.token,x.scene.id),markers=x.store.chronicle(x.w.token).entries.filter(e=>e.sessionMarker);x.el('live-session-close-masks').querySelector('button').click();await settle();
 assert.equal(x.el('live-session-close-dialog').open,false);assert.equal(x.el('live-session-summary').value,'Später die Torwache klären');
 assert.equal(x.commands.filter(c=>c.action.kind==='session-marker'&&c.action.marker==='end').length,0);assert.deepEqual(x.store.combat(x.w.token,x.scene.id),before);assert.deepEqual(x.store.chronicle(x.w.token).entries.filter(e=>e.sessionMarker),markers);
 x.el('live-session-end').click();await settle();assert.equal(x.el('live-session-close-summary').value,'Später die Torwache klären');
});

test('session handoff retains its submitted text while a newer review edit survives the acknowledgement',async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();const release=x.defer('session-marker');
 x.el('live-session-handoff').value='  Im Keller weiter\r\n';await x.end();x.el('live-session-close-handoff').value='Neuere Vorbereitung';release();await settle();
 const end=x.store.chronicle(x.w.token).entries.find(e=>e.sessionMarker==='end');assert.equal(end.handoff,'  Im Keller weiter\r\n');assert.equal(x.el('live-session-handoff').value,'Neuere Vorbereitung');assert.equal(x.el('live-session-handoff-text').textContent,end.handoff);assert.equal(x.el('live-session-close-dialog').open,false);
 assert.equal(x.el('live-session-start').hidden,true);assert.equal(x.el('live-session-resume').hidden,false);x.el('live-session-resume').click();await settle();x.el('live-session-resume-groups').querySelector('button').click();await settle();assert.equal(x.el('live-session-handoff-text').textContent,end.handoff);assert.equal(x.el('live-session-handoff').value,'Neuere Vorbereitung');
 x.el('live-session-handoff').value='';x.el('live-session-end').click();await settle();x.el('live-session-close-handoff').value='';x.el('live-session-close-confirm').click();await settle();assert.equal(x.el('live-session-handoff-preview').hidden,true);assert.equal(x.el('live-session-handoff-text').textContent,'');
});

test('a detached next-game group action cannot start a session in another campaign',async t=>{
 const x=await setup(t);x.el('live-session-start').click();await settle();await x.end();x.el('live-session-resume').click();await settle();assert.equal(x.el('live-session-resume-dialog').open,true);const old=x.el('live-session-resume-groups').querySelector('button');
 const b=x.store.create('B'),w=x.store.activate(b.id);const scene=x.store.executeLive({commandId:randomUUID(),campaignId:b.id,token:w.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene;for(const marker of ['start','end'])x.store.executeLive({commandId:randomUUID(),campaignId:b.id,token:w.token,action:{kind:'session-marker',sceneId:scene.id,expectedRevision:scene.revision,marker,summary:''}});x.ui.activateLive(w);await x.ui.openLive();x.el('live-continue').click();await settle();x.el('live-session-resume').click();await settle();assert.equal(x.el('live-session-resume-dialog').open,true);
 const before=x.store.db.serialize();old.onclick();await settle();assert.ok(x.store.db.serialize().equals(before));assert.equal(x.el('live-session-resume-dialog').open,true);assert.equal(x.store.chronicle(w.token).entries.filter(e=>e.sessionMarker==='start').length,1);
 x.el('live-session-resume-groups').querySelector('button').click();await settle();assert.equal(x.el('live-session-resume-dialog').open,false);assert.equal(x.store.chronicle(w.token).entries.filter(e=>e.sessionMarker==='start').length,2);
});
