import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const base='.build/realist-preparation',require=createRequire(import.meta.url);
mkdirSync(base+'/catalog',{recursive:true});copyFileSync('src/features/catalog/data/srd-5.1.generated.json',base+'/catalog/srd-5.1.generated.json');
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/preparation';export {initCommitControls,checkPendingCommit} from './src/app/commit-confirmation';export {WorldLinksWorkbench} from './src/app/world-links-ui';",resolveDir:process.cwd(),sourcefile:'preparation-context-fixture.ts'},outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
const until=async check=>{const deadline=Date.now()+5000;while(Date.now()<deadline){if(check())return;await delay(10);}assert.ok(check(),'expected preparation state');};
async function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'preparation-context-')),{CampaignStore}=require('../'+base+'/store.cjs'),store=new CampaignStore(path.join(root,'db.sqlite')),campaign=store.create('Quellen'),workspace=store.activate(campaign.id);
 const command=change=>({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,change}),ids={ada:randomUUID(),borin:randomUUID()};
 for(const [id,title]of [[ids.ada,'Ada'],[ids.borin,'Borin']])store.changePreparation(command({kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'  Original\r\n',gmNotes:'GM privat',relations:[],creatureId:null,deleted:false}}));
 const original=store.preparation(workspace.token).notes.find(row=>row.note.id===ids.borin).note;
 const {document,window}=parseHTML(readFileSync('src/app/index.html','utf8')),prior={};
 for(const key of ['window','document','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','Option','Event','setTimeout','clearTimeout'])prior[key]=globalThis[key];
 const values=new WeakMap();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v){values.set(this,v);}});
 function Option(text='',value=''){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}
 window.HTMLSelectElement.prototype.add=function(o){this.append(o);};window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLElement.prototype.showModal=function(){this.open=true;};window.HTMLElement.prototype.close=function(){this.open=false;};window.HTMLElement.prototype.setSelectionRange=function(start,end){this.selectionStart=start;this.selectionEnd=end;};
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,HTMLTextAreaElement:window.HTMLTextAreaElement,Option,Event:window.Event,setTimeout:()=>1,clearTimeout:()=>{}});
 const messages=[],writes=[],wrap=f=>{try{return{ok:true,value:f()};}catch(e){return{ok:false,error:e.message};}};
 const storage=new Map();window.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 window.campaign={};for(const method of ['narrative','ledgerParties','keepNarrativeDraft','discardNarrativeDraft','executeProgress','commitStatus','preparation','preparationDraft','keepPreparationDrafts','keepDeskDraft','discardPreparationDraft','selectPreparation','reconcilePreparation','reconcilePreparationContent','worldLinks','deskContent','searchDesk','worldRelationPairDraft','keepWorldRelationPairDraft','discardWorldRelationPairDraft','reconcileWorldRelationPair','executeWorldRelationPair','worldRelationPairHistory','executeWorldRelationPairHistory','reconcileWorldRelationPairHistory','live','session','executeSession','encounterPlans','progress','encounterTables','sessionRuns','generationSources','npcs','generatorRegistry'])window.campaign[method]=async(...args)=>wrap(()=>store[method](...args));
 window.campaign.changePreparation=async c=>{writes.push(c);return wrap(()=>store.changePreparation(c));};window.campaign.changePreparationContent=async c=>{writes.push(c);return wrap(()=>store.changePreparationContent(c));};
 const file=require.resolve('../'+base+'/ui.cjs');delete require.cache[file];const ui=require(file);ui.initPreparation((text,error)=>messages.push({text,error}),async()=>{});
 let owner=workspace;ui.initCommitControls(()=>owner,(text,error)=>messages.push({text,error}));const graph=new ui.WorldLinksWorkbench(()=>owner,()=>ui.leavePreparation(),text=>messages.push({text}),async(ref,current)=>ui.openPreparedNote(ref.id,current));
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 const el=id=>document.getElementById(id),draft=(failed=false)=>{const note={...original,readAloud:'  Geretteter Text\r\n**Wortlaut**  ',gmNotes:'  Eigene Planung\r\n',relations:[{targetId:ids.ada,label:'  vertraut  '}]},writeId='world-links-'+randomUUID(),change={kind:'note',expectedRevision:original.revision,note},c={...command(change),draftWriteId:writeId};return{version:1,writeId,change,failedCommand:failed?c:null};};
 t.after(async()=>{graph.reset();await settle();Object.assign(globalThis,prior);store.close();rmSync(root,{recursive:true,force:true});});
 return{store,workspace,campaign,ids,original,command,ui,graph,el,window,messages,writes,draft,setOwner:w=>owner=w,activate:()=>ui.activatePreparation(workspace)};
}
test('a legacy relationship draft resumes in the graph and publishes exactly once',async t=>{
 const x=await fixture(t),draft=x.draft();x.store.keepPreparationDrafts(x.workspace.token,[draft]);await x.activate();
 await x.graph.open({kind:'note',id:x.ids.borin});assert.equal(x.el('world-link-label').value,'  vertraut  ');assert.match(x.el('world-links-inspector').textContent,/Gesicherter Beziehungsentwurf/);assert.equal(x.writes.length,0);
 [...x.el('world-links-inspector').querySelectorAll('button')].find(b=>b.textContent==='Beziehung übernehmen').click();await settle();
 assert.equal(x.writes.length,1);const saved=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note;assert.equal(saved.readAloud,draft.change.note.readAloud);assert.equal(saved.gmNotes,draft.change.note.gmNotes);assert.deepEqual(saved.relations,draft.change.note.relations);assert.equal(x.store.preparationDraft(x.workspace.token,'note',x.ids.borin),null);
});
test('an unapplied legacy relationship command is reconciled before a fresh explicit save',async t=>{
 const x=await fixture(t),draft=x.draft(true);x.store.keepPreparationDrafts(x.workspace.token,[draft]);x.store.selectPreparation(x.workspace.token,{noteId:x.ids.borin,planId:null,sceneId:null});await x.activate();assert.equal(await x.ui.flushPreparation(),false);assert.equal(x.writes.length,0);
 x.el('preparation-reconcile').click();await settle();assert.equal(x.el('preparation-reconcile').hidden,true);assert.equal(x.el('note-read-aloud').value,draft.change.note.readAloud);assert.equal(x.writes.length,0);
 assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.writes.length,1);assert.notEqual(x.writes[0].commandId,draft.failedCommand.commandId);assert.equal(x.writes[0].change.note.gmNotes,draft.change.note.gmNotes);
});
test('a late preparation receipt cannot replace another campaign or report its old result',async t=>{
 const x=await fixture(t),draft=x.draft(true);x.store.keepPreparationDrafts(x.workspace.token,[draft]);x.store.selectPreparation(x.workspace.token,{noteId:x.ids.borin,planId:null,sceneId:null});await x.activate();
 const read=x.window.campaign.reconcilePreparation;let release;x.window.campaign.reconcilePreparation=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};x.el('preparation-reconcile').click();await settle();assert.ok(release);
 const b=x.store.create('B'),w=x.store.activate(b.id),id=randomUUID();x.store.changePreparation({commandId:randomUUID(),campaignId:b.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title:'Neue Kampagne',readAloud:'Neu',gmNotes:'Bleibt',relations:[],creatureId:null,deleted:false}}});x.setOwner(w);await x.ui.activatePreparation(w);const before=x.messages.length;release();await settle();
 assert.equal(x.el('note-title').value,'Neue Kampagne');assert.equal(x.el('note-read-aloud').value,'Neu');assert.equal(x.messages.length,before);assert.equal(x.writes.length,0);x.el('note-gm').value='Nach dem Wechsel';x.el('note-gm').dispatchEvent(new x.window.Event('input'));assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.store.preparation(w.token).notes.find(r=>r.note.id===id).note.gmNotes,'Nach dem Wechsel');
});
test('adding a relationship preserves prose edited while its acknowledgement is pending',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.openPreparedNote(x.ids.borin);
 x.el('relation-target').value=x.ids.ada;x.el('relation-label').value='kennt';x.el('note-gm').value='Vorher';x.el('note-gm').dispatchEvent(new x.window.Event('input'));
 const save=x.window.campaign.changePreparation;let release;x.window.campaign.changePreparation=async c=>{const result=await save(c);if(!release)return new Promise(r=>release=()=>r(result));return result;};
 x.el('relation-add').click();await settle();assert.ok(release);x.el('note-gm').value='  Spätere Eingabe\r\n';x.el('note-gm').dispatchEvent(new x.window.Event('input'));release();await settle();await x.ui.flushPreparation();
 const saved=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note;assert.equal(saved.gmNotes,'  Spätere Eingabe\r\n');assert.deepEqual(saved.relations,[{targetId:x.ids.ada,label:'kennt'}]);
});

test('removing an authored relationship uses the same draft writer and revokes its detached control',async t=>{
 const x=await fixture(t),draft=x.draft();x.store.keepPreparationDrafts(x.workspace.token,[draft]);await x.activate();await x.ui.openPreparedNote(x.ids.borin);
 const old=[...x.el('note-relations').querySelectorAll('button')].find(b=>b.textContent==='Beziehung lösen');assert.ok(old);old.click();await settle();await x.ui.flushPreparation();
 const saved=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note;assert.deepEqual(saved.relations,[]);assert.equal(saved.readAloud,draft.change.note.readAloud);const count=x.writes.length;old.onclick();await settle();assert.equal(x.writes.length,count);
});
test('a repeated relationship click cannot create an invalid duplicate draft',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.openPreparedNote(x.ids.borin);x.el('relation-target').value=x.ids.ada;x.el('relation-label').value='kennt';
 x.el('relation-add').click();x.el('relation-add').click();await settle();assert.equal(await x.ui.flushPreparation(),true);
 const saved=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note;assert.deepEqual(saved.relations,[{targetId:x.ids.ada,label:'kennt'}]);assert.equal(x.writes.length,1);
});

for(const rejected of [false,true])test(`a late save ${rejected?'failure':'acknowledgement'} cannot replace a freshly reactivated preparation`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.openPreparedNote(x.ids.borin);
 x.el('note-gm').value='Gesendet';x.el('note-gm').dispatchEvent(new x.window.Event('input'));
 const save=x.window.campaign.changePreparation;let release;
 x.window.campaign.changePreparation=async c=>{const result=await save(c);if(!release)return new Promise(r=>release=()=>r(rejected?{ok:false,error:'Antwort verloren'}:result));return result;};
 const saving=x.ui.flushPreparation();await settle();assert.ok(release);
 const note=x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note;
 x.store.changePreparation(x.command({kind:'note',expectedRevision:note.revision,note:{...note,gmNotes:'Neu geladen'}}));
 await x.activate();assert.equal(x.el('note-gm').value,'Neu geladen');const count=x.messages.length;
 release();assert.equal(await saving,false);assert.equal(x.messages.length,count);assert.equal(x.el('note-gm').value,'Neu geladen');
 x.window.campaign.changePreparation=save;x.el('note-gm').value='  Nach Neustart\r\n';x.el('note-gm').dispatchEvent(new x.window.Event('input'));
 assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note.gmNotes,'  Nach Neustart\r\n');
});

for(const reason of ['reload','cancel'])test('a source read cannot select its old note after '+reason,async t=>{
 const x=await fixture(t);await x.activate();const read=x.window.campaign.preparation;let release;
 x.window.campaign.preparation=async(...args)=>{const result=await read(...args);if(!release)return new Promise(r=>release=()=>r(result));return result;};
 let current=true;const opening=x.ui.openPreparedNote(x.ids.borin,()=>current);await settle();assert.ok(release);
 if(reason==='reload'){x.store.selectPreparation(x.workspace.token,{noteId:x.ids.ada,planId:null,sceneId:null});await x.activate();}else current=false;assert.equal(x.el('note-title').value,'Ada');
 release();await opening;assert.equal(x.el('note-title').value,'Ada');
});

async function picker(t){const x=await fixture(t);await x.activate();await x.ui.openPreparedNote(x.ids.borin);const area=x.el('note-gm');area.value='  Roh\r\n**Text**  ';area.dispatchEvent(new x.window.Event('input'));area.setSelectionRange(2,2);x.el('note-text-reference').click();await settle();const dialog=x.el('text-reference-picker');assert.ok(dialog?.open);return{...x,area,dialog,select:async id=>{dialog.querySelector(`[data-reference="note:${id}"]`).click();await settle();},cancel:async()=>{[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Abbrechen').click();await settle();}};}
test('text reference insertion preserves raw note bytes and uses the existing single writer',async t=>{
 const x=await picker(t);await x.select(x.ids.ada);x.el('text-reference-alias').value='  Wächter  ';x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));x.el('text-reference-insert').click();await settle();
 const expected='  [  Wächter  ](dungeon-ref:note/'+x.ids.ada+')Roh\r\n**Text**  ';assert.equal(x.area.value,expected);await x.ui.flushPreparation();assert.equal(x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note.gmNotes,expected);
});
for(const change of ['target','alias','search'])test('a pending reference confirmation cannot insert after '+change+' changes',async t=>{
 const x=await picker(t);await x.select(x.ids.ada);const read=x.window.campaign.deskContent;let release;x.window.campaign.deskContent=async(...args)=>{const result=await read(...args);if(!release)return new Promise(r=>release=()=>r(result));return result;};
 x.el('text-reference-insert').click();await settle();assert.ok(release);
 if(change==='target')await x.select(x.ids.borin);else{const el=x.el(change==='alias'?'text-reference-alias':'text-reference-search');el.value='Neue Wahl';el.dispatchEvent(new x.window.Event('input'));}
 release();await settle();assert.equal(x.dialog.open,true);assert.equal(x.area.value,'  Roh\r\n**Text**  ');await x.cancel();
});
test('changing reference search revokes its old result controls immediately',async t=>{
 const x=await picker(t),old=x.dialog.querySelector(`[data-reference="note:${x.ids.ada}"]`),field=x.el('text-reference-search');field.value='niemand';field.dispatchEvent(new x.window.Event('input'));old.onclick();await settle();
 assert.equal(x.el('text-reference-results').textContent,'');assert.equal(x.el('text-reference-detail').textContent,'');assert.equal(x.el('text-reference-insert').disabled,true);await x.cancel();
});
test('a delayed reference selection preserves an alias already typed by the GM',async t=>{
 const x=await picker(t),read=x.window.campaign.deskContent;let release;x.window.campaign.deskContent=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};x.dialog.querySelector(`[data-reference="note:${x.ids.ada}"]`).click();await settle();
 x.el('text-reference-alias').value='Eigener Name';x.el('text-reference-alias').dispatchEvent(new x.window.Event('input'));release();await settle();assert.equal(x.el('text-reference-alias').value,'Eigener Name');await x.cancel();
});

test('a reference selected for an old editor generation cannot change the reloaded note',async t=>{
 const x=await picker(t);await x.select(x.ids.ada);await x.activate();x.el('text-reference-insert').click();await settle();assert.equal(x.area.value,'  Roh\r\n**Text**  ');assert.equal(x.store.preparation(x.workspace.token).notes.find(r=>r.note.id===x.ids.borin).note.gmNotes,'  Roh\r\n**Text**  ');
});

test('next-visit preparation reuses the plan writer with raw notes and cannot fall back from a missing requested plan',async t=>{
 const x=await fixture(t);await x.activate();await settle();await x.ui.prepareNextVisit(null,{title:'Nächster Morgen',notes:'  Roh\r\n- Spuren  ',locationId:null});await settle();
 const plans=x.store.preparation(x.workspace.token).plans;assert.equal(plans.length,1);assert.equal(plans[0].scenes.length,1);assert.equal(plans[0].scenes[0].notes,'  Roh\r\n- Spuren  ');assert.equal(x.el('scene-notes').value,'  Roh\r\n- Spuren  ');assert.equal(x.writes.length,1);assert.deepEqual(x.messages.filter(m=>m.error),[]);
 await assert.rejects(()=>x.ui.prepareNextVisit('missing-plan',{title:'Falscher Plan',notes:'Nicht schreiben',locationId:null}),/nicht verfügbar/);assert.deepEqual(x.store.preparation(x.workspace.token).plans,plans);assert.equal(x.writes.length,1);
});
test('a cancelled next-visit source read cannot append to its previous plan',async t=>{
 const x=await fixture(t);await x.activate();await settle();const read=x.window.campaign.preparation;let release,current=true;
 x.window.campaign.preparation=async(...args)=>{const result=await read(...args);return new Promise(resolve=>release=()=>resolve(result));};
 const opening=x.ui.prepareNextVisit(null,{title:'Alter Auftrag',notes:'Alte Notiz',locationId:null},()=>current);await settle();assert.ok(release);current=false;release();await opening;assert.equal(x.store.preparation(x.workspace.token).plans.length,0);assert.equal(x.writes.length,0);
});

test('handoff visit is inserted before the selected existing visit through the same plan writer',async t=>{const x=await fixture(t);await x.activate();await settle();await x.ui.prepareNextVisit(null,{title:'Original',notes:'bleibt',locationId:null});const plan=x.store.preparation(x.workspace.token).plans[0];await x.ui.prepareNextVisit(plan.id,{title:'Übergabe',notes:'  Roh\r\n- Auftrag',locationId:null,beforeVisitId:plan.scenes[0].id});const saved=x.store.preparation(x.workspace.token).plans[0];assert.deepEqual(saved.scenes.map(s=>s.title),['Übergabe','Original']);assert.equal(saved.scenes[0].notes,'  Roh\r\n- Auftrag');assert.equal(saved.scenes[1].id,plan.scenes[0].id);});

test('opening preparation saves plan order, raw prose and bound sources in one confirmed change',async t=>{
 const x=await fixture(t);await x.activate();await settle();const prose='  Vorlesen\r\n- Tor  ',notes='  GM\r\nEnde  ';await x.ui.prepareNextVisit(null,{title:'Einstieg',notes,locationId:null,readAloud:prose,noteIds:[x.ids.ada,x.ids.ada]});const plan=x.store.preparation(x.workspace.token).plans[0],visit=x.store.session(x.workspace.token,plan.id).visits[0];assert.equal(plan.scenes[0].notes,notes);assert.equal(visit.readAloud,prose);assert.deepEqual(visit.noteIds,[x.ids.ada]);assert.equal(x.writes.length,1);assert.deepEqual(x.messages.filter(m=>m.error),[]);
});
test('invalid opening sources roll back the plan, visit, history and receipt together',async t=>{
 const x=await fixture(t);await x.activate();await settle();const id=randomUUID(),visitId=randomUUID(),command=x.command({kind:'plan',expectedRevision:null,plan:{version:1,id,revision:1,name:'Abend',scenes:[{id:visitId,title:'Tor',notes:'GM',locationId:null}]},opening:{visitId,readAloud:'Vorlesen',noteIds:[randomUUID()]}}),before=x.store.db.serialize();assert.throws(()=>x.store.changePreparation(command));assert.equal(x.store.preparation(x.workspace.token).plans.length,0);assert.ok(x.store.db.serialize().equals(before));
 command.change.opening.noteIds=[x.ids.ada];x.store.changePreparation(command);const bytes=x.store.db.serialize();x.store.changePreparation(command);assert.ok(x.store.db.serialize().equals(bytes));assert.equal(x.store.session(x.workspace.token,id).visits[0].readAloud,'Vorlesen');
});

test('explicit new-plan choice cannot reuse the currently selected plan',async t=>{const x=await fixture(t);await x.activate();await settle();await x.ui.prepareNextVisit(null,{title:'Alter Besuch',notes:'Alt',locationId:null});const before=x.store.preparation(x.workspace.token).plans[0];await x.ui.prepareNextVisit(null,{title:'Neuer Einstieg',notes:'Neu',locationId:null,newPlan:true});const plans=x.store.preparation(x.workspace.token).plans;assert.equal(plans.length,2);assert.deepEqual(plans.find(p=>p.id===before.id),before);assert.equal(plans.find(p=>p.id!==before.id).scenes[0].title,'Neuer Einstieg');});

for(const field of ['visit-read-aloud','session-seed'])for(const phase of ['read','ack'])test(`later ${field} input during visit ${phase} stays with its original editor`,async t=>{
 const x=await fixture(t);await x.activate();await settle();await x.ui.prepareNextVisit(null,{title:'Originalbesuch',notes:'Alter Text',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0],original=plan.scenes[0].id,raw=field==='session-seed'?'Neuer Seed':'  Späterer Vorlesetext\r\n- Behalten  ';
 const port=phase==='read'?'preparation':'changePreparation',send=x.window.campaign[port];let release,held=false;x.window.campaign[port]=async(...args)=>{const result=await send(...args);if(!held){held=true;await new Promise(resolve=>release=resolve);}return result;};
 const pending=x.ui.prepareNextVisit(plan.id,{title:'Neuer Besuch',notes:'Übergabe',locationId:null}).then(value=>({value}),error=>({error}));await settle();assert(release);x.el(field).value=raw;x.el(field).dispatchEvent(new x.window.Event('input'));release();const result=await pending;
 if(phase==='read'){assert.match(result.error?.message??'',/Vorbereitung inzwischen geändert/);assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length,1);}else{assert.equal(result.error,undefined);assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length,2);}
 assert.equal(x.el('scene-title').value,'Originalbesuch');assert.equal(x.el(field).value,raw);x.window.campaign[port]=send;assert.equal(await x.ui.flushPreparation(),true);const saved=x.store.session(x.workspace.token,plan.id);assert.equal(field==='session-seed'?saved.profile.seed:saved.visits.find(v=>v.visitId===original).readAloud,raw);
});

for(const field of ['visit-read-aloud','session-seed'])test(`a lost ${field} acknowledgement is resolved without a second write`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Abend',notes:'GM',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0],raw='  Eigener Text\r\n';x.el(field).value=raw;x.el(field).dispatchEvent(new x.window.Event('input'));
 const send=x.window.campaign.executeSession;let calls=0;x.window.campaign.executeSession=async c=>{calls++;const result=await send(c);if(calls===1)throw new Error('Antwort verloren');return result;};
 assert.equal(await x.ui.flushPreparation(),true);assert.equal(calls,1);const saved=x.store.session(x.workspace.token,plan.id);assert.equal(field==='session-seed'?saved.profile.seed:saved.visits[0].readAloud,raw);assert.equal(await x.ui.flushPreparation(),true);assert.equal(calls,1);
});

for(const applied of [false,true])test(`an unresolved session write stays blocked until its ${applied?'applied':'not-applied'} receipt is checked`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Abend',notes:'GM',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0],field=x.el('visit-read-aloud'),raw='  Gesendet\r\n',later='  Später geschrieben\r\n';field.value=raw;field.dispatchEvent(new x.window.Event('input'));
 const send=x.window.campaign.executeSession,status=x.window.campaign.commitStatus;let calls=0;x.window.campaign.executeSession=async c=>{calls++;if(applied)await send(c);throw new Error('Verbindung weg');};x.window.campaign.commitStatus=async()=>{throw new Error('Status ebenfalls weg');};
 assert.equal(await x.ui.flushPreparation(),false);assert.equal(calls,1);assert.equal(x.el('commit-pending').hidden,false);field.value=later;field.dispatchEvent(new x.window.Event('input'));assert.equal(await x.ui.flushPreparation(),false);assert.equal(calls,1);
 x.window.campaign.commitStatus=status;const bytes=x.store.db.serialize();await x.ui.checkPendingCommit();assert.ok(x.store.db.serialize().equals(bytes));assert.equal(calls,1);assert.equal(field.value,later);assert.equal(x.el('commit-pending').hidden,true);
 x.window.campaign.executeSession=async c=>{calls++;return send(c);};assert.equal(await x.ui.flushPreparation(),true);assert.equal(calls,2);assert.equal(x.store.session(x.workspace.token,plan.id).visits[0].readAloud,later);
});

test('a session receipt survives a fresh handle and refuses mismatched or damaged authority',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Abend',notes:'GM',locationId:null});const plan=x.store.preparation(x.workspace.token).plans[0],detail=x.store.session(x.workspace.token,plan.id).visits[0],command=x.command(null);delete command.change;command.action={kind:'visit',planId:plan.id,expectedRevision:detail.revision,detail:{...detail,readAloud:'  Dauerhaft\r\n'}};const result=x.store.executeSession(command),row=x.store.db.prepare('SELECT * FROM session_receipt WHERE command_id=?').get(command.commandId),ref={family:'session',campaignId:x.campaign.id,commandId:command.commandId,fingerprint:row.fingerprint};
 const other=new x.store.constructor(x.store.db.name);try{const w=other.activate(x.campaign.id),before=other.db.serialize();assert.deepEqual(other.commitStatus(ref,w.token),{outcome:'applied',value:result});assert.ok(other.db.serialize().equals(before));assert.throws(()=>other.commitStatus({...ref,fingerprint:'0'.repeat(64)},w.token),/anders verwendet/);other.db.prepare('UPDATE session_receipt SET checksum=? WHERE command_id=?').run('0'.repeat(64),command.commandId);assert.throws(()=>other.commitStatus(ref,w.token),/beschädigt/);}finally{other.close();}
});

for(const reset of [false,true])test(`copy receipt confirmation preserves exactly one append after ${reset?'dialog reset':'a lost acknowledgement'}`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Original',notes:'  Roh\r\n',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0];x.el('session-copy-open').click();await settle();x.el('session-copy-target').value=plan.id;x.el('session-copy-target').onchange();await settle();
 const send=x.window.campaign.executeSession,status=x.window.campaign.commitStatus;let calls=0;x.window.campaign.executeSession=async c=>{calls++;await send(c);throw new Error('Antwort verloren');};if(reset)x.window.campaign.commitStatus=async()=>{throw new Error('Status weg');};x.el('session-copy-confirm').click();await until(()=>calls===1);assert.equal(calls,1);assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length,2);
 if(reset){assert.equal(x.el('commit-pending').hidden,false);[...x.el('session-copy-dialog').querySelectorAll('button')].find(b=>b.textContent==='Abbrechen').click();assert.equal(x.el('session-copy-dialog').open,false);x.el('session-copy-open').click();await settle();assert.equal(x.el('session-copy-dialog').open,false);assert.equal(calls,1);x.window.campaign.commitStatus=status;const before=x.store.db.serialize();await x.ui.checkPendingCommit();assert.ok(x.store.db.serialize().equals(before));}
 assert.equal(x.el('commit-pending').hidden,true);assert.equal(x.el('session-copy-dialog').open,false);assert.equal(calls,1);assert.equal(x.store.preparation(x.workspace.token).plans[0].scenes.length,2);assert.equal(x.el('scene-list').querySelectorAll('button').length,2);
});

for(const change of ['selection','target','name','party'])test(`copy status confirmation cannot dismiss a newer ${change}`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Original',notes:'GM',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0];x.el('session-copy-open').click();await settle();x.el('session-copy-target').value=change==='name'||change==='party'?'':plan.id;x.el('session-copy-target').onchange();await settle();
 const send=x.window.campaign.executeSession,status=x.window.campaign.commitStatus;let calls=0;x.window.campaign.executeSession=async c=>{calls++;await send(c);throw new Error('Antwort weg');};x.window.campaign.commitStatus=async()=>{throw new Error('Status weg');};x.el('session-copy-confirm').click();await until(()=>calls===1);
 if(change==='selection'){const box=x.el('session-copy-list').querySelector('input');box.checked=false;box.onchange();}else if(change==='target'){x.el('session-copy-target').value='';x.el('session-copy-target').onchange();await settle();}else if(change==='party'){x.el('session-copy-party').checked=false;x.el('session-copy-party').dispatchEvent(new x.window.Event('change'));}else{x.el('session-copy-name').value='Neuer eigener Plan';x.el('session-copy-name').dispatchEvent(new x.window.Event('input'));}
 assert.equal(x.el('session-copy-confirm').disabled,true);const saved=x.store.preparation(x.workspace.token).plans;x.window.campaign.commitStatus=status;await x.ui.checkPendingCommit();assert.equal(x.el('session-copy-dialog').open,true);assert.equal(calls,1);assert.deepEqual(x.store.preparation(x.workspace.token).plans,saved);
});

test('a late session refresh cannot install its old preparation into another campaign',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Alter Abend',notes:'GM',locationId:null});await settle();x.el('visit-read-aloud').value='Speichern';x.el('visit-read-aloud').dispatchEvent(new x.window.Event('input'));
 const read=x.window.campaign.preparation;let release;x.window.campaign.preparation=async(...args)=>{const result=await read(...args);if(args[0]===x.workspace.token&&!release)await new Promise(resolve=>release=resolve);return result;};const saving=x.ui.flushPreparation();await until(()=>!!release);
 const b=x.store.create('Neue Kampagne'),w=x.store.activate(b.id),id=randomUUID();x.store.changePreparation({commandId:randomUUID(),campaignId:b.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title:'Neue Quelle',readAloud:'Neu',gmNotes:'Bleibt',relations:[],creatureId:null,deleted:false}}});x.setOwner(w);await x.ui.activatePreparation(w);release();await saving;assert.equal(x.el('note-title').value,'Neue Quelle');assert.equal(x.el('plans').querySelectorAll('option').length,0);
});

test('copy source prose and its approval basis come from the same current plan',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Original',notes:'Alter sichtbarer Text',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0];x.el('session-copy-open').click();await settle();
 const fresh={...plan,scenes:plan.scenes.map(s=>({...s,notes:'  Neuer tatsächlicher Text\r\n'}))};x.store.changePreparation(x.command({kind:'plan',plan:fresh,expectedRevision:plan.revision}));x.el('session-copy-source').onchange();await until(()=>!x.el('session-copy-confirm').disabled&&x.el('session-copy-list').textContent.includes('Neuer tatsächlicher Text'));assert.match(x.el('session-copy-list').textContent,/Neuer tatsächlicher Text/);assert.doesNotMatch(x.el('session-copy-list').textContent,/Alter sichtbarer Text/);
 x.el('session-copy-confirm').click();await until(()=>x.store.preparation(x.workspace.token).plans.some(p=>p.id!==plan.id));await settle();const copy=x.store.preparation(x.workspace.token).plans.find(p=>p.id!==plan.id);assert(copy);assert.equal(copy.scenes[0].notes,fresh.scenes[0].notes);
});

for(const target of ['new','existing'])test(`after copy status confirmation a newer ${target} selection can be explicitly submitted`,async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Erster Besuch',notes:'  Roh\r\n',locationId:null});await settle();const plan=x.store.preparation(x.workspace.token).plans[0];await x.ui.prepareNextVisit(plan.id,{title:'Zweiter Besuch',notes:'Zwei',locationId:null});await settle();x.el('session-copy-open').click();await settle();x.el('session-copy-target').value=target==='existing'?plan.id:'';x.el('session-copy-target').onchange();await settle();
 const send=x.window.campaign.executeSession,status=x.window.campaign.commitStatus;let calls=0;x.window.campaign.executeSession=async c=>{calls++;await send(c);throw new Error('Antwort weg');};x.window.campaign.commitStatus=async()=>{throw new Error('Status weg');};x.el('session-copy-confirm').click();await until(()=>calls===1);assert.equal(calls,1);
 const boxes=x.el('session-copy-list').querySelectorAll('input');boxes[0].checked=false;boxes[0].onchange();const name=target==='new'?'  Zweite bewusste Kopie  ':x.el('session-copy-name').value,party=target==='existing';if(target==='new'){x.el('session-copy-name').value=name;x.el('session-copy-party').checked=false;}x.el('session-copy-search').value='Zweiter';x.el('session-copy-search').oninput();x.window.campaign.commitStatus=status;await x.ui.checkPendingCommit();assert.equal(x.el('session-copy-dialog').open,true);assert.equal(x.el('session-copy-name').value,name);assert.equal(x.el('session-copy-party').checked,party);assert.equal(x.el('session-copy-search').value,'Zweiter');assert.equal(x.el('session-copy-order').children.length,1);
 x.window.campaign.executeSession=async c=>{calls++;return send(c);};x.el('session-copy-confirm').click();await until(()=>calls===2);await until(()=>x.el('session-copy-dialog').open===false);const plans=x.store.preparation(x.workspace.token).plans;if(target==='existing'){assert.equal(plans.find(p=>p.id===plan.id).scenes.length,5);}else{assert.equal(plans.length,3);assert.equal(plans.find(p=>p.name==='  Zweite bewusste Kopie  ').scenes.length,1);}
});

test('copy recovery keeps a removed selected visit explicit and blocks writing until it is removed',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Einziger Besuch',notes:'GM',locationId:null});await settle();const source=x.store.preparation(x.workspace.token).plans[0];x.el('session-copy-open').click();await settle();const send=x.window.campaign.executeSession,status=x.window.campaign.commitStatus;let calls=0;x.window.campaign.executeSession=async c=>{calls++;await send(c);throw new Error('Antwort weg');};x.window.campaign.commitStatus=async()=>{throw new Error('Status weg');};x.el('session-copy-confirm').click();await until(()=>calls===1);assert.equal(calls,1);x.el('session-copy-search').value='Neue Auswahl';x.el('session-copy-search').oninput();x.store.changePreparation(x.command({kind:'plan',expectedRevision:source.revision,plan:{...source,scenes:[]}}));x.window.campaign.commitStatus=status;await x.ui.checkPendingCommit();assert.equal(x.el('session-copy-dialog').open,true);assert.match(x.el('session-copy-order').textContent,/Besuch fehlt/);assert.equal(x.el('session-copy-order').children.length,1);assert.equal(x.el('session-copy-confirm').disabled,true);x.el('session-copy-confirm').onclick();await settle();assert.equal(calls,1);assert.equal(x.store.preparation(x.workspace.token).plans.length,2);
 [...x.el('session-copy-order').querySelectorAll('button')].find(b=>b.textContent==='Entfernen').click();assert.equal(x.el('session-copy-order').children.length,0);assert.equal(x.el('session-copy-confirm').disabled,true);
});

test('the shared session snapshot leaves historical receipt bytes and their replay contract unchanged',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Abend',notes:'  Original\r\n',locationId:null});const plan=x.store.preparation(x.workspace.token).plans[0],snapshot=x.store.session(x.workspace.token,plan.id);assert.deepEqual(snapshot.plan,plan);const command={commandId:randomUUID(),campaignId:x.campaign.id,token:x.workspace.token,action:{kind:'profile',profile:{...snapshot.profile,seed:'Neuer Seed'},expectedRevision:snapshot.profile.revision}},ack=x.store.executeSession(command),row=x.store.db.prepare('SELECT * FROM session_receipt WHERE command_id=?').get(command.commandId);assert.equal(Object.hasOwn(ack,'plan'),false);assert.equal(Object.hasOwn(JSON.parse(row.payload),'plan'),false);const fresh=new x.store.constructor(x.store.db.name);try{const w=fresh.activate(x.campaign.id),before=fresh.db.serialize();assert.deepEqual(fresh.executeSession({...command,token:w.token}),ack);assert.ok(fresh.db.serialize().equals(before));assert.equal(fresh.db.prepare('SELECT payload FROM session_receipt WHERE command_id=?').get(command.commandId).payload,row.payload);}finally{fresh.close();}
});

test('planning area preserves the world editor and profile autosaves preserve live party input nodes and later edits',async t=>{
 const x=await fixture(t);await x.activate();x.el('preparation-planning').click();await settle();
 assert.equal(x.el('preparation-knowledge-workspace').hidden,true);assert.equal(x.el('preparation-planning-workspace').hidden,false);
 x.el('plan-create').click();await until(()=>!!x.el('plans').value);await settle();
 x.el('session-free-party').click();const [level,count]=x.el('session-party-levels').querySelectorAll('input');level.value='3';level.oninput();count.value='2';count.oninput();
 const execute=x.window.campaign.executeSession;let release,first=true;
 x.window.campaign.executeSession=async c=>{if(first&&c.action.kind==='profile'){first=false;await new Promise(r=>release=r);}return execute(c);};
 const save=x.ui.flushPreparation();await until(()=>!!release);
 assert.equal(level.disabled,false,'autosave must not disable the field being edited');assert.equal(count.disabled,false);
 count.value='3';count.oninput();release();assert.equal(await save,true);
 assert.equal(x.el('session-party-levels').querySelectorAll('input')[0],level,'acknowledgement must not replace focused controls');
 assert.equal(x.el('session-party-levels').querySelectorAll('input')[1],count);assert.equal(count.value,'3');
 const profile=x.store.session(x.workspace.token,x.el('plans').value).profile;assert.equal(profile.party[0].count,3);assert.equal(profile.revision,2,'newer edit is saved against the acknowledged revision');
 // Handlers must still update the current draft after the first acknowledgement.
 level.value='4';level.oninput();assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.store.session(x.workspace.token,x.el('plans').value).profile.party[0].level,4);
 const note=x.el('note-title');x.el('preparation-knowledge').click();await settle();assert.equal(x.el('preparation-planning-workspace').hidden,true);assert.equal(x.el('note-title'),note);
 x.el('preparation-planning').click();await settle();assert.equal(x.el('session-party-levels').querySelector('input'),level);
 x.el('session-party-levels').querySelector('button').click();assert.equal(await x.ui.flushPreparation(),true);assert.deepEqual(x.store.session(x.workspace.token,x.el('plans').value).profile.party,[]);
 await x.ui.openPreparedNote(x.ids.ada);assert.equal(x.el('preparation-knowledge-workspace').hidden,false);assert.equal(x.el('preparation-planning-workspace').hidden,true);
});

test('session generation gives local feedback, avoids duplicate sends and retains explicit optional reward modes',async t=>{
 const x=await fixture(t);await x.activate();x.el('plan-create').click();await until(()=>!!x.el('plans').value);await settle();
 assert.equal(x.el('session-generation-options').hasAttribute('open'),false);assert.equal(x.el('session-loot-compensate').hasAttribute('checked'),false);
 let finish,calls=0,request;x.window.campaign.generateSession=async(_token,r)=>{calls++;request=r;return new Promise(resolve=>finish=resolve);};
 const submit=()=>x.el('session-generate-form').onsubmit({preventDefault(){}});submit();await until(()=>!!finish);submit();await settle();
 assert.equal(calls,1);assert.equal(x.el('session-generate').disabled,true);assert.match(x.el('session-generation-feedback').textContent,/werden erzeugt/);
 finish({ok:false,error:'Keine passende Komposition für diese Quellen.'});await settle();assert.match(x.el('session-generation-feedback').textContent,/Keine passende Komposition/);assert.equal(x.el('session-generate').disabled,false);
 // The optional modes are still passed exactly as explicitly chosen.
 x.el('session-loot-compensate').checked=true;x.el('session-magic-compensate').checked=false;submit();await until(()=>calls===2);assert.equal(request.compensateLoot,true);
 finish({ok:false,error:'Ledger unvollständig.'});await settle();assert.match(x.el('session-generation-feedback').textContent,/Ledger unvollständig/);
});

test('unresolved profile replies stop further writes without replacing the later draft',async t=>{
 const x=await fixture(t);await x.activate();x.el('plan-create').click();await until(()=>!!x.el('plans').value);await settle();x.el('session-free-party').click();
 const level=x.el('session-party-levels').querySelector('input');level.value='3';level.oninput();let writes=0;
 x.window.campaign.executeSession=async()=>{writes++;throw new Error('transport lost');};x.window.campaign.commitStatus=async()=>({ok:false,error:'status unavailable'});
 assert.equal(await x.ui.flushPreparation(),false);assert.equal(writes,1);assert.equal(x.el('session-party-levels').querySelector('input'),level);assert.equal(level.disabled,true,'only an actual unresolved write locks the draft');
 x.el('session-generate-form').onsubmit({preventDefault(){}});await settle();assert.equal(writes,1);assert.match(x.el('session-generation-feedback').textContent,/keine neue Vorschau/);assert.doesNotMatch(x.el('session-generation-feedback').textContent,/werden erzeugt/);
});

test('saving a renamed plan immediately updates the selected plan label',async t=>{
 const x=await fixture(t);await x.activate();await x.ui.prepareNextVisit(null,{title:'Schleuse',notes:'Eigene Vorbereitung',locationId:null});await settle();
 x.el('plan-name').value='Nacht an der Schleuse';x.el('plan-name').dispatchEvent(new x.window.Event('input',{bubbles:true}));
 assert.equal(await x.ui.flushPreparation(),true);
 const saved=x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value);
 assert.equal(saved.name,'Nacht an der Schleuse');
 assert.equal([...x.el('plans').options].find(o=>o.value===saved.id).textContent,saved.name);
});

for(const externalChange of [false,true])test('a renamed evening uses its saved plan revision and '+(externalChange?'rejects a later external change':'accepts all three scenes without reopening'),async t=>{
 const x=await fixture(t);for(const method of ['generateSession','sessionRun'])x.window.campaign[method]=async(...args)=>{try{return{ok:true,value:x.store[method](...args)};}catch(e){return{ok:false,error:e.message};}};
 await x.activate();x.el('plan-create').click();await until(()=>!!x.el('plans').value);await settle();
 x.el('plan-name').value='Drei Begegnungen mit Beute';x.el('plan-name').dispatchEvent(new x.window.Event('input'));
 const partyControls=x.el('session-party-levels');assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.el('session-party-levels'),partyControls);
 assert.equal(x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value).revision,2);
 for(const level of ['3','4']){x.el('session-free-party').click();const rows=x.el('session-party-levels').querySelectorAll('.session-party-row'),inputs=rows[rows.length-1].querySelectorAll('input');inputs[0].value=level;inputs[0].oninput();inputs[1].value='2';inputs[1].oninput();}
 x.el('session-fraction').value='0.6';x.el('session-fraction').oninput();x.el('session-seed').value='179974';x.el('session-seed').oninput();x.el('session-scene-count').value='3';x.el('session-scene-count').oninput();assert.equal(await x.ui.flushPreparation(),true);
 x.el('session-generate-form').onsubmit({preventDefault(){}});await settle();assert.equal(x.el('session-preview').querySelectorAll('[data-proposal-index]').length,3,JSON.stringify(x.messages.slice(-4))+' '+x.el('session-generation-feedback').textContent);
 x.el('session-select-visible').click();x.el('session-review-selection').click();
 if(externalChange){const plan=x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value);x.store.changePreparation(x.command({kind:'plan',expectedRevision:plan.revision,plan:{...plan,name:'Zwischenzeitlich geändert'}}));}
 x.el('session-selection-confirm').click();if(externalChange){await until(()=>x.messages.some(m=>/Timeline geändert/.test(m.text)));assert.equal(x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value).scenes.length,0);assert.equal(x.el('session-selection-dialog').open,true);assert.ok(x.messages.some(m=>/Timeline geändert/.test(m.text)));return;}for(const deadline=Date.now()+2000;Date.now()<deadline&&x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value).scenes.length!==3;)await delay(5);await settle();
 assert.equal(x.store.preparation(x.workspace.token).plans.find(p=>p.id===x.el('plans').value).scenes.length,3,JSON.stringify(x.messages.slice(-4))+' '+x.el('session-selection-dialog').textContent);
});

test('encounter count belongs to its plan, survives reopening and clears back to automatic',async t=>{
 const x=await fixture(t);await x.activate();x.el('plan-create').click();await until(()=>!!x.el('plans').value);await settle();const first=x.el('plans').value;
 x.el('session-scene-count').value='3';x.el('session-scene-count').oninput();assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.store.session(x.workspace.token,first).profile.encounterCount,3);
 x.el('plan-create').click();await until(()=>x.el('plans').value!==first);await settle();assert.equal(x.el('session-scene-count').value,'');x.el('session-scene-count').value='7';x.el('session-scene-count').oninput();assert.equal(await x.ui.flushPreparation(),true);
 x.store.selectPreparation(x.workspace.token,{noteId:null,planId:first,sceneId:null});await x.activate();await settle();assert.equal(x.el('session-scene-count').value,'3');
 x.el('session-scene-count').value='';x.el('session-scene-count').oninput();assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.store.session(x.workspace.token,first).profile.encounterCount,null);await x.activate();await settle();assert.equal(x.el('session-scene-count').value,'');
 for(const bad of [0,11,1.5]){const profile=x.store.session(x.workspace.token,first).profile;assert.throws(()=>x.store.executeSession({commandId:randomUUID(),campaignId:x.campaign.id,token:x.workspace.token,action:{kind:'profile',profile:{...profile,encounterCount:bad},expectedRevision:profile.revision}}),/Begegnungszahl/);assert.equal(x.store.session(x.workspace.token,first).profile.revision,profile.revision);}
});

async function manualReward(t){
 const x=await fixture(t);await x.activate();const target=await x.ui.prepareNextVisit(null,{title:'Belohnter Besuch',notes:'  Exakte Planung\r\n',locationId:null});await settle();
 x.el('visit-has-reward').checked=true;x.el('visit-has-reward').oninput();x.el('visit-reward-xp').value='60';x.el('visit-reward-xp').oninput();assert.equal(await x.ui.flushPreparation(),true);await settle();
 const send=x.window.campaign.executeSession,calls=[];x.window.campaign.executeSession=async c=>{calls.push(c);return send(c);};return{...x,target,calls,reward:()=>x.store.session(x.workspace.token,target.planId).visits.find(v=>v.visitId===target.visitId).reward};
}
test('an empty manual reward XP input cannot autosave as zero or release navigation; explicit zero remains valid',async t=>{
 const x=await manualReward(t),original=x.reward(),before=x.store.db.serialize();
 x.el('visit-reward-xp').value='';x.el('visit-reward-xp').oninput();x.el('visit-reward-save').click();await settle();
 assert.equal(x.calls.length,0,'unfinished XP must not dispatch a mutation');assert.deepEqual(x.reward(),original);assert.ok(x.store.db.serialize().equals(before));assert.equal(x.el('visit-reward-xp').value,'');assert.equal(await x.ui.leavePreparation(),false);assert.match(x.messages.at(-1).text,/Story-XP/);
 x.el('visit-reward-xp').value='0';x.el('visit-reward-xp').oninput();assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.calls.length,1);assert.equal(x.reward().poolXp,0);assert.equal(x.reward().id,original.id);
});
test('removing the manual reward remains possible while its XP field is unfinished',async t=>{
 const x=await manualReward(t);x.el('visit-reward-xp').value='';x.el('visit-reward-xp').oninput();x.el('visit-has-reward').checked=false;x.el('visit-has-reward').oninput();assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.reward(),null);assert.equal(x.calls.length,1);
});

test('returning from a newly created place refreshes the quest location choices and preserves its status', async t => {
 const x=await fixture(t), note={...x.original,id:randomUUID(),revision:1,kind:'quest',title:'Der verschwundene Bote'};
 x.store.changePreparation(x.command({kind:'note',expectedRevision:null,note}));
 await x.activate();await x.ui.openPreparedNote(note.id);
 assert.equal(x.el('narrative-editor').querySelector('[aria-label="Quest-Ort"]').options.length,1);
 x.el('locations-tab').click();await settle();
 x.el('new-location-name').value='Alte Brücke';x.el('new-location-type').value='poi';
 x.el('location-form').onsubmit({preventDefault(){}});await settle();
 const place=x.store.preparation(x.workspace.token).locations.find(row=>row.document.name==='Alte Brücke');assert.ok(place);
 x.el('knowledge-tab').click();await settle();
 const panel=x.el('narrative-editor'),choice=panel.querySelector('[aria-label="Quest-Ort"]');
 assert.ok([...choice.options].some(option=>option.value===place.document.id));
 choice.value=place.document.id;choice.onchange();
 const status=panel.querySelector('[aria-label="Narrativer Status"]');status.value='closed';status.onchange();
 assert.equal(await x.ui.flushPreparation(),true);
 await x.activate();await x.ui.openPreparedNote(note.id);
 const saved=x.store.narrative(x.workspace.token,note.id);
 assert.equal(saved.state.locationId,place.document.id);assert.equal(saved.state.status,'closed');assert.equal(saved.award,null);
 assert.equal(x.el('narrative-editor').querySelector('[aria-label="Quest-Ort"]').value,place.document.id);
});

async function encounterSearchFixture(t){
 const x=await fixture(t);for(let i=0;i<12;i++)x.store.saveEncounterPlan({commandId:randomUUID(),campaignId:x.campaign.id,token:x.workspace.token,expectedRevision:null,plan:{id:randomUUID(),name:'Wache '+String(i).padStart(2,'0'),notes:'Original',party:[],entries:[],sources:[],catalogHash:''}});
 const calls=[],read=x.window.campaign.encounterPlans;x.window.campaign.encounterPlans=async(...args)=>{calls.push(args);return read(...args);};await x.activate();await x.ui.prepareNextVisit(null,{title:'Besuch',notes:'  Roh\r\n',locationId:null});await settle();
 return{...x,calls,search:async text=>{x.el('visit-encounter-search').value=text;x.el('visit-encounter-search').oninput();await settle();}};
}
test('session reads and new receipts omit the global Encounter catalog; inspector searches only on demand with eight choices',async t=>{
 const x=await encounterSearchFixture(t),id=x.el('plans').value;assert.equal(x.calls.length,0);assert.deepEqual(x.store.session(x.workspace.token,id).encounters,[]);await x.search('W');assert.equal(x.calls.length,0);await x.search('Wache');assert.equal(x.calls.length,1);assert.equal(x.calls[0][2],9);assert.equal(x.el('visit-encounter').querySelectorAll('option').length,9);assert.match(x.el('visit-encounter-status').textContent,/eingrenzen/);
 await x.search('Wache 11');const option=x.el('visit-encounter').querySelectorAll('option')[1];x.el('visit-encounter').value=option.value;x.el('visit-encounter').onchange();assert.equal(x.el('visit-attach').disabled,false);x.el('visit-attach').click();await until(()=>x.store.session(x.workspace.token,id).groups.length===1);await settle();assert.equal(x.store.session(x.workspace.token,id).groups[0].sourceEncounterId,option.value);assert.equal(x.el('visit-encounter-search').value,'Wache 11');
 const row=x.store.db.prepare('SELECT payload FROM session_receipt ORDER BY rowid DESC LIMIT 1').get();assert.deepEqual(JSON.parse(row.payload).encounters,[]);assert.equal(x.store.encounterPlans(x.workspace.token,'').length,12);assert.equal(x.store.encounterPlans(x.workspace.token,'Wache',3).length,3);assert.throws(()=>x.store.encounterPlans(x.workspace.token,'Wache',0),/Suchgrenze/);
});
for(const outcome of ['result','failure'])test(`late Encounter search ${outcome} cannot replace a newer query or selected visit`,async t=>{
 const x=await encounterSearchFixture(t),read=x.window.campaign.encounterPlans;let finish;x.window.campaign.encounterPlans=async(...args)=>args[1]==='Wache'?new Promise(r=>finish=()=>r(outcome==='failure'?{ok:false,error:'Alter Suchfehler'}:{ok:true,value:[{id:'old',revision:1,name:'Alt'}]})):read(...args);
 await x.search('Wache');assert.ok(finish);assert.match(x.el('visit-encounter-status').textContent,/gesucht/);await x.search('Wache 11');const status=x.el('visit-encounter-status').textContent;finish();await settle();assert.equal(x.el('visit-encounter-status').textContent,status);assert.equal(x.el('visit-encounter').querySelectorAll('option').length,2);
 await x.search('Wache');const plan=x.el('plans').value;await x.ui.prepareNextVisit(plan,{title:'Zweiter Besuch',notes:'',locationId:null});await settle();finish();await settle();assert.equal(x.el('visit-encounter-search').value,'');assert.equal(x.el('visit-encounter').querySelectorAll('option').length,1);assert.equal(x.el('visit-attach').disabled,true);
});
test('new authored inputs revoke pending Encounter results and saving preserves the query for a fresh search',async t=>{
 const x=await encounterSearchFixture(t),read=x.window.campaign.encounterPlans;let finish;x.window.campaign.encounterPlans=async(...args)=>args[1]==='Wache'&&!finish?new Promise(r=>finish=async()=>r(await read(...args))):read(...args);
 await x.search('Wache');x.el('visit-read-aloud').value='Neu';x.el('visit-read-aloud').oninput();await finish();await settle();assert.equal(x.el('visit-encounter').querySelectorAll('option').length,1);assert.equal(x.el('visit-attach').disabled,true);assert.equal(await x.ui.flushPreparation(),true);await settle();assert.equal(x.el('visit-encounter-search').value,'Wache');assert.equal(x.el('visit-encounter').querySelectorAll('option').length,9);
});

test('historical Session receipts replay their original catalog snapshot without rewriting bytes',async t=>{
 const x=await encounterSearchFixture(t),planId=x.el('plans').value,profile=x.store.session(x.workspace.token,planId).profile,command={commandId:randomUUID(),campaignId:x.campaign.id,token:x.workspace.token,action:{kind:'profile',profile:{...profile,seed:'Historisch'},expectedRevision:profile.revision}},ack=x.store.executeSession(command),legacy={...ack,encounters:x.store.encounterPlans(x.workspace.token,'')},payload=JSON.stringify(legacy),checksum=createHash('sha256').update(payload).digest('hex');
 x.store.db.prepare('UPDATE session_receipt SET payload=?,checksum=? WHERE command_id=?').run(payload,checksum,command.commandId);const fresh=new x.store.constructor(x.store.db.name);try{const w=fresh.activate(x.campaign.id),bytes=fresh.db.serialize();assert.deepEqual(fresh.executeSession({...command,token:w.token}),legacy);assert.ok(fresh.db.serialize().equals(bytes));assert.equal(fresh.db.prepare('SELECT payload FROM session_receipt WHERE command_id=?').get(command.commandId).payload,payload);assert.deepEqual(fresh.session(w.token,planId).encounters,[]);}finally{fresh.close();}
});

test('a canonical location created after preparation activation opens without a reload',async t=>{
 const x=await fixture(t);await x.activate();const id=randomUUID(),document={kind:'location',version:1,id,name:'Fresh Atlas chapel',type:'poi',sections:[{id:randomUUID(),title:'Beschreibung',markdown:'Fresh prose\n\nSecond paragraph'},{id:randomUUID(),title:'Notizen',markdown:'Private note'}],detailMaps:[],keyLinks:[]};x.store.changePreparation(x.command({kind:'location',expectedRevision:null,document}));await x.ui.openPreparedLocation(id);assert.equal(x.el('location-name').value,document.name);assert.equal(x.el('location-sections').querySelector('textarea').value,document.sections[0].markdown);
});

test('opening a canonical location preserves input typed while its fresh read is pending',async t=>{
 const x=await fixture(t);await x.activate();const id=randomUUID(),document={kind:'location',version:1,id,name:'Fresh read chapel',type:'poi',sections:[],detailMaps:[],keyLinks:[]};x.store.changePreparation(x.command({kind:'location',expectedRevision:null,document}));const read=x.window.campaign.preparation;let release;x.window.campaign.preparation=async(...args)=>{const result=await read(...args);return new Promise(resolve=>{release=()=>resolve(result);});};const pending=x.ui.openPreparedLocation(id);for(let i=0;i<30&&!release;i++)await settle();assert.ok(release);x.el('note-read-aloud').value='New prose during location read';x.el('note-read-aloud').dispatchEvent(new x.window.Event('input'));release();await pending;assert.equal(x.el('note-read-aloud').value,'New prose during location read');assert.equal(x.el('location-name').value==='Fresh read chapel',false);assert.ok(x.messages.some(m=>m.text.includes('Neue Vorbereitungseingabe')));
});

function rewardRow(x,index=0){const row=x.el('visit-reward-items').children[index];return{row,name:row.querySelector('input[placeholder="Gegenstand"]'),quantity:row.querySelector('input[type=number]'),cost:row.querySelector('input[placeholder="Gold pro Stück"]'),remove:row.querySelector('button')};}
function rewardInput(input,text){input.value=text;input.oninput();}
test('adding and removing manual loot siblings preserves raw quantities and current input nodes',async t=>{
 const x=await manualReward(t);x.el('visit-item-add').click();const first=rewardRow(x);rewardInput(first.name,'Münzen');rewardInput(first.quantity,'');x.el('visit-item-add').click();assert.equal(rewardRow(x).quantity.value,'');assert.equal(rewardRow(x).quantity===first.quantity,true);rewardRow(x,1).remove.click();assert.equal(rewardRow(x).quantity.value,'');assert.equal(rewardRow(x).quantity===first.quantity,true);assert.equal(x.calls.length,0);assert.equal(await x.ui.flushPreparation(),false);assert.equal(x.calls.length,0);assert.match(x.messages.at(-1).text,/Menge/);assert.equal(first.quantity.value,'');
 rewardInput(first.quantity,'01');assert.equal(await x.ui.flushPreparation(),true);await settle();assert.equal(rewardRow(x).quantity===first.quantity,true);assert.equal(first.quantity.value,'01');rewardInput(first.name,'  Neu nach Bestätigung  ');assert.equal(await x.ui.flushPreparation(),true);assert.equal(x.reward().items[0].name,'  Neu nach Bestätigung  ');assert.equal(x.reward().items[0].quantity,1);
});
test('removing an earlier manual loot row keeps later removal bound to its actual item',async t=>{
 const x=await manualReward(t);for(const name of ['A','B','C']){x.el('visit-item-add').click();rewardInput(rewardRow(x,x.el('visit-reward-items').children.length-1).name,name);}const middle=rewardRow(x,1),last=rewardRow(x,2);rewardRow(x).remove.click();assert.equal(rewardRow(x).name===middle.name,true);last.remove.click();assert.equal(x.el('visit-reward-items').children.length,1);assert.equal(await x.ui.flushPreparation(),true);assert.deepEqual(x.reward().items.map(i=>i.name),['B']);
});
test('removing and re-adding a manual reward clears old rows and revokes detached controls',async t=>{
 const x=await manualReward(t);x.el('visit-item-add').click();const old=rewardRow(x);rewardInput(old.name,'Alter Gegenstand');assert.equal(await x.ui.flushPreparation(),true);await settle();const detached=rewardRow(x);x.el('visit-has-reward').checked=false;x.el('visit-has-reward').oninput();x.el('visit-has-reward').checked=true;x.el('visit-has-reward').oninput();assert.equal(x.el('visit-reward-items').children.length,0);assert.equal(x.el('visit-reward-xp').value,'0');x.el('visit-item-add').click();rewardInput(rewardRow(x).name,'Neuer Gegenstand');detached.remove.onclick();rewardInput(detached.name,'Verspätet');assert.equal(await x.ui.flushPreparation(),true);assert.deepEqual(x.reward().items.map(i=>i.name),['Neuer Gegenstand']);
});

test('manual loot fields stay editable during their own save and retain newer values against the acknowledged revision',async t=>{
 const x=await manualReward(t);x.el('visit-item-add').click();rewardInput(rewardRow(x).name,'Alt');assert.equal(await x.ui.flushPreparation(),true);await settle();const row=rewardRow(x),send=x.window.campaign.executeSession;let release;
 x.window.campaign.executeSession=async c=>{const result=await send(c);if(!release)return new Promise(r=>release=()=>r(result));return result;};rewardInput(row.quantity,'02');const saving=x.ui.flushPreparation();await until(()=>!!release);assert.equal(row.quantity.disabled,false);assert.equal(row.name.disabled,false);rewardInput(row.quantity,'03');rewardInput(row.name,'Neu während Bestätigung');release();assert.equal(await saving,true);assert.equal(rewardRow(x).quantity===row.quantity,true);assert.equal(row.quantity.value,'03');assert.equal(x.reward().items[0].quantity,3);assert.equal(x.reward().items[0].name,'Neu während Bestätigung');
});
