import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {LocationNotebook} from '../../../src/app/campaign/location-notebook-ui';
import type {LocationMaterialsQuery} from '../../../src/app/campaign/location-notebook-contracts';

const wait=(ms=0)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

test('location and material searches debounce independently and label their fields',async()=>{
 const parsed=parseHTML('<html><body></body></html>'),{document,window}=parsed,prior={document:globalThis.document,window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,Option:globalThis.Option,Event:globalThis.Event};
 const querySelector=document.querySelector.bind(document);document.querySelector=((selector:string)=>selector==='dialog:modal'?null:querySelector(selector)) as typeof document.querySelector;
 function TestOption(text='',value=''){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}
 window.HTMLSelectElement.prototype.add=function(option:HTMLOptionElement){this.append(option);};
 const selectValues=new WeakMap<object,string>();Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return selectValues.get(this)??this.querySelector('option')?.value??'';},set(value:string){selectValues.set(this,value);}});
 Object.assign(globalThis,{document,window,HTMLInputElement:window.HTMLInputElement,HTMLSelectElement:window.HTMLSelectElement,Option:TestOption,Event:window.Event});
 const id='10000000-0000-4000-8000-000000000001',queries:LocationMaterialsQuery[]=[];
 window.campaign={locationMaterials:async(_token:string,query:LocationMaterialsQuery)=>{queries.push({...query});if(query.kind==='directory'){const rows=[{id,title:'Nordtor',detail:'Interessanter Ort'},{id:'20000000-0000-4000-8000-000000000002',title:'Südhafen',detail:'Interessanter Ort'}].filter(row=>!query.text||row.title.includes(query.text));return{ok:true as const,value:{items:rows,next:null,locationRevision:null}};}return{ok:true as const,value:{items:query.text?[]:[{id:'npc-1',title:'Hafenwache',detail:'NSC am Ort'}],next:null,locationRevision:1}};},live:async()=>({ok:true as const,value:{scene:{id:'scene-1',title:'Vorhut',locationId:id},focusRevision:1,focusId:'scene-1'}}),deskContent:async()=>({ok:true as const,value:{ref:{kind:'location' as const,id},title:'Nordtor',label:'Ort',revision:1,location:{kind:'location' as const,version:1 as const,id,name:'Nordtor',type:'poi' as const,sections:[],detailMaps:[],keyLinks:[]}}})} as unknown as typeof window.campaign;
 const workspace={token:'token',campaign:{id:'campaign'}} as any,notebook=new LocationNotebook(()=>workspace,async()=>true,()=>{},async()=>{}),dialog=document.getElementById('location-notebook') as HTMLDialogElement;
 Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 try{
  await notebook.open();assert.equal(document.querySelectorAll('.location-directory-row').length,2);assert.match(document.getElementById('location-material-list')!.textContent,/Hafenwache/);
  const labels=(id:string)=>[...dialog.querySelectorAll('label')].filter(label=>label.querySelector('#'+id)).map(label=>label.childNodes[0]?.textContent?.trim());assert.deepEqual(labels('location-notebook-search'),['Ortssuche']);assert.deepEqual(labels('location-material-kind'),['Materialart']);assert.deepEqual(labels('location-material-search'),['Materialsuche']);
  const locationSearch=document.getElementById('location-notebook-search') as HTMLInputElement;locationSearch.value='Süd';locationSearch.dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(document.querySelectorAll('.location-directory-row').length,0);assert.match(document.getElementById('location-notebook-index')!.textContent,/Orte werden gesucht/);
  await wait(40);const materialSearch=document.getElementById('location-material-search') as HTMLInputElement;materialSearch.value='niemand';materialSearch.dispatchEvent(new window.Event('input',{bubbles:true}));assert.doesNotMatch(document.getElementById('location-material-list')!.textContent,/Hafenwache/);assert.match(document.getElementById('location-material-list')!.textContent,/gesucht/);
  await wait(240);assert.ok(queries.some(query=>query.kind==='directory'&&query.text==='Süd'));assert.ok(queries.some(query=>query.kind==='npc'&&query.text==='niemand'));assert.deepEqual([...document.querySelectorAll('.location-directory-row')].map(row=>row.textContent),['Südhafen · Interessanter Ort']);assert.match(document.getElementById('location-material-list')!.textContent,/Kein zugeordnetes Material/);
 }finally{notebook.close();Object.assign(globalThis,prior);}
});
