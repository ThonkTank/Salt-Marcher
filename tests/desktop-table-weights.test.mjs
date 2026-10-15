import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';
mkdirSync('.build/catalog',{recursive:true});copyFileSync('src/features/catalog/data/srd-5.1.generated.json','.build/catalog/srd-5.1.generated.json');
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/table-weights-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/generation-ui.ts'],outfile:'.build/table-weights-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/table-weights-store.cjs');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
async function fixture(t,kind){
 const root=mkdtempSync(path.join(tmpdir(),'table-weights-')),store=new CampaignStore(path.join(root,'campaign.sqlite')),campaign=store.create('Tabellengewichte'),w=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:w.token,campaignId:campaign.id,action});
 const table=kind==='encounter'?{id:randomUUID(),revision:0,scope:'campaign',name:'Wachen',description:'Rohtext',entries:[{creatureId:'guard',weight:'1'},{creatureId:'goblin',weight:'1'}],habitats:[],time:'any',lootTableId:null,trashed:false}:{id:randomUUID(),revision:0,name:'Beute',description:'Rohtext',rolls:1,entries:['A','B'].map(name=>({id:randomUUID(),weight:'1',minimum:1,maximum:1,item:{name,valueGold:'0',category:'other'}})),trashed:false};
 store.executeGeneration(command({kind:kind==='encounter'?'table-save':'loot-save',table,expectedRevision:null}));
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),saved={window:globalThis.window,document:globalThis.document};
 const selectPrototype=window.HTMLSelectElement.prototype,selectValue=Object.getOwnPropertyDescriptor(selectPrototype,'value');Object.defineProperty(selectPrototype,'value',{get(){return this._value??this.options[0]?.value??'';},set(v){this._value=v;},configurable:true});
 Object.assign(globalThis,{window,document});t.after(()=>{Object.defineProperty(selectPrototype,'value',selectValue);Object.assign(globalThis,saved);store.close();rmSync(root,{recursive:true,force:true});});
 const result=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 window.campaign={creature:async id=>({ok:true,value:{id,name:id,xp:25,challengeRating:'1/8'}}),executeGeneration:async c=>result(()=>store.executeGeneration(c))};
 for(const method of ['encounterTables','lootTables','generatorRegistry','generationRuns','generationSources','npcs'])window.campaign[method]=async(...args)=>result(()=>store[method](...args));
 delete require.cache[require.resolve('../.build/table-weights-ui.cjs')];const ui=require('../.build/table-weights-ui.cjs'),messages=[];let selectedCreature=null;ui.initGeneration((...args)=>messages.push(args),{plan:async()=>null,creature:()=>selectedCreature,filters:()=>({}),info:()=>null,accept:async()=>{}});for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}ui.activateGeneration(w);await ui.refreshGeneration();
 const el=id=>document.getElementById(id),prefix=kind==='encounter'?'table':'loot',read=()=>store[kind==='encounter'?'encounterTables':'lootTables'](w.token,true).find(t=>t.id===table.id);
 el(kind==='encounter'?'encounter-table-list':'loot-table-list').value=table.id;el(kind==='encounter'?'encounter-table-open':'loot-table-open').click();await settle();
 const entries=el(prefix+'-entries'),inputs=kind==='encounter'?[...entries.querySelectorAll('input')]:[...entries.querySelectorAll('label')].filter(l=>l.firstChild.textContent==='Gewicht').map(l=>l.querySelector('input'));
 return {el,inputs,messages,read,select:id=>{selectedCreature={id,name:id,xp:25,challengeRating:'1/8'};ui.generationCreature(selectedCreature);},shares:()=>kind==='encounter'?[...entries.querySelectorAll('.table-share')].map(n=>n.textContent):[...entries.querySelectorAll('legend')].map(n=>n.textContent.split(' · ')[1]),edit:(i,text)=>{inputs[i].value=text;inputs[i].oninput();},save:async()=>{el(prefix+'-form').onsubmit({preventDefault(){}});await settle();}};
}
for(const kind of ['encounter','loot'])test(kind+' shares follow every raw edit, invalidate together and recover without replacing inputs',async t=>{
 const x=await fixture(t,kind);assert.deepEqual(x.shares(),['50,00 %','50,00 %']);
 x.edit(0,'3');assert.deepEqual(x.shares(),['75,00 %','25,00 %']);
 x.edit(0,'-');assert.deepEqual(x.shares(),['Ungültig','Ungültig']);assert.equal(x.inputs[0].value,'-');assert.deepEqual(x.read().entries.map(e=>e.weight),['1','1']);
 x.edit(0,'0,5');assert.deepEqual(x.shares(),['33,33 %','66,67 %']);assert.equal(x.inputs[0].isConnected,true);assert.equal(x.inputs[0].value,'0,5');
 await x.save();assert.deepEqual(x.read().entries.map(e=>e.weight),['0.5','1']);assert.deepEqual(x.messages.filter(m=>m[1]),[]);
});

test('table draft keeps core edits first, blocks unusable saves and returns to the saved selection',async t=>{
 const x=await fixture(t,'encounter');
 assert.equal(x.el('table-options').open,false);assert.equal(x.el('table-save').disabled,false);
 const order=[...x.el('table-form').children].map(n=>n.id);assert.ok(order.indexOf('table-entries')<order.indexOf('table-options'));
 x.edit(0,'-');assert.equal(x.el('table-save').disabled,true);await x.save();assert.deepEqual(x.read().entries.map(e=>e.weight),['1','1']);
 x.edit(0,'0');x.edit(1,'0');assert.equal(x.el('table-save').disabled,true);assert.match(x.el('table-save-status').textContent,/größer als 0/);
 x.edit(0,'3');assert.equal(x.el('table-save').disabled,false);await x.save();assert.equal(x.el('encounter-table-list').value,x.read().id);assert.equal(x.el('encounter-table-open').disabled,false);
 x.el('encounter-table-new').click();await settle();assert.equal(x.el('table-save').disabled,true);assert.equal(x.el('table-scope').value,'campaign');assert.equal(x.el('table-add-creature').disabled,true);
 x.el('table-name').value='Waldsaum';x.el('table-name').oninput();assert.equal(x.el('table-save').disabled,true);assert.match(x.el('table-save-status').textContent,/Kreatur/);
 x.select('goblin');assert.equal(x.el('table-add-creature').disabled,false);x.el('table-add-creature').click();assert.equal(x.el('table-save').disabled,false);assert.equal(x.el('table-add-creature').disabled,true);assert.match(x.el('table-add-creature').textContent,/Bereits/);
 x.el('table-entries').querySelector('button').click();assert.equal(x.el('table-save').disabled,true);assert.equal(x.el('table-add-creature').disabled,false);
 await x.save();assert.equal(x.el('table-manager').open,true);
 x.el('table-add-creature').click();x.el('table-name').value='  ';x.el('table-name').oninput();assert.equal(x.el('table-save').disabled,true);await x.save();assert.equal(x.el('table-manager').open,true);
});
