import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
import {CampaignStore} from '../../../src/app/storage/store';
import {WorldLinksWorkbench} from '../../../src/app/campaign/world-links-ui';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(copy=false,mode:'pair'|'single'|'history'='pair'){
 const root=mkdtempSync(join(tmpdir(),'world-pair-recovery-'));let store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 let campaign=store.create('Beziehungsprüfung');let workspace=store.activate(campaign.id);
 let source=campaignLocalId('10000000-0000-4000-8000-000000000671'),target=campaignLocalId('10000000-0000-4000-8000-000000000672');
 for(const [id,title] of [[source,'Ada'],[target,'Bert']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'  Halt!\r\n',gmNotes:'Unveränderte Quelle',relations:[],creatureId:null,deleted:false}}});
 let command={commandId:'applied-pair',campaignId:campaign.id,token:workspace.token,draftWriteId:'world-links-pair-retained',action:{kind:'add' as const,sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'kennt',reverseLabel:'kennt Ada'}};
 if(mode!=='single'){store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId:command.draftWriteId,command},null);store.executeWorldRelationPair(command);if(mode==='pair')store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId:command.draftWriteId,command},null);}
 if(copy){const snapshot=join(root,'snapshot.sqlite');await store.campaignSnapshot(workspace.token,snapshot);const next=new CampaignStore(join(root,'copy.sqlite'),'test');campaign=next.acceptCampaignSnapshot(snapshot,'Unabhängige Kopie',{});store.close();store=next;workspace=store.activate(campaign.id);const notes=store.preparation(workspace.token,'').notes;source=notes.find(row=>row.note.title==='Ada')!.note.id;target=notes.find(row=>row.note.title==='Bert')!.note.id;command=store.worldRelationPairDraft(workspace.token,source)!.command as typeof command;}
 const {document,window}=parseHTML('<html><body></body></html>'),prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
 function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
 const calls:{method:string;args:any[]}[]=[],api:any={};
 for(const method of ['worldLinks','deskContent','searchDesk','preparationDraft','worldRelationPairDraft','keepWorldRelationPairDraft','worldRelationPairHistory','discardWorldRelationPairDraft','reconcileWorldRelationPair','executeWorldRelationPair','reconcileWorldRelationPairHistory','executeWorldRelationPairHistory','keepDeskDraft','changePreparationContent','discardPreparationDraft','reconcilePreparationContent'])api[method]=async(...args:any[])=>{calls.push({method,args});try{return{ok:true,value:(store as any)[method](...args)};}catch(error){return{ok:false,error:(error as Error).message};}};
 window.campaign=api;const workbench=new WorldLinksWorkbench(()=>workspace,async()=>true,()=>{},async()=>{}),dialog=document.getElementById('world-links') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 await workbench.open({kind:'note',id:source});
 async function click(text:string,method:string){const control=[...dialog.querySelectorAll('button')].find(button=>button.textContent?.startsWith(text));assert.ok(control?.isConnected,'Connected control: '+text);let running:Promise<unknown>|undefined;const original=(workbench as any)[method];(workbench as any)[method]=function(...args:any[]){return running=original.apply(workbench,args);};try{control.click();assert.ok(running,'Control invoked '+method);await running;}finally{(workbench as any)[method]=original;}}
 async function begin(apply=true){
  if(mode==='history'){const original=api.executeWorldRelationPairHistory;api.executeWorldRelationPairHistory=async(...args:any[])=>{if(apply)await original(...args);return{ok:false,error:'Historyantwort verloren'};};await click('Rückgängig ·','changeHistory');return;}
  const input=el<HTMLInputElement>('world-link-target-search');input.value='Bert';input.dispatchEvent(new window.Event('input',{bubbles:true}));for(let i=0;i<30&&!el('world-link-targets').querySelector('button');i++)await new Promise(resolve=>setImmediate(resolve));(el('world-link-targets').querySelector('button') as HTMLButtonElement).click();const label=el<HTMLInputElement>('world-link-label');label.value='kennt';label.dispatchEvent(new window.Event('input',{bubbles:true}));
  let submitted:any;const original=api.changePreparationContent;api.changePreparationContent=async(command:any)=>{submitted=command;if(apply)await original(command);return{ok:false,error:'Notizantwort verloren'};};await click('Beziehung übernehmen','add');return submitted;
 }
 return{store,campaign,source,target,command,workbench,dialog,el,api,calls,get workspace(){return workspace;},input(id:string,value:string){const input=el<HTMLInputElement>(id);input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));},async reopen(reactivate=true){workbench.reset();if(reactivate)workspace=store.activate(campaign.id);await workbench.open({kind:'note',id:source});},begin,click,async check(){await click('Auftrag prüfen','reconcile');},cleanup(){workbench.reset();store.close();rmSync(root,{recursive:true,force:true});Object.assign(globalThis,prior);}};
}

for(const state of ['retained','removed','copied'])test(`pair recovery closes an applied command with a ${state} draft`,async()=>{
 const f=await fixture(state==='copied');try{
  const before=f.store.preparation(f.workspace.token,'').notes;
  if(state==='removed')f.store.discardWorldRelationPairDraft(f.workspace.token,f.source,f.command.draftWriteId);
  await f.check();assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source),null);
  assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,true);assert.match(f.el('world-links-status').textContent!,/gespeichert bestätigt/);
  assert.equal(f.calls.filter(c=>c.method==='executeWorldRelationPair').length,0);assert.deepEqual(f.store.preparation(f.workspace.token,'').notes,before);assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);
  await f.reopen();assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,true);
 }finally{f.cleanup();}
});

test('pair recovery preserves labels changed while the original receipt is checked',async()=>{
 const f=await fixture();try{
  const hold=deferred<any>(),original=f.api.reconcileWorldRelationPair;f.api.reconcileWorldRelationPair=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const task=f.check();f.input('world-link-label','neuer Auftrag');f.input('world-link-reverse-label','neue Rückrichtung');hold.resolve(null);await task;
  assert.equal(f.el<HTMLInputElement>('world-link-label').value,'neuer Auftrag');assert.equal(f.el<HTMLInputElement>('world-link-reverse-label').value,'neue Rückrichtung');assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source),null);assert.match(f.el('world-links-status').textContent!,/neuere Eingaben/i);assert.equal(f.calls.filter(c=>c.method==='executeWorldRelationPair').length,0);
 }finally{f.cleanup();}
});

test("pair recovery cannot discard another writer's newer draft",async()=>{
 const f=await fixture();try{
  const hold=deferred<any>(),original=f.api.reconcileWorldRelationPair;f.api.reconcileWorldRelationPair=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const task=f.check(),next={...f.command,commandId:'new-command',draftWriteId:'new-draft',action:{...f.command.action,sourceRevision:2,targetRevision:2,forwardLabel:'beschützt',reverseLabel:'wird beschützt'}};
  f.store.keepWorldRelationPairDraft(f.workspace.token,{version:1,writeId:next.draftWriteId,command:next},f.command.draftWriteId);hold.resolve(null);await task;
  assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,'new-draft');assert.equal(f.calls.filter(c=>c.method==='discardWorldRelationPairDraft').length,0);assert.doesNotMatch(f.el('world-links-status').textContent!,/^Beziehungspaarauftrag als gespeichert bestätigt/);assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);
 }finally{f.cleanup();}
});

test('pair recovery cannot install a late answer into a reopened campaign context',async()=>{
 const f=await fixture();try{
  const hold=deferred<any>(),original=f.api.reconcileWorldRelationPair;f.api.reconcileWorldRelationPair=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const task=f.check();await f.reopen();const status=f.el('world-links-status').textContent;hold.resolve(null);await task;
  assert.match(f.el('world-links-inspector').textContent!,/Ada/);assert.equal(f.el('world-links-status').textContent,status);assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,f.command.draftWriteId);assert.equal(f.calls.filter(c=>c.method==='discardWorldRelationPairDraft').length,0);
 }finally{f.cleanup();}
});

test('pair recovery retries a lost cleanup acknowledgement without executing another command',async()=>{
 const f=await fixture();try{
  const discard=f.api.discardWorldRelationPairDraft;let lost=true;f.api.discardWorldRelationPairDraft=async(...args:any[])=>{const result=await discard(...args);if(lost){lost=false;return{ok:false,error:'Bereinigungsantwort verloren'};}return result;};
  await f.check();assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source),null);assert.match(f.el('world-links-status').textContent!,/verloren/);
  await f.check();assert.match(f.el('world-links-status').textContent!,/gespeichert bestätigt/);assert.equal(f.calls.filter(c=>c.method==='discardWorldRelationPairDraft').length,1);assert.equal(f.calls.filter(c=>c.method==='executeWorldRelationPair').length,0);assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);
 }finally{f.cleanup();}
});

test('pair recovery keeps later source prose when its receipt reports a changed target',async()=>{
 const f=await fixture();try{
  const note=f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note;
  f.store.changePreparation({commandId:'later-source',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'note',expectedRevision:note.revision,note:{...note,gmNotes:'Spätere Quelle\r\n  bleibt'}}});
  await f.check();assert.match(f.el('world-links-inspector').textContent!,/Spätere Quelle/);assert.equal(f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note.gmNotes,'Spätere Quelle\r\n  bleibt');assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);
 }finally{f.cleanup();}
});

test('pair recovery protects the form until its confirmed source refresh completes',async()=>{
 const f=await fixture();try{
  const started=deferred<void>(),hold=deferred<void>(),read=f.api.worldLinks;f.api.worldLinks=async(...args:any[])=>{const result=await read(...args);started.resolve();await hold.promise;return result;};
  const form=f.el('world-link-form'),task=f.check();await started.promise;assert.equal(form.inert,true);hold.resolve();await task;assert.equal(f.el('world-link-form').inert,false);assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source),null);
 }finally{f.cleanup();}
});

test('pair recovery cleanup rejects a draft replaced after the conditional read',async()=>{
 const f=await fixture();try{
  const started=deferred<void>(),hold=deferred<void>(),read=f.api.worldRelationPairDraft;f.api.worldRelationPairDraft=async(...args:any[])=>{const result=await read(...args);started.resolve();await hold.promise;return result;};
  const task=f.check();await started.promise;const command={...f.command,commandId:'racing-command',draftWriteId:'racing-draft',action:{...f.command.action,sourceRevision:2,targetRevision:2,forwardLabel:'beschützt',reverseLabel:'wird beschützt'}};
  f.store.keepWorldRelationPairDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,command},f.command.draftWriteId);hold.resolve();await task;
  assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,'racing-draft');assert.match(f.el('world-links-status').textContent!,/bereits geändert/);assert.equal(f.calls.filter(c=>c.method==='executeWorldRelationPair').length,0);
 }finally{f.cleanup();}
});

test('pair recovery shows a new draft arriving during the confirmed source refresh',async()=>{
 const f=await fixture();try{
  const read=f.api.worldLinks;let inserted=false;f.api.worldLinks=async(...args:any[])=>{const result=await read(...args);if(!inserted){inserted=true;const command={...f.command,commandId:'after-cleanup',draftWriteId:'after-cleanup-draft',action:{...f.command.action,sourceRevision:2,targetRevision:2,forwardLabel:'neu',reverseLabel:'neue Gegenrichtung'}};f.store.keepWorldRelationPairDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,command},null);}return result;};
  await f.check();assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,'after-cleanup-draft');assert.equal(f.el<HTMLInputElement>('world-link-label').value,'neu');assert.match(f.el('world-links-status').textContent!,/neuere Paarentwurf/);assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,false);
 }finally{f.cleanup();}
});

test('pair recovery keeps local edits beside a newer draft and can explicitly return to that saved draft',async()=>{
 const f=await fixture();try{
  const hold=deferred<any>(),original=f.api.reconcileWorldRelationPair;f.api.reconcileWorldRelationPair=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const task=f.check();f.input('world-link-label','lokaler neuer Text');const command={...f.command,commandId:'other-owner',draftWriteId:'other-draft',action:{...f.command.action,sourceRevision:2,targetRevision:2,forwardLabel:'gesicherter neuer Text',reverseLabel:'neue Rückrichtung'}};
  f.store.keepWorldRelationPairDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,command},f.command.draftWriteId);hold.resolve(null);await task;
  assert.equal(f.el<HTMLInputElement>('world-link-label').value,'lokaler neuer Text');assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Beziehung übernehmen')!.disabled,true);assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,'other-draft');
  await(f.workbench as any).discard();assert.equal(f.el<HTMLInputElement>('world-link-label').value,'gesicherter neuer Text');assert.equal(f.store.worldRelationPairDraft(f.workspace.token,f.source)?.writeId,'other-draft');assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,false);assert.equal(f.calls.filter(c=>c.method==='discardWorldRelationPairDraft').length,0);
 }finally{f.cleanup();}
});

for(const mode of ['single','history'] as const)test(`${mode} recovery ignores a late receipt after reopening with the same activation`,async()=>{
 const f=await fixture(false,mode);try{
  await f.begin();const method=mode==='single'?'reconcilePreparationContent':'reconcileWorldRelationPairHistory',hold=deferred<void>(),original=f.api[method];f.api[method]=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const token=f.workspace.token,task=f.check();await f.reopen(false);assert.equal(f.workspace.token,token);f.input('world-link-label','Neuer Dialogtext');const status=f.el('world-links-status').textContent;hold.resolve();await task;
  assert.equal(f.el('world-links-status').textContent,status);assert.equal(f.el<HTMLInputElement>('world-link-label').value,'Neuer Dialogtext');
 }finally{f.cleanup();}
});

for(const mode of ['single','history'] as const)test(`${mode} recovery preserves newer relationship input without another content command`,async()=>{
 const f=await fixture(false,mode);try{
  await f.begin();const before=f.store.preparation(f.workspace.token,'').notes,writes=f.calls.filter(c=>['changePreparationContent','executeWorldRelationPairHistory'].includes(c.method)).length,method=mode==='single'?'reconcilePreparationContent':'reconcileWorldRelationPairHistory',hold=deferred<void>(),original=f.api[method];f.api[method]=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};
  const task=f.check();f.input('world-link-label','nächste Beziehung');hold.resolve();await task;assert.equal(f.el<HTMLInputElement>('world-link-label').value,'nächste Beziehung');assert.deepEqual(f.store.preparation(f.workspace.token,'').notes,before);assert.equal(f.calls.filter(c=>['changePreparationContent','executeWorldRelationPairHistory'].includes(c.method)).length,writes);assert.match(f.el('world-links-status').textContent!,/neuere Eingaben/i);
 }finally{f.cleanup();}
});

test('single recovery clears exactly its retained applied preparation draft',async()=>{
 const f=await fixture(false,'single');try{
  const command=await f.begin();f.store.keepDeskDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,change:command.change,failedCommand:command},null);await f.reopen(false);await f.check();assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source),null);assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,true);
 }finally{f.cleanup();}
});

test('single recovery preserves a newer editor draft and identifies the open work',async()=>{
 const f=await fixture(false,'single');try{
  await f.begin();const current=f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note;f.store.keepDeskDraft(f.workspace.token,{version:1,writeId:'other-editor',change:{kind:'note',expectedRevision:current.revision,note:{...current,gmNotes:'  Neuere Rohnotiz\r\n'}},failedCommand:null},null);await f.check();assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source)?.writeId,'other-editor');assert.match(f.el('world-links-status').textContent!,/Entwurf/);
 }finally{f.cleanup();}
});

for(const mode of ['single','history'] as const)test(`${mode} recovery leaves a not-applied action ready for explicit confirmation`,async()=>{
 const f=await fixture(false,mode);try{
  await f.begin(false);const before=f.store.preparation(f.workspace.token,'').notes;await f.check();assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Auftrag prüfen')!.hidden,true);assert.deepEqual(f.store.preparation(f.workspace.token,'').notes,before);assert.match(f.el('world-links-status').textContent!,/nicht gespeichert/);
  if(mode==='single')assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Beziehung übernehmen')!.disabled,false);
 }finally{f.cleanup();}
});

for(const newer of [false,true])test(`single recovery confirms a newly created note while ${newer?'keeping the next name':'clearing only its submitted name'}`,async()=>{
 const f=await fixture(false,'single');try{
  const title=f.el<HTMLInputElement>('world-links-new-title');title.value='Cora';const original=f.api.changePreparationContent;f.api.changePreparationContent=async(...args:any[])=>{await original(...args);return{ok:false,error:'Anlageantwort verloren'};};await f.click('Inhalt anlegen','create');if(newer)title.value='Dana';await f.check();assert.equal(title.value,newer?'Dana':'');assert.match(f.el('world-links-inspector').textContent!,/Cora/);assert.equal(f.store.preparation(f.workspace.token,'').notes.filter(row=>row.note.title==='Cora').length,1);assert.equal(f.calls.filter(c=>c.method==='changePreparationContent').length,1);
 }finally{f.cleanup();}
});

test('single recovery retries a lost draft cleanup answer without rewriting the note',async()=>{
 const f=await fixture(false,'single');try{
  const command=await f.begin();f.store.keepDeskDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,change:command.change,failedCommand:command},null);await f.reopen(false);const discard=f.api.discardPreparationDraft;let lost=true;f.api.discardPreparationDraft=async(...args:any[])=>{const result=await discard(...args);if(lost){lost=false;return{ok:false,error:'Notizbereinigungsantwort verloren'};}return result;};await f.check();assert.match(f.el('world-links-status').textContent!,/verloren/);await f.check();assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source),null);assert.match(f.el('world-links-status').textContent!,/gespeichert bestätigt/);assert.equal(f.calls.filter(c=>c.method==='changePreparationContent').length,1);
 }finally{f.cleanup();}
});

test('single recovery can discard local changes without consuming a newer editor draft',async()=>{
 const f=await fixture(false,'single');try{
  await f.begin();const hold=deferred<void>(),original=f.api.reconcilePreparationContent;f.api.reconcilePreparationContent=async(...args:any[])=>{const result=await original(...args);await hold.promise;return result;};const task=f.check();f.input('world-link-label','Lokale weitere Beziehung');const current=f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note;f.store.keepDeskDraft(f.workspace.token,{version:1,writeId:'new-editor-draft',change:{kind:'note',expectedRevision:current.revision,note:{...current,gmNotes:'  Wertvoller Rohtext\r\n'}},failedCommand:null},null);hold.resolve();await task;
  assert.equal(f.el<HTMLInputElement>('world-link-label').value,'Lokale weitere Beziehung');assert.equal([...f.dialog.querySelectorAll('button')].find(b=>b.textContent==='Beziehung übernehmen')!.disabled,true);await f.click('Eingabe verwerfen','discard');assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source)?.writeId,'new-editor-draft');assert.equal(f.calls.filter(c=>c.method==='discardPreparationDraft').length,0);assert.match(f.el('world-links-status').textContent!,/Notizentwurf/);
 }finally{f.cleanup();}
});

test('history recovery cannot use its applied receipt to consume a different pending note command',async()=>{
 const f=await fixture(false,'history');try{
  await f.begin();const note=f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note,command={commandId:'different-pending-note',campaignId:f.campaign.id,token:f.workspace.token,draftWriteId:'world-links-different-note',change:{kind:'note' as const,expectedRevision:note.revision,note:{...note,gmNotes:'Unbestätigte andere Notiz'}}};
  f.store.keepDeskDraft(f.workspace.token,{version:1,writeId:command.draftWriteId,change:command.change,failedCommand:command},null);
  // Model two retained UI uncertainties; both commands have real Store identities.
  (f.workbench as any).uncertain=command;
  await f.check();assert.equal(f.calls.filter(c=>c.method==='reconcilePreparationContent').length,0);assert.equal(f.calls.filter(c=>c.method==='discardPreparationDraft').length,0);assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source)?.writeId,command.draftWriteId);assert.equal(f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note.gmNotes,note.gmNotes);
 }finally{f.cleanup();}
});

async function choosePair(f:Awaited<ReturnType<typeof fixture>>,name='Bert'){
 const paired=f.el<HTMLInputElement>('world-link-paired');paired.checked=true;paired.dispatchEvent(new Event('change',{bubbles:true}));
 f.input('world-link-target-search',name);for(let i=0;i<30&&![...f.el('world-link-targets').querySelectorAll('button')].some(button=>button.textContent?.startsWith(name+' ·'));i++)await new Promise(resolve=>setImmediate(resolve));
 const control=[...f.el('world-link-targets').querySelectorAll('button')].find(button=>button.textContent?.startsWith(name+' ·'));assert.ok(control);control.click();f.input('world-link-label','kennt');f.input('world-link-reverse-label','kennt Ada');
}
for(const change of ['label','target','reopen'] as const)test(`pair preflight rejects a changed ${change} before creating any command`,async()=>{
 const f=await fixture(false,'single');try{
  await choosePair(f);const started=deferred<void>(),hold=deferred<void>(),read=f.api.deskContent;
  f.api.deskContent=async(...args:any[])=>{const result=await read(...args);if(args[1].id===f.target){started.resolve();await hold.promise;}return result;};
  const task=f.click('Beziehung übernehmen','add');await started.promise;
  if(change==='label')f.input('world-link-label','neue Absicht');
  if(change==='target')await choosePair(f,'Ada');
  if(change==='reopen')await f.reopen(false);
  const status=f.el('world-links-status').textContent;hold.resolve();await task;
  assert.equal(f.calls.filter(call=>call.method==='keepWorldRelationPairDraft').length,0);assert.equal(f.calls.filter(call=>call.method==='executeWorldRelationPair').length,0);
  assert.equal(f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note.revision,1);
  if(change==='label')assert.equal(f.el<HTMLInputElement>('world-link-label').value,'neue Absicht');
  if(change==='reopen')assert.equal(f.el('world-links-status').textContent,status);
 }finally{f.cleanup();}
});
test('pair preflight cannot remove a pair after the source was reopened with the same token',async()=>{
 const f=await fixture(false,'history');try{
  const started=deferred<void>(),hold=deferred<void>(),read=f.api.deskContent;f.api.deskContent=async(...args:any[])=>{const result=await read(...args);if(args[1].id===f.target){started.resolve();await hold.promise;}return result;};
  const task=f.click('Paar lösen:','removePair');await started.promise;await f.reopen(false);const status=f.el('world-links-status').textContent;hold.resolve();await task;
  assert.equal(f.calls.filter(call=>call.method==='executeWorldRelationPair').length,0);assert.equal(f.calls.filter(call=>call.method==='keepWorldRelationPairDraft').length,0);assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);assert.equal(f.el('world-links-status').textContent,status);
 }finally{f.cleanup();}
});

for(const mode of ['pair','single','history'] as const)for(const phase of ['draft','success','failure'] as const){
 if(mode==='history'&&phase==='draft')continue;
 test(`${mode} writer ignores a late ${phase} response after same-token reopening`,async()=>{
  const f=await fixture(false,mode==='history'?'history':'single');try{
   if(mode!=='history'){await choosePair(f);if(mode==='single'){const paired=f.el<HTMLInputElement>('world-link-paired');paired.checked=false;paired.dispatchEvent(new Event('change',{bubbles:true}));}}
   const method=mode==='history'?'executeWorldRelationPairHistory':mode==='pair'?(phase==='draft'?'keepWorldRelationPairDraft':'executeWorldRelationPair'):(phase==='draft'?'keepDeskDraft':'changePreparationContent');
   const started=deferred<void>(),hold=deferred<void>(),original=f.api[method];f.api[method]=async(...args:any[])=>{const result=await original(...args);started.resolve();await hold.promise;return phase==='failure'?{ok:false,error:'Späte alte Antwort'}:result;};
   const task=f.click(mode==='history'?'Rückgängig ·':'Beziehung übernehmen',mode==='history'?'changeHistory':'add');await started.promise;await f.reopen(false);
   const status=f.el('world-links-status').textContent,label=f.el<HTMLInputElement>('world-link-label').value,writeId=(f.workbench as any).writeId,pairWriteId=(f.workbench as any).pairWriteId;
   hold.resolve();await task;
   assert.equal(f.el('world-links-status').textContent,status);assert.equal(f.el<HTMLInputElement>('world-link-label').value,label);assert.equal((f.workbench as any).writeId,writeId);assert.equal((f.workbench as any).pairWriteId,pairWriteId);assert.equal(f.el('world-link-form').inert,false);
   if(phase==='draft'){
    assert.equal(f.calls.filter(call=>call.method===(mode==='pair'?'executeWorldRelationPair':'changePreparationContent')).length,0);
    if(mode==='single')assert.equal(f.store.preparation(f.workspace.token,'').notes.find(row=>row.note.id===f.source)!.note.revision,1);
   }
  }finally{f.cleanup();}
 });
}
test('pair preflight keeps a successful form usable and prevents repeated preflight reads',async()=>{
 const f=await fixture(false,'single');try{
  await choosePair(f);const started=deferred<void>(),hold=deferred<void>(),read=f.api.deskContent;
  f.api.deskContent=async(...args:any[])=>{const result=await read(...args);if(args[1].id===f.target){started.resolve();await hold.promise;}return result;};
  const first=f.click('Beziehung übernehmen','add');await started.promise;await f.click('Beziehung übernehmen','add');assert.equal(f.el('world-link-form').inert,true);hold.resolve();await first;
  assert.equal(f.calls.filter(call=>call.method==='executeWorldRelationPair').length,1);assert.equal(f.calls.filter(call=>call.method==='deskContent'&&call.args[1].id===f.target).length,1);assert.equal(f.el('world-link-form').inert,false);assert.equal(f.store.worldRelationPairHistory(f.workspace.token).cursor,1);
 }finally{f.cleanup();}
});

test('single writer serializes repeated explicit confirmation while its draft is pending',async()=>{
 const f=await fixture(false,'single');try{
  await choosePair(f);const paired=f.el<HTMLInputElement>('world-link-paired');paired.checked=false;paired.dispatchEvent(new Event('change',{bubbles:true}));
  const started=deferred<void>(),hold=deferred<void>(),keep=f.api.keepDeskDraft;f.api.keepDeskDraft=async(...args:any[])=>{const result=await keep(...args);started.resolve();await hold.promise;return result;};
  const first=f.click('Beziehung übernehmen','add');await started.promise;const second=f.click('Beziehung übernehmen','add');hold.resolve();await Promise.all([first,second]);
  assert.equal(f.calls.filter(call=>call.method==='changePreparationContent').length,1);assert.equal(f.el('world-link-form').inert,false);assert.match(f.el('world-links-status').textContent!,/Beziehung gespeichert/);assert.equal(f.calls.filter(call=>call.method==='keepDeskDraft').length,2);assert.equal(f.store.preparationDraft(f.workspace.token,'note',f.source),null);
 }finally{f.cleanup();}
});
for(const mode of ['pair','single','history'] as const)test(`${mode} writer keeps newer input while acknowledging the originally submitted action`,async()=>{
 const f=await fixture(false,mode==='history'?'history':'single');try{
  if(mode!=='history'){await choosePair(f);if(mode==='single'){const paired=f.el<HTMLInputElement>('world-link-paired');paired.checked=false;paired.dispatchEvent(new Event('change',{bubbles:true}));}}
  const method=mode==='pair'?'executeWorldRelationPair':mode==='history'?'executeWorldRelationPairHistory':'changePreparationContent',started=deferred<void>(),hold=deferred<void>(),write=f.api[method];f.api[method]=async(...args:any[])=>{const result=await write(...args);started.resolve();await hold.promise;return result;};
  const task=f.click(mode==='history'?'Rückgängig ·':'Beziehung übernehmen',mode==='history'?'changeHistory':'add');await started.promise;f.input('world-link-label','nächster Auftrag');hold.resolve();await task;
  assert.equal(f.el<HTMLInputElement>('world-link-label').value,'nächster Auftrag');assert.match(f.el('world-links-status').textContent!,/neuere Eingaben/);assert.equal(f.el('world-link-form').inert,false);assert.equal(f.calls.filter(call=>call.method===method).length,1);
 }finally{f.cleanup();}
});
test('new content success preserves the next name entered while awaiting its acknowledgement',async()=>{
 const f=await fixture(false,'single');try{
  f.input('world-links-new-title','Gesendeter Name');const started=deferred<void>(),hold=deferred<void>(),write=f.api.changePreparationContent;f.api.changePreparationContent=async(...args:any[])=>{const result=await write(...args);started.resolve();await hold.promise;return result;};
  const task=f.click('Inhalt anlegen','create');await started.promise;f.input('world-links-new-title','Nächster Name');hold.resolve();await task;
  assert.equal(f.el<HTMLInputElement>('world-links-new-title').value,'Nächster Name');assert.ok(f.store.preparation(f.workspace.token,'').notes.some(row=>row.note.title==='Gesendeter Name'));assert.equal(f.el('world-link-form').inert,false);
 }finally{f.cleanup();}
});

for(const mode of ['pair','single','history'] as const)test(`${mode} writer finally cannot unlock a newer pending relationship writer`,async()=>{
 const f=await fixture(false,mode==='history'?'history':'single');try{
  if(mode!=='history'){await choosePair(f);if(mode==='single'){const paired=f.el<HTMLInputElement>('world-link-paired');paired.checked=false;paired.dispatchEvent(new Event('change',{bubbles:true}));}}
  const method=mode==='pair'?'executeWorldRelationPair':mode==='history'?'executeWorldRelationPairHistory':'changePreparationContent',started=deferred<void>(),hold=deferred<void>(),write=f.api[method];f.api[method]=async(...args:any[])=>{const result=await write(...args);started.resolve();await hold.promise;return result;};
  const first=f.click(mode==='history'?'Rückgängig ·':'Beziehung übernehmen',mode==='history'?'changeHistory':'add');await started.promise;await f.reopen(false);f.api[method]=write;
  await choosePair(f);f.input('world-link-label','beschützt');f.input('world-link-reverse-label','wird beschützt');
  const secondStarted=deferred<void>(),secondHold=deferred<void>(),pairWrite=f.api.executeWorldRelationPair;f.api.executeWorldRelationPair=async(...args:any[])=>{const result=await pairWrite(...args);secondStarted.resolve();await secondHold.promise;return result;};
  const second=f.click('Beziehung übernehmen','add');await secondStarted.promise;const status=f.el('world-links-status').textContent;hold.resolve();await first;
  assert.equal(f.el('world-link-form').inert,true);assert.equal((f.workbench as any).busy,true);assert.equal(f.el('world-links-status').textContent,status);assert.equal(f.el<HTMLInputElement>('world-link-label').value,'beschützt');
  secondHold.resolve();await second;assert.equal(f.el('world-link-form').inert,false);assert.equal((f.workbench as any).busy,false);assert.match(f.el('world-links-status').textContent!,/beiden Richtungen gespeichert/);
 }finally{f.cleanup();}
});
