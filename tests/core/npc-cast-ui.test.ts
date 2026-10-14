import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {NpcCastBinder} from '../../src/app/npc-cast-ui';
import type {NpcCastPage,NpcCastQuery,NpcDossier} from '../../src/app/npc-cast-contracts';

const wait=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

test('changing the cast query immediately removes a dossier outside the new results',async()=>{
 const parsed=parseHTML('<html><body></body></html>'),{document,window}=parsed,prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
 function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};
 const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.value??'';},set(value:string){selectValues.set(this,value);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
 const row={id:'npc-1',name:'Hafenwache',creatureId:null,lifecycle:'active' as const,factionId:null,locationId:null,disposition:0,role:'neutral' as const},base:Omit<NpcCastPage,'rows'|'total'>={sceneId:'scene-1',sceneTitle:'Vorhut',locationTitle:'Ohne Ortsbindung',offset:0,onlyUnplaced:true},dossier={scene:{id:'scene-1',title:'Vorhut'},date:'Erster Tag',locationTitle:'Ohne Ortsbindung',npc:{...row,noteRevision:0,readAloud:'Halt!',gmNotes:'Kennwort',record:{id:'npc-1',revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'Wachsam',history:''},positionRevision:null,actorRevision:null,health:null},faction:null,relations:[],relationCount:0,groups:[],autonomy:null,logs:[]} as unknown as NpcDossier;
 window.campaign={npcCast:async(_token:string,q:NpcCastQuery)=>({ok:true as const,value:{...base,rows:q.text?[]:[row],total:q.text?0:1}}),npcDossier:async()=>({ok:true as const,value:dossier})} as unknown as typeof window.campaign;
 const context={workspace:{token:'token'} as any,scene:{id:'scene-1',title:'Vorhut',locationId:null} as any},binder=new NpcCastBinder(()=>{},()=>context,async()=>true,async()=>{},async()=>{},async()=>{},async()=>{},async()=>{},async()=>{});
 const dialog=document.getElementById('npc-cast') as HTMLDialogElement;Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 try{
  await binder.open();assert.match(document.getElementById('npc-cast-document')!.textContent,/Hafenwache/);
  const labels=(id:string)=>[...dialog.querySelectorAll('label')].filter(label=>label.querySelector('#'+id)).map(label=>label.childNodes[0]?.textContent?.trim());assert.deepEqual(labels('npc-cast-search'),['Suche']);assert.deepEqual(labels('npc-cast-scope'),['Ort']);
  const search=document.getElementById('npc-cast-search') as HTMLInputElement;search.value='kein Treffer';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.doesNotMatch(document.getElementById('npc-cast-document')!.textContent,/Hafenwache|Gespräch festhalten/);assert.match(document.getElementById('npc-cast-document')!.textContent,/gesucht/);
  await wait(230);assert.match(document.getElementById('npc-cast-document')!.textContent,/Keine NSCs in diesem Filter/);assert.equal(document.getElementById('npc-cast-status')!.textContent,'Keine passenden NSCs gefunden.');assert.equal(document.querySelectorAll('#npc-cast-list button').length,0);
 }finally{binder.reset();Object.assign(globalThis,prior);}
});
