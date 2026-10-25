import assert from 'node:assert/strict';
import test,{type TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {referenceMarkdown,textReferences} from '../../../src/app/campaign/text-references';
import {searchCreatures} from '../../../src/app/storage/encounters';
import {CampaignStore} from '../../../src/app/storage/store';
import {WorldLinksWorkbench} from '../../../src/app/campaign/world-links-ui';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import type {WorldLinkRef} from '../../../src/app/campaign/world-links-contracts';
const settle=async()=>{for(let i=0;i<12;i++)await new Promise<void>(r=>setImmediate(r));};
async function fixture(t:TestContext){
 const root=mkdtempSync(join(tmpdir(),'world-links-')),store=new CampaignStore(join(root,'db.sqlite')),campaign=store.create('Verbindungen'),workspace=store.activate(campaign.id),ada=campaignLocalId(randomUUID()),borin=campaignLocalId(randomUUID());
 const command=(id:string,title:string,relations:{targetId:ReturnType<typeof campaignLocalId>;label:string}[]=[])=>store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:campaignLocalId(id),revision:1,kind:'npc',title,readAloud:'  '+title+' spricht\r\n',gmNotes:'GM privat',relations,creatureId:null,deleted:false}}});
 command(borin,'Borin');command(ada,'Ada',[{targetId:borin,label:'kennt'}]);
 const {document,window}=parseHTML('<html><body></body></html>'),prior={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};
 function Option(text='',value=''){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}
 window.HTMLSelectElement.prototype.add=function(o:HTMLOptionElement){this.append(o);};const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);},configurable:true});Object.assign(globalThis,{document,window,Option});
 const wrap=(f:()=>any)=>{try{return{ok:true,value:f()};}catch(e){return{ok:false,error:(e as Error).message};}};
 window.campaign={worldLinks:async(token,q)=>wrap(()=>store.worldLinks(token,q)),deskContent:async(token,ref)=>wrap(()=>store.deskContent(token,ref)),searchDesk:async(token,scope,text,offset)=>wrap(()=>store.searchDesk(token,scope,text,offset)),preparationDraft:async(token,kind,id)=>wrap(()=>store.preparationDraft(token,kind,id)),worldRelationPairDraft:async(token,id)=>wrap(()=>store.worldRelationPairDraft(token,id)),worldRelationPairHistory:async token=>wrap(()=>store.worldRelationPairHistory(token))} as typeof window.campaign;
 const x={owner:workspace as typeof workspace|null,drain:async()=>true,sourceDrain:async()=>{},edits:[] as WorldLinkRef[],messages:[] as string[]};
 const ui=new WorldLinksWorkbench(()=>x.owner,()=>x.drain(),s=>x.messages.push(s),async(ref,current=()=>true)=>{await x.sourceDrain();if(current())x.edits.push(ref);}),dialog=document.getElementById('world-links') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=(id:string)=>document.getElementById('world-links-'+id)!,button=(text:string)=>[...dialog.querySelectorAll('button')].find(b=>b.textContent===text)!;
 t.after(()=>{ui.reset();Object.assign(globalThis,prior);store.close();rmSync(root,{recursive:true,force:true});});
 await ui.open();return{root,store,workspace,ada,borin,command,document,window,x,ui,dialog,el,button};
}
test('connection exploration shows authored prose and delegates all edits without database writes',async t=>{
 const f=await fixture(t),db=(f.store as unknown as {db:any}).db,before=db.serialize();assert.equal(f.el('inspector').querySelector('pre')?.textContent,'  Ada spricht\r\n');
 const old=f.button('Quelle und Beziehungen bearbeiten…'),oldNode=f.el('map').querySelector('[data-world-link-node]')!;f.el('list').querySelector<HTMLButtonElement>(`[data-world-ref="note:${f.borin}"]`)!.click();await settle();assert.match(f.el('inspector').textContent!,/^Borin/);
 old.onclick?.(new f.window.Event('click') as any);oldNode.dispatchEvent(new f.window.Event('click'));await settle();assert.equal(f.el('inspector').querySelector('h3')?.textContent,'Borin');assert.deepEqual(f.x.edits,[]);
 f.button('Quelle und Beziehungen bearbeiten…').click();await settle();assert.deepEqual(f.x.edits,[{kind:'note',id:f.borin}]);assert.ok(db.serialize().equals(before));assert.equal(f.dialog.open,false);
});
test('an older connection read cannot repopulate a newer empty search',async t=>{
 const f=await fixture(t),read=f.window.campaign.deskContent;let release!:()=>void;
 f.window.campaign.deskContent=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};
 f.el('list').querySelector<HTMLButtonElement>(`[data-world-ref="note:${f.borin}"]`)!.click();await settle();assert.ok(release);
 (f.el('search') as HTMLInputElement).value='kein Treffer';f.el('search').dispatchEvent(new f.window.Event('change'));await settle();release();await settle();assert.match(f.el('inspector').textContent!,/gesucht/);await new Promise(r=>setTimeout(r,230));
 assert.match(f.el('inspector').textContent!,/Keine Inhalte/);assert.ok(!f.el('inspector').querySelector('button'));assert.ok(!f.el('map').querySelector('[data-world-link-node]'));
});
test('reset cancels an opening still waiting for pending source edits',async t=>{
 const f=await fixture(t);f.ui.reset();let release!:(value:boolean)=>void;f.x.drain=()=>new Promise(r=>release=r);const opening=f.ui.open();await settle();f.ui.reset();release(true);await opening;assert.equal(f.dialog.open,false);
});
test('missing relationship targets remain inspectable as unavailable nodes',async t=>{
 const f=await fixture(t),missing=randomUUID(),page=f.store.worldLinks(f.workspace.token,{text:'',kind:'all',offset:0,focus:{kind:'note',id:missing}});
 assert.equal(page.focus?.available,false);assert.equal(page.focus?.ref.id,missing);assert.equal(page.focus?.title,'Nicht verfügbar');
});

test('catalogue links use the existing creature reader and source editor without product writes',async t=>{
 const f=await fixture(t),creature=searchCreatures({text:'Goblin',offset:0,limit:1}).rows[0]!;
 const note=f.store.preparation(f.workspace.token).notes.find(r=>r.note.id===f.ada)!.note;
 f.store.changePreparation({commandId:randomUUID(),campaignId:f.workspace.campaign.id,token:f.workspace.token,change:{kind:'note',expectedRevision:note.revision,note:{...note,creatureId:creature.id}}});
 const page=f.store.worldLinks(f.workspace.token,{text:'',kind:'world',offset:0,focus:{kind:'note',id:f.ada}});
 assert.ok(page.edges.some(e=>e.target.kind==='creature'&&e.target.id===creature.id&&e.label==='verwendet Statblock'));
 f.ui.reset();const db=(f.store as unknown as {db:any}).db,before=db.serialize();await f.ui.open({kind:'creature',id:creature.id});
 assert.equal(f.el('inspector').querySelector('h3')?.textContent,creature.name);assert.ok(f.button('Referenz lesen…'));
 f.button('Quelle bearbeiten…').click();await settle();assert.deepEqual(f.x.edits,[{kind:'creature',id:creature.id}]);assert.ok(db.serialize().equals(before));
});

for(const change of ['reopen','campaign'] as const)test('a pending connection handoff is cancelled by '+change,async t=>{
 const f=await fixture(t);let release!:()=>void;f.x.sourceDrain=()=>new Promise<void>(r=>release=r);
 f.button('Quelle und Beziehungen bearbeiten…').click();await settle();assert.ok(release);
 if(change==='reopen')await f.ui.open({kind:'note',id:f.borin});else{f.x.owner=null;f.ui.contextChanged();}
 release();await settle();assert.deepEqual(f.x.edits,[]);
 if(change==='reopen')assert.equal(f.el('inspector').querySelector('h3')?.textContent,'Borin');
});

test('typing a new connection search immediately clears old actions and invalidates them',async t=>{
 const f=await fixture(t),old=f.button('Quelle und Beziehungen bearbeiten…'),read=f.window.campaign.worldLinks;let release!:()=>void;
 f.window.campaign.worldLinks=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};
 (f.el('search') as HTMLInputElement).value='kein Treffer';f.el('search').dispatchEvent(new f.window.Event('input'));
 assert.equal(f.el('list').textContent,'');assert.match(f.el('inspector').textContent!,/gesucht/);old.onclick?.(new f.window.Event('click') as any);assert.deepEqual(f.x.edits,[]);
 await new Promise(r=>setTimeout(r,230));release();await settle();assert.match(f.el('inspector').textContent!,/Keine Inhalte/);
 for(const id of ['search','kind'])assert.ok(f.el(id).parentElement?.tagName==='LABEL');
});

test('text aliases keep their graph target and authored bytes across an independent campaign copy',async t=>{
 const f=await fixture(t),note=f.store.preparation(f.workspace.token).notes.find(r=>r.note.id===f.ada)!.note,prose='  '+referenceMarkdown({kind:'note',id:f.borin},'Wächter')+'\r\n',updated={...note,gmNotes:prose};
 f.store.changePreparation({commandId:randomUUID(),campaignId:f.workspace.campaign.id,token:f.workspace.token,change:{kind:'note',expectedRevision:note.revision,note:updated}});
 const page=f.store.worldLinks(f.workspace.token,{text:'Wächter',kind:'reference',offset:0,focus:null});assert.equal(page.matches[0]?.ref.id,f.borin);assert.equal(page.matches[0]?.alias,'Wächter');
 await f.ui.open({kind:'note',id:f.ada});await settle();assert.ok(f.el('inspector').textContent?.includes('Wächter'));assert.ok(!f.el('inspector').querySelector('pre:last-of-type')?.textContent?.includes('dungeon-ref:'));
 assert.equal(f.store.preparation(f.workspace.token).notes.find(r=>r.note.id===f.ada)!.note.gmNotes,prose);
 const snapshot=join(f.root,'snapshot.sqlite');await f.store.campaignSnapshot(f.workspace.token,snapshot);const copyStore=new CampaignStore(join(f.root,'copy.sqlite'));
 try{const copy=copyStore.acceptCampaignSnapshot(snapshot,'Kopie',{}),w=copyStore.activate(copy.id),notes=copyStore.preparation(w.token).notes,a=notes.find(r=>r.note.title==='Ada')!.note,b=notes.find(r=>r.note.title==='Borin')!.note;
 assert.notEqual(b.id,f.borin);assert.equal(textReferences(a.gmNotes)[0]?.ref.id,b.id);assert.equal(a.gmNotes,'  '+referenceMarkdown({kind:'note',id:b.id},'Wächter')+'\r\n');
 }finally{copyStore.close();}
});
