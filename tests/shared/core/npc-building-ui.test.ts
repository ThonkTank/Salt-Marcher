import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {chooseNpcBuilding} from '../../../src/app/campaign/npc-building-ui';
import type {NpcBuildingChoices,NpcBuildingQuery} from '../../../src/app/campaign/npc-places-contracts';

const wait=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

test('NPC building search is visibly labelled and an older result cannot replace the current query',async()=>{
 const parsed=parseHTML('<html><body></body></html>'),{document,window}=parsed,prior={document:globalThis.document,window:globalThis.window,Event:globalThis.Event};
 const prototype=window.HTMLElement.prototype as unknown as {showModal?:()=>void;close?:()=>void},oldShow=prototype.showModal,oldClose=prototype.close;
 prototype.showModal=function(this:HTMLElement){this.setAttribute('open','');};prototype.close=function(this:HTMLElement){this.removeAttribute('open');};
 Object.assign(globalThis,{document,window,Event:window.Event});
 const calls:{query:NpcBuildingQuery;resolve:(value:{ok:true;value:NpcBuildingChoices})=>void}[]=[];
 window.campaign={npcBuildingChoices:async(_token:string,_id:string,query:NpcBuildingQuery)=>await new Promise(resolve=>calls.push({query,resolve}))} as unknown as typeof window.campaign;
 try{
  const choice=chooseNpcBuilding('token','ada','home'),dialog=document.getElementById('npc-building-picker')!;
  assert.equal(dialog.getAttribute('aria-labelledby'),'npc-building-heading');
  const labelled=(id:string)=>[...dialog.querySelectorAll('label')].filter(label=>label.querySelector('#'+id)).map(label=>label.childNodes[0]?.textContent?.trim());
  assert.deepEqual(labelled('npc-building-search'),['Haus oder Stadt suchen']);assert.deepEqual(labelled('npc-building-record-name'),['Neuer Haushaltsname (optional)']);assert.equal(calls.length,1);
  const search=document.getElementById('npc-building-search') as HTMLInputElement;search.value='Süd';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.match(document.getElementById('npc-building-results')!.textContent,/werden gesucht/);
  await wait(200);assert.equal(calls.length,2);assert.equal(calls[1]!.query.text,'Süd');
  calls[1]!.resolve({ok:true,value:{npcId:'ada',name:'Ada',currentCityTitle:null,currentBinding:null,next:null,items:[{cityId:'south',unitId:'dock',title:'Südhafen',cityTitle:'Hafenstadt'}]}});await wait();
  calls[0]!.resolve({ok:true,value:{npcId:'ada',name:'Ada',currentCityTitle:null,currentBinding:null,next:null,items:[{cityId:'north',unitId:'gate',title:'Nordtor',cityTitle:'Hafenstadt'}]}});await wait();
  const results=document.getElementById('npc-building-results')!;assert.match(results.textContent,/Südhafen/);assert.doesNotMatch(results.textContent,/Nordtor/);
  (document.getElementById('npc-building-record-name') as HTMLInputElement).value='Familie Abendrot';(results.querySelector('button') as HTMLButtonElement).click();assert.deepEqual(await choice,{kind:'assign',role:'home',npcId:'ada',cityId:'south',unitId:'dock',recordName:'Familie Abendrot'});
 }finally{if(oldShow)prototype.showModal=oldShow;else delete prototype.showModal;if(oldClose)prototype.close=oldClose;else delete prototype.close;Object.assign(globalThis,prior);}
});
