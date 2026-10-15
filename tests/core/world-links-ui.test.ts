import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {WorldLinksWorkbench} from '../../src/app/world-links-ui';
import type {WorldLinkNode,WorldLinksPage,WorldLinksQuery} from '../../src/app/world-links-contracts';

const wait=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

test('campaign connection search clears stale actions while the GM types',async()=>{
 const parsed=parseHTML('<html><body></body></html>'),{document,window}=parsed,prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
 function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};
 const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.value??'';},set(value:string){selectValues.set(this,value);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
 const ref={kind:'note' as const,id:'10000000-0000-4000-8000-000000000001'},entry:WorldLinkNode={ref,kind:'npc',title:'Hafenwache',revision:1,available:true},queries:WorldLinksQuery[]=[];
 const page=(query:WorldLinksQuery):WorldLinksPage=>query.text?{matches:[],next:null,nodes:query.focus?[entry]:[],edges:[],focus:query.focus?entry:null,hiddenLinks:0}:{matches:[entry],next:null,nodes:[entry],edges:[],focus:entry,hiddenLinks:0};
 const note={version:1,id:ref.id,revision:1,kind:'npc',title:'Hafenwache',readAloud:'Halt!',gmNotes:'Kennwort',relations:[],creatureId:null,deleted:false};
 window.campaign={worldLinks:async(_token:string,query:import('../../src/app/world-links-contracts').WorldLinksQuery)=>{queries.push(query);return{ok:true as const,value:page(query)};},deskContent:async()=>({ok:true as const,value:{ref,title:'Hafenwache',label:'NSC',revision:1,note}}),preparationDraft:async()=>({ok:true as const,value:null})} as unknown as typeof window.campaign;
 const workspace={token:'token',campaign:{id:'campaign'}} as any,workbench=new WorldLinksWorkbench(()=>workspace,async()=>true,()=>{},async()=>{}),dialog=document.getElementById('world-links') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 try{
  await workbench.open();assert.match(document.getElementById('world-links-inspector')!.textContent,/Hafenwache|Quelle bearbeiten/);
  const labels=(id:string)=>[...dialog.querySelectorAll('label')].filter(label=>label.querySelector('#'+id)).map(label=>label.childNodes[0]?.textContent?.trim());
  assert.deepEqual(labels('world-links-search'),['Suche']);assert.deepEqual(labels('world-links-kind'),['Inhalte']);assert.deepEqual(labels('world-links-new-kind'),['Art']);assert.deepEqual(labels('world-links-new-title'),['Name']);assert.deepEqual(labels('world-link-target-search'),['Beziehungsziel']);assert.deepEqual(labels('world-link-label'),['Bezeichnung']);
  const search=document.getElementById('world-links-search') as HTMLInputElement;search.value='kein Treffer';search.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(document.getElementById('world-links-list')!.textContent,'');assert.doesNotMatch(document.getElementById('world-links-inspector')!.textContent,/Hafenwache|Quelle bearbeiten/);assert.match(document.getElementById('world-links-inspector')!.textContent,/gesucht/);
  await wait(230);assert.equal(queries.at(-1)?.text,'kein Treffer');assert.equal(queries.at(-1)?.focus,null);assert.match(document.querySelector('.world-links-nav')!.textContent,/Keine Treffer/);assert.equal(document.getElementById('world-links-status')!.textContent,'Keine passenden Kampagneninhalte gefunden.');assert.doesNotMatch(document.getElementById('world-links-inspector')!.textContent,/Hafenwache|Quelle bearbeiten/);
 }finally{workbench.reset();Object.assign(globalThis,prior);}
});
