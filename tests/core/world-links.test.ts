import assert from 'node:assert/strict';
import test,{type TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {CampaignStore} from '../../src/app/storage/store';
import {WorldLinksWorkbench} from '../../src/app/world-links-ui';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';
import type {WorldLinkRef} from '../../src/app/world-links-contracts';
const settle=async()=>{for(let i=0;i<12;i++)await new Promise<void>(r=>setImmediate(r));};
async function fixture(t:TestContext){
 const root=mkdtempSync(join(tmpdir(),'world-links-')),store=new CampaignStore(join(root,'db.sqlite')),campaign=store.create('Verbindungen'),workspace=store.activate(campaign.id),ada=campaignLocalId(randomUUID()),borin=campaignLocalId(randomUUID());
 const command=(id:string,title:string,relations:{targetId:ReturnType<typeof campaignLocalId>;label:string}[]=[])=>store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:campaignLocalId(id),revision:1,kind:'npc',title,readAloud:'  '+title+' spricht\r\n',gmNotes:'GM privat',relations,creatureId:null,deleted:false}}});
 command(borin,'Borin');command(ada,'Ada',[{targetId:borin,label:'kennt'}]);
 const {document,window}=parseHTML('<html><body></body></html>'),prior={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};
 function Option(text='',value=''){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}
 window.HTMLSelectElement.prototype.add=function(o:HTMLOptionElement){this.append(o);};const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);},configurable:true});Object.assign(globalThis,{document,window,Option});
 const wrap=(f:()=>any)=>{try{return{ok:true,value:f()};}catch(e){return{ok:false,error:(e as Error).message};}};
 window.campaign={worldLinks:async(token,q)=>wrap(()=>store.worldLinks(token,q)),deskContent:async(token,ref)=>wrap(()=>store.deskContent(token,ref))} as typeof window.campaign;
 const x={owner:workspace as typeof workspace|null,drain:async()=>true,edits:[] as WorldLinkRef[],messages:[] as string[]};
 const ui=new WorldLinksWorkbench(()=>x.owner,()=>x.drain(),s=>x.messages.push(s),async ref=>{x.edits.push(ref);}),dialog=document.getElementById('world-links') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=(id:string)=>document.getElementById('world-links-'+id)!,button=(text:string)=>[...dialog.querySelectorAll('button')].find(b=>b.textContent===text)!;
 t.after(()=>{ui.reset();Object.assign(globalThis,prior);store.close();rmSync(root,{recursive:true,force:true});});
 await ui.open();return{root,store,workspace,ada,borin,command,document,window,x,ui,dialog,el,button};
}
test('connection exploration shows authored prose and delegates all edits without database writes',async t=>{
 const f=await fixture(t),db=(f.store as unknown as {db:any}).db,before=db.serialize();assert.equal(f.el('inspector').querySelector('pre')?.textContent,'  Ada spricht\r\n');
 const old=f.button('Quelle und Beziehungen bearbeiten…'),oldNode=f.el('map').querySelector('[data-world-link-node]')!;f.el('list').querySelector<HTMLButtonElement>(`[data-world-ref="note:${f.borin}"]`)!.click();await settle();assert.equal(f.el('inspector').querySelector('h3')?.textContent,'Borin');
 old.onclick?.(new f.window.Event('click') as any);oldNode.dispatchEvent(new f.window.Event('click'));await settle();assert.equal(f.el('inspector').querySelector('h3')?.textContent,'Borin');assert.deepEqual(f.x.edits,[]);
 f.button('Quelle und Beziehungen bearbeiten…').click();await settle();assert.deepEqual(f.x.edits,[{kind:'note',id:f.borin}]);assert.ok(db.serialize().equals(before));assert.equal(f.dialog.open,false);
});
test('an older connection read cannot repopulate a newer empty search',async t=>{
 const f=await fixture(t),read=f.window.campaign.deskContent;let release!:()=>void;
 f.window.campaign.deskContent=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};
 f.el('list').querySelector<HTMLButtonElement>(`[data-world-ref="note:${f.borin}"]`)!.click();await settle();assert.ok(release);
 (f.el('search') as HTMLInputElement).value='kein Treffer';f.el('search').dispatchEvent(new f.window.Event('change'));await settle();release();await settle();
 assert.match(f.el('inspector').textContent!,/Keine Inhalte/);assert.ok(!f.el('inspector').querySelector('button'));assert.ok(!f.el('map').querySelector('[data-world-link-node]'));
});
test('reset cancels an opening still waiting for pending source edits',async t=>{
 const f=await fixture(t);f.ui.reset();let release!:(value:boolean)=>void;f.x.drain=()=>new Promise(r=>release=r);const opening=f.ui.open();await settle();f.ui.reset();release(true);await opening;assert.equal(f.dialog.open,false);
});
test('missing relationship targets remain inspectable as unavailable nodes',async t=>{
 const f=await fixture(t),missing=randomUUID(),page=f.store.worldLinks(f.workspace.token,{text:'',kind:'all',offset:0,focus:{kind:'note',id:missing}});
 assert.equal(page.focus?.available,false);assert.equal(page.focus?.ref.id,missing);assert.equal(page.focus?.title,'Nicht verfügbar');
});
