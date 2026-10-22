import {landscapeFixture} from './helpers/atlas-workbench.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from './helpers/build.mjs';
import {createRequire} from 'node:module';
import {parseHTML} from './helpers/dom.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/place-repeat-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/atlas-landscape-ui.ts'],outfile:'.build/place-repeat-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const {CampaignStore}=require('../.build/place-repeat-store.cjs'),{LandscapeWorkbench}=require('../.build/place-repeat-ui.cjs');
function setup(t){
 const dir=mkdtempSync(tmpdir()+'/place-repeat-'),store=new CampaignStore(dir+'/campaign.sqlite'),cam=store.create('Waldpass'),w=store.activate(cam.id);
 const {window,document}=parseHTML('<div id="atlas-tool-fields"></div><input id="atlas-new-name"><select id="atlas-hex-level"><option value="0">0</option></select><canvas id="map"></canvas>');
 const previous={window:globalThis.window,document:globalThis.document,DOMPoint:globalThis.DOMPoint,Option:globalThis.Option};Object.assign(globalThis,{window,document,DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}},Option:function(text,value){const option=document.createElement('option');option.textContent=text;option.value=value;return option;}});
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(value){this.setAttribute('data-value',value);}});
 window.HTMLSelectElement.prototype.add=function(option){this.append(option);};
 window.campaign={deskContent:async(token,ref)=>({ok:true,value:store.deskContent(token,ref)})};
 const svg=document.getElementById('map');
 const box={x:0,y:0,width:30000,height:20000},commands=[];
 const write=action=>{commands.push(structuredClone(action));return Promise.resolve(store.executeAtlas({commandId:randomUUID(),token:w.token,campaignId:cam.id,action}));};
 const view=landscapeFixture(new LandscapeWorkbench(svg,{point:e=>({x:e.clientX,y:e.clientY}),box:()=>box,redraw:()=>{},write,error:e=>{throw e;},data:()=>store.campaignAtlas(w.token)}));
 view.active=true;view.token=w.token;
 // The projection port reads the real stored records; raster/viewport loading is unrelated to a click's authoring target.
 view.load=async()=>{view.records=store.landscapeRegion(w.token,box).records;};
 for(const id of ['land-tool','land-field','atlas-hex-level'])Object.defineProperty(document.getElementById(id),'value',{value:id==='land-field'?'terrain':id==='atlas-hex-level'?'0':'place',writable:true});
 view.tool='place';
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});Object.assign(globalThis,previous);});
 const click=(x,y)=>{const e=new window.Event('click',{bubbles:true});Object.assign(e,{clientX:x,clientY:y});svg.dispatchEvent(e);};
 const name=text=>document.getElementById('atlas-new-name').value=text;
 return {view,store,w,cam,commands,document,click,name,box,write};
}
test('consecutive place clicks create distinct canonical locations without rewriting the previously inspected place',async t=>{
 const x=setup(t);x.name('Fährdorf');x.click(100,100);await x.view.finish();
 const first=x.view.records[0],original=x.store.deskContent(x.w.token,{kind:'location',id:first.locationId});
 assert.equal(x.document.getElementById('land-object').value,first.id,'the newly inspected canonical place appears in the object list');
 x.name('Alter Wachturm');x.click(19000,100);assert.match(x.document.getElementById('land-status').textContent,/Ortspunkt gesetzt/);assert.equal(x.document.getElementById('land-selection').children.length,0);await x.view.finish();
 assert.equal(x.view.records.length,2);assert.equal(x.commands[1].expectedRevision,null);assert.notEqual(x.commands[1].record.id,first.id);
 assert.deepEqual(x.store.deskContent(x.w.token,{kind:'location',id:first.locationId}),original);
 const second=x.view.records.find(r=>r.name==='Alter Wachturm');assert.deepEqual(second.points,[{x:19000,y:100}]);assert.equal(x.store.deskContent(x.w.token,{kind:'location',id:second.locationId}).location.name,'Alter Wachturm');
 x.name('Waldlager');x.click(9000,5000);await x.view.finish();assert.equal(x.view.records.length,3);
 await x.write({kind:'undo'});await x.view.load();assert.equal(x.view.records.length,2);assert.equal(x.store.deskContent(x.w.token,{kind:'location',id:first.locationId}).location.name,'Fährdorf');
});
test('a new place click preserves dirty existing place prose until explicitly finished or discarded',async t=>{
 const x=setup(t);x.name('Fährdorf');x.click(100,100);await x.view.finish();
 const first=x.view.records[0],name=x.document.getElementById('land-name');name.value='Fährdorf am Wald';name.oninput();
 const notes=x.document.querySelector('textarea[data-section-body]');notes.value='  Am Anleger wartet die Fährfrau.\r\n';notes.oninput();
 x.name('Alter Wachturm');x.click(19000,100);
 assert.match(x.document.getElementById('land-status').textContent,/abschließen oder verwerfen/);assert.equal(x.view.points.length,0);assert.equal(name.value,'Fährdorf am Wald');assert.equal(x.commands.length,1);
 await x.view.finish();assert.equal(x.store.deskContent(x.w.token,{kind:'location',id:first.locationId}).location.name,'Fährdorf am Wald');assert.equal(x.store.deskContent(x.w.token,{kind:'location',id:first.locationId}).location.sections[0].markdown,notes.value);
 x.click(19000,100);await x.view.finish();assert.equal(x.view.records.length,2);assert.equal(x.view.records.find(r=>r.name==='Alter Wachturm').points[0].x,19000);
});


test('finished measurement survives overlay repaint and returns to grid guidance only after cancel, without author writes',async t=>{
 const x=setup(t),tool=x.document.getElementById('land-tool');tool.value='measure';tool.onchange();x.document.getElementById('land-auto-level').checked=true;
 const before=x.store.db.serialize();x.click(0,0);x.click(1.524,0);await x.view.finish();
 const root={append(){}};x.view.draw(root,{x:0,y:0,width:10,height:10},.1);x.view.drawOverlay(root,{x:0,y:0,width:10,height:10},.1);
 assert.equal(x.document.getElementById('land-status').textContent,'5 ft');
 assert.equal(x.view.hasDraft(),false);assert.deepEqual(x.commands,[]);assert.deepEqual(x.store.db.serialize(),before);
 x.view.cancel();x.view.drawOverlay(root,{x:0,y:0,width:10,height:10},.1);
 assert.match(x.document.getElementById('land-status').textContent,/Kante zu Kante/);assert.deepEqual(x.store.db.serialize(),before);
});
