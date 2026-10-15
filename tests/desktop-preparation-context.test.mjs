import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
const base='.build/realist-preparation',require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:base+'/store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export * from './src/app/preparation';export {WorldLinksWorkbench} from './src/app/world-links-ui';",resolveDir:process.cwd(),sourcefile:'preparation-context-fixture.ts'},outfile:base+'/ui.cjs',bundle:true,platform:'node',format:'cjs'});
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
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
 window.campaign={};for(const method of ['preparation','preparationDraft','keepPreparationDrafts','keepDeskDraft','discardPreparationDraft','selectPreparation','reconcilePreparation','reconcilePreparationContent','worldLinks','deskContent','searchDesk','worldRelationPairDraft','keepWorldRelationPairDraft','discardWorldRelationPairDraft','reconcileWorldRelationPair','executeWorldRelationPair','worldRelationPairHistory','executeWorldRelationPairHistory','reconcileWorldRelationPairHistory','live','session','executeSession','progress','encounterTables','sessionRuns','generationSources','npcs'])window.campaign[method]=async(...args)=>wrap(()=>store[method](...args));
 window.campaign.changePreparation=async c=>{writes.push(c);return wrap(()=>store.changePreparation(c));};window.campaign.changePreparationContent=async c=>{writes.push(c);return wrap(()=>store.changePreparationContent(c));};
 const file=require.resolve('../'+base+'/ui.cjs');delete require.cache[file];const ui=require(file);ui.initPreparation((text,error)=>messages.push({text,error}),async()=>{});
 let owner=workspace;const graph=new ui.WorldLinksWorkbench(()=>owner,()=>ui.leavePreparation(),text=>messages.push({text}),async(ref,current)=>ui.openPreparedNote(ref.id,current));
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
