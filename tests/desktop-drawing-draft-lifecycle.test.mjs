import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/drawing-ui';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';export {AtlasPaint} from './src/app/atlas-paint';",resolveDir:process.cwd()},outfile:'.build/drawing-draft-lifecycle.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),file=require.resolve('../.build/drawing-draft-lifecycle.cjs');
async function fixture(t){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:global.window,document:global.document};Object.assign(global,{window,document});t.after(()=>Object.assign(global,previous));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(v){this.setAttribute('data-value',v);}});
 delete require.cache[file];const drawing=require(file),errors=[];let owner={token:'original',campaign:{id:'campaign'},floors:[{id:'ground',scopeId:'local'}],rooms:[]},prepare=async()=>true;
 window.campaign=new Proxy({},{get(){throw Error('Drafts must not write or load data');}});
 drawing.initDrawing((s,error)=>{if(error)errors.push(s);},()=>owner,()=>null,()=>prepare(),async()=>{},()=>{});
 await drawing.activateDrawing(owner,false);document.querySelector('#floors').value=JSON.stringify(['local','ground']);document.querySelector('#drawing-tool').value='room-cave';document.querySelector('#drawing-brush').value='1';document.querySelector('#drawing-snap').checked=false;
 const ui=Object.assign(Object.create(drawing.CampaignAtlasWorkbench.prototype),{scopeId:'local',brushQueue:Promise.resolve(),frame:()=>({x:0,y:0,angle:0}),render(){},error:e=>errors.push(e)});
 return{...drawing,ui,document,window,errors,hold(){let release;const task=new Promise(r=>release=r);prepare=()=>task;return()=>release(true);},switchOwner:async()=>{owner={...owner,token:'next'};await drawing.activateDrawing(owner,false);}};
}
for(const change of ['cancel','tool','owner'])test('queued brush points cannot recreate a draft after '+change,async t=>{
 const f=await fixture(t),release=f.hold();f.ui.queueBrush({x:-5,y:-5});f.ui.queueBrush({x:0,y:0});f.ui.queueBrush({x:5,y:5});
 await new Promise(r=>setImmediate(r));
 if(change==='cancel')f.document.querySelector('#drawing-cancel').click();
 if(change==='tool'){const tool=f.document.querySelector('#drawing-tool');tool.value='room-polygon';tool.dispatchEvent(new f.window.Event('change'));}
 if(change==='owner')await f.switchOwner();
 release();await f.ui.brushQueue;assert.deepEqual(f.atlasDrawingDraft().path,[],'Late preparation or queued points must not revive a revoked draft');assert.equal(f.atlasDrawingDraft().polygons,null);assert.deepEqual(f.errors,[]);
 await f.atlasDrawingPoint({x:20,y:30});assert.equal(f.atlasDrawingDraft().path.length,1,'Fresh input remains usable after cancellation');
});
test('an active brush retains ordered points and builds its real preview as numeric polygons',async t=>{
 const f=await fixture(t);f.ui.queueBrush({x:-3,y:1});f.ui.queueBrush({x:2,y:1});await f.ui.brushQueue;
 assert.deepEqual(f.atlasDrawingDraft().path,[{x:-3,y:1},{x:2,y:1}]);assert(f.atlasDrawingDraft().polygons.length);
 // Publish an empty detail layer without changing the open draft.
 f.window.campaign={drawingMap:async()=>({ok:true,value:{elements:[],styles:[],features:[],hiddenRooms:[],hiddenFloors:[]}})};
 await f.reloadDrawing();const scene=new f.AtlasPaint('group');f.drawingOverlay(scene);
 const area=scene.children.find(n=>n.style.fill==='#4f9da2');assert(area);assert.equal(area.kind,'polygons');assert.deepEqual(area.geometry.polygons,f.atlasDrawingDraft().polygons);assert.equal(area.geometry.path,undefined);
});
