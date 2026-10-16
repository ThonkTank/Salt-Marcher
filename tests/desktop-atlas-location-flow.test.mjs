import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';

const base='.build/atlas-location-flow',require=createRequire(import.meta.url);
for(const [name,entry] of [['store','src/app/storage/store.ts'],['ui','src/app/world-ui.ts']])buildSync({entryPoints:[entry],outfile:base+'/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.ok(check(),'Atlas state did not arrive');}

test('the atlas creates a place on its selected hex and reopens the canonical notebook after reactivation',async t=>{
 const root=mkdtempSync(path.join(tmpdir(),'atlas-location-flow-')),{CampaignStore}=require('../'+base+'/store.cjs'),store=new CampaignStore(path.join(root,'world.sqlite')),campaign=store.create('Nebelwald'),workspace=store.activate(campaign.id);
 const old={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent},{window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,Event:window.Event,CustomEvent:window.CustomEvent});
 t.after(()=>{Object.assign(globalThis,old);store.close();rmSync(root,{recursive:true,force:true});});
 const response=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}},sent=[],opened=[],messages=[];
 window.campaign={world:async token=>response(()=>store.world(token)),preparation:async token=>response(()=>store.preparation(token)),live:async token=>response(()=>store.live(token)),sceneWorld:async(token,id)=>response(()=>store.sceneWorld(token,id)),executeWorld:async command=>{sent.push(structuredClone(command));return response(()=>store.executeWorld(command));},reconcileWorld:async(command,token)=>response(()=>store.reconcileWorld(command,token))};
 const ui=require('../'+base+'/ui.cjs');ui.initWorld(message=>messages.push(message),async()=>true,async()=>{},async()=>{},async()=>{},async(id,current)=>{assert.equal(current(),true);opened.push(store.preparation(workspace.token).locations.find(location=>location.document.id===id).document);});
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:'',writable:true});
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 for(const input of document.querySelectorAll('input'))input.focus=()=>{};
 const get=id=>document.getElementById(id);ui.activateWorld(workspace);await ui.openWorld();
 assert.equal(store.world(workspace.token).maps.length,1);assert.equal(get('world-map-name').value,store.world(workspace.token).maps[0].name);
 assert.equal(get('world-anchor-create').disabled,false);get('world-anchor-create').click();await until(()=>get('atlas-location-dialog').open);
 assert.match(get('atlas-location-target').textContent,/Hex 0,0/);
 get('atlas-location-name').value='Verfallene Waldkapelle';get('atlas-location-description').value='Eine Kapelle ohne Dach.';get('atlas-location-notes').value='  Unter dem Altar liegt der Wegweiser.\r\n';
 get('atlas-location-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await until(()=>messages.includes('Ort und Marker angelegt.'));
 assert.equal(get('atlas-location-dialog').open,false);assert.equal(get('world-anchor-create').disabled,true);
 const location=store.preparation(workspace.token).locations[0],place=store.world(workspace.token).places[0];
 assert.equal(place.locationId,location.document.id);assert.deepEqual([place.q,place.r],[0,0]);assert.equal(get('world-anchor-location').value,place.locationId);
 assert.ok(document.querySelector('[data-marker-label="'+place.locationId+'"]'));assert.equal(sent.filter(command=>command.action.kind==='place-create').length,1);
 get('world-anchor-open').click();await until(()=>opened.length===1);assert.equal(opened[0].sections[1].markdown,'  Unter dem Altar liegt der Wegweiser.\r\n');
 ui.activateWorld(workspace);await ui.openWorld();get('world-anchor-location').value=place.locationId;get('world-anchor-location').onchange();await until(()=>!get('world-anchor-open').disabled);get('world-anchor-open').click();await until(()=>opened.length===2);
 assert.deepEqual(opened[1],opened[0]);assert.equal(store.preparation(workspace.token).locations.length,1);
});
