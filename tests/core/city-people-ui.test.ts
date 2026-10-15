import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {activateCity,initCity,openCity} from '../../src/app/city-ui';
import type {CityOverview,CityView} from '../../src/app/city-contracts';

const wait=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean){for(let i=0;i<30;i++){if(check())return;await wait(10);}assert.ok(check(),'expected city UI state');}

test('city people search removes stale actions and builds a job from a selected worker',async()=>{
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/index.html'),'utf8')),{document,window}=parsed,prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,DOMParser:globalThis.DOMParser,Event:globalThis.Event},selectValue=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');
 const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.getAttribute('value')??'';},set(value:string){selectValues.set(this,value);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,HTMLTextAreaElement:window.HTMLTextAreaElement,DOMParser:window.DOMParser,Event:window.Event});
 for(const dialog of document.querySelectorAll('dialog')){Object.defineProperty(dialog,'open',{value:false,writable:true});(dialog as HTMLDialogElement).showModal=()=>{(dialog as HTMLDialogElement).open=true;};(dialog as HTMLDialogElement).close=()=>{(dialog as HTMLDialogElement).open=false;};}
 const people=[{id:'ada',name:'Ada',lifecycle:'active' as const,factionId:null,locationId:null},{id:'bert',name:'Bert',lifecycle:'active' as const,factionId:null,locationId:null}],view:CityView={header:{id:'city',revision:2,name:'Hafenstadt',locationId:'place',width:600,height:400,paper:'#e9dfc8',roof:'#9c604c'},units:[{id:'home',kind:'building',name:'Wohnhaus',protected:true,position:{x:100,y:100},angle:0,outline:[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5},{x:-5,y:5}],use:'Wohnhaus',notes:'',residentIds:[],workerIds:[],households:[],jobs:[],rooms:[],interior:false}],canUndo:true,canRedo:false},overview:CityOverview={cities:[view.header],locations:[{id:'place',name:'Hafenstadt'}],assignedPeople:[]};
 window.campaign={cities:async()=>({ok:true as const,value:overview}),city:async()=>({ok:true as const,value:view}),npcs:async(_token,query)=>{const rows=people.filter(person=>!query.text||person.name.includes(query.text));return{ok:true as const,value:{rows,total:rows.length,next:null}};}} as unknown as typeof window.campaign;
 try{
  const messages:string[]=[];initCity(message=>messages.push(message));(document.getElementById('city-tool') as HTMLSelectElement).value='select';activateCity({token:'token',campaign:{id:'campaign'}} as any);await openCity();
  const hits=document.querySelectorAll('[data-city-unit="home"]'),hit=hits[hits.length-1] as SVGElement;assert.ok(hit);hit.dispatchEvent(new window.Event('click',{bubbles:true}));await wait(30);assert.equal(document.querySelectorAll('#city-people-results strong').length,2,messages.join(' | ')||document.getElementById('city-people-results')?.outerHTML);
  const search=document.getElementById('city-people-search') as HTMLInputElement;search.value='Bert';search.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(document.querySelectorAll('#city-people-results strong').length,0);assert.equal(document.querySelectorAll('#city-people-results input[data-city-person]').length,0);assert.match(document.getElementById('city-people-status')!.textContent,/werden gesucht/);
  await wait(280);await until(()=>document.querySelectorAll('#city-people-results strong').length===1);assert.equal(document.querySelector('#city-people-results strong')?.textContent,'Bert');
  const worker=document.querySelector<HTMLInputElement>('#city-people-results input[data-city-person="worker"]')!;worker.checked=true;worker.dispatchEvent(new window.Event('change',{bubbles:true}));(document.getElementById('city-job-add') as HTMLButtonElement).click();assert.equal(document.querySelector<HTMLInputElement>('#city-jobs input[data-city-job="name"]')?.value,'Neuer Beruf 1');assert.equal(document.querySelector<HTMLInputElement>('#city-jobs input[data-city-job="worker"]')?.checked,true);
 }finally{activateCity({token:'closed',campaign:{id:'closed'}} as any);if(selectValue)Object.defineProperty(window.HTMLSelectElement.prototype,'value',selectValue);else delete (window.HTMLSelectElement.prototype as any).value;Object.assign(globalThis,prior);}
});
