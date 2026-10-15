import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/generation-ui'; export {initCatalog,activateCatalog} from './src/app/catalog-ui';",resolveDir:process.cwd(),loader:'ts'},outfile:'.build/generation-context-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),settle=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
async function fixture(t){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window,document});t.after(()=>Object.assign(globalThis,previous));
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,writable:true,value:select.options[0]?.getAttribute('value')??''});
 const el=id=>document.getElementById(id),ok=value=>({ok:true,value}),tables=[{id:'watch',name:'Waldsaum',entries:[],trashed:false,scope:'campaign'}],calls=[],messages=[];let filters={},party=true;
 const plan={id:'plan',party:[{id:'hero',name:'Ada',level:1,count:1}]};
 const run=request=>({id:'run',seed:request.seed,request,revision:1,preset:{name:'Standard',revision:1},warnings:[],candidates:[{creatureId:'goblin'}],plans:[{name:'Waldsaum',sources:[{id:'goblin',name:'Goblin'}],entries:[{id:'g',creatureId:'goblin',count:1}],assessment:{baseXp:50,adjustedXp:50,difficulty:'easy'}}],acceptedPlanIds:[]});
 let generate=async request=>ok(run(request));window.campaign={encounterTables:async()=>ok(tables),lootTables:async()=>ok([]),generatorRegistry:async()=>ok({revision:1,presets:[]}),generationRuns:async()=>ok([]),generationSources:async()=>ok({sources:[],factions:[],locations:[]}),npcs:async()=>ok({rows:[],next:null,total:0}),generateEncounters:async(_token,r)=>{calls.push(r);return generate(r);},encounterPlans:async()=>ok([]),creatures:async()=>ok({rows:[],total:0,offset:0,limit:25})};
 delete require.cache[require.resolve('../.build/generation-context-ui.cjs')];const ui=require('../.build/generation-context-ui.cjs'),w={token:'one',campaign:{id:'camp'}};ui.initGeneration((...args)=>messages.push(args),{plan:async()=>party?plan:null,creature:()=>null,filters:()=>filters,info:()=>null,accept:async()=>{}});for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}ui.activateGeneration(w);await settle();
 el('catalog-reset').onclick=()=>{filters={};ui.generationCatalogFiltersChanged();};
 return{el,ui,w,calls,messages,setFilters:q=>{filters=q;ui.generationCatalogFiltersChanged();},setParty:value=>{party=value;},setGenerate:fn=>{generate=fn;},run,make:async()=>{el('generation-form').onsubmit({preventDefault(){}});await settle();},choice:()=>el('generation-preview').querySelector('article button')};
}
test('generation reveals every effective catalog filter without pagination or sorting noise',async t=>{
 const x=await fixture(t);assert.deepEqual(x.ui.catalogFilterSummary({text:' Dragon ',crMin:0,crMax:2,types:['Dragon'],offset:25,sort:'hp',direction:'desc',limit:25}),['Name: Dragon','HG ab: 0','HG bis: 2','Typ: Dragon']);
 const table=x.el('generation-tables').querySelector('input');table.checked=true;x.el('generation-time').value='night';x.setFilters({text:'Dragon',hpMax:10});assert.match(x.el('generation-catalog-summary').textContent,/Name: Dragon.*HP bis: 10/);x.el('generation-clear-catalog').click();assert.equal(table.checked,true);assert.equal(x.el('generation-time').value,'night');assert.match(x.el('generation-catalog-summary').textContent,/Keine zusätzlichen/);assert.equal(x.el('generation-clear-catalog').hidden,true);
});
test('catalog filter changes invalidate old proposal controls and preserve their actual basis',async t=>{
 const x=await fixture(t);x.setFilters({text:'Goblin'});await x.make();assert.equal(x.choice().disabled,false);assert.match(x.el('generation-preview').textContent,/Katalogfilter dieser Vorschau: Name: Goblin/);
 x.setFilters({text:'Dragon'});assert.equal(x.choice().disabled,true);assert.match(x.el('generation-preview').textContent,/Einstellungen geändert/);assert.match(x.el('generation-preview').textContent,/Katalogfilter dieser Vorschau: Name: Goblin/);
 await x.make();assert.equal(x.calls[1].filters.text,'Dragon');assert.equal(x.choice().disabled,false);
});
test('missing party and generator failures are explained beside the action, stale errors cannot replace a new workspace',async t=>{
 const x=await fixture(t);x.setParty(false);await x.make();assert.match(x.el('generation-feedback').textContent,/Zur Planungsparty/);assert.equal(x.calls.length,0);
 x.setParty(true);x.setGenerate(async()=>({ok:false,error:'Keine Kreaturen nach Tabellen und Filtern.'}));await x.make();assert.match(x.el('generation-feedback').textContent,/Keine Kreaturen/);
 let finish;x.setGenerate(()=>new Promise(r=>finish=r));x.el('generation-form').onsubmit({preventDefault(){}});await settle();x.ui.activateGeneration({...x.w,token:'two'});finish({ok:false,error:'ALTER Fehler'});await settle();assert.doesNotMatch(x.el('generation-feedback').textContent,/ALTER/);
});
test('actual catalog input and reset notify the generator about their shared filters',async t=>{
 const x=await fixture(t);x.ui.initCatalog(()=>{},async()=>{},async()=>{});x.ui.activateCatalog(x.w);await settle();
 x.el('catalog-form').reset=()=>{for(const c of x.el('catalog-form').querySelectorAll('input'))c.value='';x.el('catalog-direction').value='asc';};
 x.el('catalog-search').value='Dragon';x.el('catalog-search').oninput();assert.match(x.el('generation-catalog-summary').textContent,/Name: Dragon/);x.el('generation-clear-catalog').click();assert.match(x.el('generation-catalog-summary').textContent,/Keine zusätzlichen/);await new Promise(r=>setTimeout(r,250));
});
