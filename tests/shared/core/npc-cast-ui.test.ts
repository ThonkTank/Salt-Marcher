import assert from 'node:assert/strict';
import test,{type TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {CampaignStore} from '../../../src/app/storage/store';
import {NpcCastBinder} from '../../../src/app/campaign/npc-cast-ui';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
const tick=()=>new Promise<void>(r=>setImmediate(r));
async function until(check:()=>boolean){for(let i=0;i<40;i++){if(check())return;await tick();}assert.ok(check(),'expected NPC dossier state');}
async function fixture(t:TestContext){
 const root=mkdtempSync(join(tmpdir(),'npc-cast-')),store=new CampaignStore(join(root,'db.sqlite')),campaign=store.create('Gespräche'),workspace=store.activate(campaign.id);
 const scene=store.executeLive({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
 const ids={ada:campaignLocalId(randomUUID()),borin:campaignLocalId(randomUUID())};t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});
 for(const [id,title]of [[ids.ada,'Ada'],[ids.borin,'Borin']] as const)store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:id!,revision:1,kind:'npc',title:title!,readAloud:'  '+title+' spricht\r\n',gmNotes:'Privat',relations:[],creatureId:null,deleted:false}}});
 const {document,window}=parseHTML('<html><body></body></html>'),prior={document:globalThis.document,window:globalThis.window,Option:globalThis.Option};
 function Option(text='',value=''){const o=document.createElement('option');o.textContent=text;o.value=value;return o;}
 window.HTMLSelectElement.prototype.add=function(o:HTMLOptionElement){this.append(o);};const values=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return values.get(this)??this.querySelector('option')?.value??'';},set(v:string){values.set(this,v);},configurable:true});Object.assign(globalThis,{document,window,Option});
 const wrap=(f:()=>any)=>{try{return{ok:true,value:f()};}catch(e){return{ok:false,error:(e as Error).message};}};
 window.campaign={npcCast:async(token,q)=>wrap(()=>store.npcCast(token,q)),npcDossier:async(token,id,npc)=>wrap(()=>store.npcDossier(token,id,npc))} as typeof window.campaign;
 const x={ids,store,workspace,scene,document,window,edits:[] as string[],messages:[] as string[],flush:async()=>true,edit:async(id:string)=>{x.edits.push(id);}};
 const binder=new NpcCastBinder(s=>x.messages.push(s),()=>({workspace,scene}),()=>x.flush(),async()=>{},async()=>{},id=>x.edit(id),async()=>{},async()=>{},async()=>{}),dialog=document.getElementById('npc-cast') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 const el=(id:string)=>document.getElementById('npc-cast-'+id)!,button=(text:string)=>[...dialog.querySelectorAll('button')].find(b=>b.textContent===text)!;
 const click=(text:string)=>{const b=button(text);assert.ok(b,text);b.onclick?.(new window.Event('click') as any);};
 t.after(()=>{binder.reset();Object.assign(globalThis,prior);});await binder.open();await until(()=>el('document').querySelector('h3')?.textContent==='Ada');return{...x,x,binder,dialog,el,button,click};
}
test('detached dossier actions cannot edit the newly selected NPC',async t=>{
 const f=await fixture(t),old=f.button('Profil bearbeiten…');assert.equal(f.el('search').parentElement?.tagName,'LABEL');assert.equal(f.el('scope').parentElement?.tagName,'LABEL');(f.el('list').querySelector(`[data-npc-id="${f.ids.borin}"]`) as HTMLButtonElement).click();await until(()=>f.el('document').querySelector('h3')?.textContent==='Borin');
 old.onclick?.(new f.window.Event('click') as any);for(let i=0;i<8;i++)await tick();assert.deepEqual(f.edits,[]);
 f.click('Profil bearbeiten…');await until(()=>f.edits.length===1);assert.deepEqual(f.edits,[f.ids.borin]);
});
test('reset cancels a dossier opening still awaiting the scene flush',async t=>{
 const f=await fixture(t);f.binder.reset();let release!:(value:boolean)=>void;f.x.flush=()=>new Promise(r=>release=r);const opening=f.binder.open();await until(()=>!!release);f.binder.reset();release(true);await opening;assert.equal(f.dialog.open,false);
});
test('a late action failure cannot report into a reopened dossier',async t=>{
 const f=await fixture(t);let reject!:(error:Error)=>void;f.x.edit=()=>new Promise((_r,j)=>reject=j);f.click('Profil bearbeiten…');await until(()=>!!reject);f.binder.reset();await f.binder.open();const status=f.el('status').textContent,count=f.messages.length;reject(new Error('Alter Gesprächsfehler'));for(let i=0;i<8;i++)await tick();assert.equal(f.el('status').textContent,status);assert.equal(f.messages.length,count);
});
test('a late dossier read cannot restore controls after a search found no NPCs',async t=>{
 const f=await fixture(t),read=f.window.campaign.npcDossier;let release!:()=>void;f.window.campaign.npcDossier=async(...args)=>{const result=await read(...args);return new Promise(r=>release=()=>r(result));};
 (f.el('list').querySelector(`[data-npc-id="${f.ids.borin}"]`) as HTMLButtonElement).click();await until(()=>!!release);(f.el('search') as HTMLInputElement).value='Kein Treffer';f.click('Stand aktualisieren');await until(()=>f.el('document').textContent?.includes('Keine NSCs')===true);release();for(let i=0;i<8;i++)await tick();assert.ok(!f.el('document').querySelector('button'));assert.match(f.el('document').textContent!,/Keine NSCs/);
});
test('changing search during an action cancels its handoff without leaving the dossier busy',async t=>{
 const f=await fixture(t);let release!:(value:boolean)=>void;f.x.flush=()=>new Promise(r=>release=r);f.click('Profil bearbeiten…');await until(()=>!!release);
 (f.el('search') as HTMLInputElement).value='Kein Treffer';f.el('search').dispatchEvent(new f.window.Event('input'));release(true);
 await until(()=>f.el('document').textContent?.includes('Keine NSCs')===true);assert.deepEqual(f.edits,[]);f.click('Schließen');assert.equal(f.dialog.open,false);
});
test('an old action completion cannot unlock a newer action after reopening',async t=>{
 const f=await fixture(t);let old!:(value:boolean)=>void,current!:(value:boolean)=>void;
 f.x.flush=()=>new Promise(r=>old=r);f.click('Profil bearbeiten…');await until(()=>!!old);f.binder.reset();f.x.flush=async()=>true;await f.binder.open();
 f.x.flush=()=>new Promise(r=>current=r);f.click('Profil bearbeiten…');await until(()=>!!current);old(true);for(let i=0;i<8;i++)await tick();f.click('Schließen');assert.equal(f.dialog.open,true);
 current(true);await until(()=>f.edits.length===1);assert.deepEqual(f.edits,[f.ids.ada]);
});
