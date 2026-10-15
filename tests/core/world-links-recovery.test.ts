import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
import {CampaignStore} from '../../src/app/storage/store';
import {WorldLinksWorkbench} from '../../src/app/world-links-ui';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(copy=false){
 const root=mkdtempSync(join(tmpdir(),'world-pair-recovery-'));let store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 let campaign=store.create('Beziehungsprüfung');let workspace=store.activate(campaign.id);
 let source=campaignLocalId('10000000-0000-4000-8000-000000000671'),target=campaignLocalId('10000000-0000-4000-8000-000000000672');
 for(const [id,title] of [[source,'Ada'],[target,'Bert']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'  Halt!\r\n',gmNotes:'Unveränderte Quelle',relations:[],creatureId:null,deleted:false}}});
 let command={commandId:'applied-pair',campaignId:campaign.id,token:workspace.token,draftWriteId:'world-links-pair-retained',action:{kind:'add' as const,sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'kennt',reverseLabel:'kennt Ada'}};
 store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId:command.draftWriteId,command},null);store.executeWorldRelationPair(command);store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId:command.draftWriteId,command},null);
 if(copy){const snapshot=join(root,'snapshot.sqlite');await store.campaignSnapshot(workspace.token,snapshot);const next=new CampaignStore(join(root,'copy.sqlite'),'test');campaign=next.acceptCampaignSnapshot(snapshot,'Unabhängige Kopie',{});store.close();store=next;workspace=store.activate(campaign.id);const notes=store.preparation(workspace.token,'').notes;source=notes.find(row=>row.note.title==='Ada')!.note.id;target=notes.find(row=>row.note.title==='Bert')!.note.id;command=store.worldRelationPairDraft(workspace.token,source)!.command as typeof command;}
 const {document,window}=parseHTML('<html><body></body></html>'),prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
 function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
 const calls:{method:string;args:any[]}[]=[],api:any={};
 for(const method of ['worldLinks','deskContent','searchDesk','preparationDraft','worldRelationPairDraft','worldRelationPairHistory','discardWorldRelationPairDraft','reconcileWorldRelationPair','executeWorldRelationPair'])api[method]=async(...args:any[])=>{calls.push({method,args});try{return{ok:true,value:(store as any)[method](...args)};}catch(error){return{ok:false,error:(error as Error).message};}};
 window.campaign=api;const workbench=new WorldLinksWorkbench(()=>workspace,async()=>true,()=>{},async()=>{}),dialog=document.getElementById('world-links') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 await workbench.open({kind:'note',id:source});
 return{store,campaign,source,target,command,workbench,dialog,el,api,calls,get workspace(){return workspace;},input(id:string,value:string){const input=el<HTMLInputElement>(id);input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));},async reopen(){workbench.reset();workspace=store.activate(campaign.id);await workbench.open({kind:'note',id:source});},async check(){await(workbench as any).reconcile();},cleanup(){workbench.reset();store.close();rmSync(root,{recursive:true,force:true});Object.assign(globalThis,prior);}};
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
