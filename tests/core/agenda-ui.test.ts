import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {CampaignAgenda} from '../../src/app/agenda-ui';
import type {AgendaPage,AgendaQuery} from '../../src/app/agenda-contracts';

const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){for(let i=0;i<20;i++){if(check())return;await settle();}assert.ok(check(),'expected agenda UI state');}

test('agenda labels filters, clears stale search actions and hides new-entry trash',async()=>{
  const parsed=parseHTML('<button id="agenda-open"></button><button id="live-agenda-open"></button>'),prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,Option:globalThis.Option,Event:globalThis.Event},{document,window}=parsed;
  function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
  window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};
  const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.value??'';},set(value:string){selectValues.set(this,value);}});
  Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,HTMLTextAreaElement:window.HTMLTextAreaElement,Option:TestOption,Event:window.Event});
  const event={id:'event-1',revision:1,name:'Markt schließt',startMs:'3600000',durationMs:'3600000',repeatMs:null,locationId:null,notes:'',trashed:false};
  const page:AgendaPage={calendar:{revision:1,name:'Kalender',startYear:1,daySeconds:86400,months:[{name:'Frühmond',days:30}],weekdays:['Erster Tag']},scene:{id:'scene-1',title:'Vorhut',clockRevision:1,instantMs:'0',locationId:null,locationTitle:''},items:[{event,state:'upcoming',startMs:event.startMs,endMs:'7200000',sortMs:event.startMs,locationTitle:'',locationAvailable:true}],next:null,total:1};
  window.campaign={agenda:async(_token:string,query:AgendaQuery)=>({ok:true as const,value:query.search?{...page,items:[],total:0}:page})} as unknown as typeof window.campaign;
  const agenda=new CampaignAgenda(()=>({token:'token'} as any),async()=>true,()=>{},async()=>{}),dialog=document.getElementById('campaign-agenda') as HTMLDialogElement;Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  const click=(label:string)=>{const target=[...dialog.querySelectorAll('button')].find(button=>button.textContent===label) as HTMLButtonElement;assert.ok(target,label);target.onclick?.(new window.Event('click') as any);};
  try{
    (document.getElementById('agenda-open') as HTMLButtonElement).onclick?.(new window.Event('click') as any);await until(()=>dialog.open&&document.getElementById('agenda-status')?.textContent?.includes('Countdowns')===true);
    const label=(id:string)=>[...dialog.querySelectorAll('label')].find(row=>row.querySelector('#'+id))?.childNodes[0]?.textContent?.trim();assert.equal(label('agenda-search'),'Ereignissuche');assert.equal(label('agenda-horizon'),'Zeitraum');assert.equal(label('agenda-location-filter'),'Ort');
    const search=document.getElementById('agenda-search') as HTMLInputElement;search.value='kein Treffer';search.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('#agenda-list button').length,0);assert.doesNotMatch(document.getElementById('agenda-document')!.textContent,/Ereignis bearbeiten/);assert.match(document.getElementById('agenda-status')!.textContent,/gesucht/);await new Promise(resolve=>setTimeout(resolve,220));await until(()=>document.getElementById('agenda-status')?.textContent?.includes('Countdowns')===true);assert.match(document.getElementById('agenda-list')!.textContent,/Keine Ereignisse/);
    search.value='';search.dispatchEvent(new window.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,220));await until(()=>document.querySelectorAll('#agenda-list button').length===1);
    click('Neue Frist / Ereignis');const trash=dialog.querySelector('#agenda-event-form .toolbar:last-child button:last-child') as HTMLButtonElement;assert.equal(trash.textContent,'Ereignis in den Papierkorb');assert.equal(trash.hidden,true);
    click('Eingaben verwerfen');click('Ereignis bearbeiten');assert.equal(trash.hidden,false);
  }finally{agenda.reset();Object.assign(globalThis,prior);}
});
