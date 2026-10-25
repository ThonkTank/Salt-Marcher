import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {TimeNavigator} from '../../../src/app/runtime/time-plan-ui';
import type {AgendaPage,AgendaQuery} from '../../../src/app/runtime/agenda-contracts';

const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){for(let i=0;i<20;i++){if(check())return;await settle();}assert.ok(check(),'expected time navigator state');}

test('time navigation labels its choices and filters events while the GM types',async()=>{
  const parsed=parseHTML('<html><body><button id="time-plan-open"></button></body></html>'),{document,window}=parsed;
  const prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
  function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
  window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};
  const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.value??'';},set(value:string){selectValues.set(this,value);}});
  Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
  const event={id:'event-1',revision:1,name:'Hafenwache trifft ein',startMs:'3600000',durationMs:'3600000',repeatMs:null,locationId:null,notes:'',trashed:false};
  const base:AgendaPage={calendar:{revision:1,name:'Kalender',startYear:1,daySeconds:86400,months:[{name:'Frühmond',days:30}],weekdays:['Erster Tag']},scene:{id:'scene-1',title:'Vorhut',clockRevision:1,instantMs:'0',locationId:null,locationTitle:''},items:[{event,state:'upcoming',startMs:event.startMs,endMs:'7200000',sortMs:event.startMs,locationTitle:'',locationAvailable:true}],next:null,total:1};
  const searches:string[]=[];window.campaign={agenda:async(_token:string,query:AgendaQuery)=>{searches.push(query.search);return{ok:true as const,value:{...base,items:query.search==='Nacht' ? [] : base.items}};}} as unknown as typeof window.campaign;
  const navigator=new TimeNavigator(()=>{},()=>({workspace:{token:'token'} as any,scene:{id:'scene-1',title:'Vorhut',clock:{instantMs:'0'}} as any}),async()=>true,async()=>true,async()=>true),dialog=document.getElementById('time-navigator') as HTMLDialogElement;
  Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  try{
    await navigator.open();
    const labels=(id:string)=>[...dialog.querySelectorAll('label')].filter(label=>label.querySelector('#'+id)).map(label=>label.childNodes[0]?.textContent?.trim());
    assert.deepEqual(labels('time-navigator-mode'),['Zeitpunkt wählen']);assert.deepEqual(labels('time-navigator-amount'),['Dauer']);assert.deepEqual(labels('time-navigator-unit'),['Einheit']);assert.deepEqual(labels('time-navigator-reason'),['Grund (optional)']);
    const mode=document.getElementById('time-navigator-mode') as HTMLSelectElement;mode.value='event';mode.onchange?.(new window.Event('change') as any);
    const search=document.getElementById('time-navigator-search') as HTMLInputElement;search.value='Nacht';search.dispatchEvent(new window.Event('input',{bubbles:true}));
    await until(()=>searches.at(-1)==='Nacht');assert.match(document.getElementById('time-navigator-events')!.textContent,/Keine passenden/);
  }finally{navigator.reset();Object.assign(globalThis,prior);}
});
