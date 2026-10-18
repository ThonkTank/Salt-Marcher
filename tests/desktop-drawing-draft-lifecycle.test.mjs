import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/drawing-ui';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';export {AtlasPaint} from './src/app/atlas-paint';",resolveDir:process.cwd()},outfile:'.build/drawing-draft-lifecycle.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),file=require.resolve('../.build/drawing-draft-lifecycle.cjs');
async function fixture(t){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:global.window,document:global.document,Event:global.Event,CustomEvent:global.CustomEvent};Object.assign(global,{window,document,Event:window.Event,CustomEvent:window.CustomEvent});t.after(()=>Object.assign(global,previous));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(v){this.setAttribute('data-value',v);}});
 delete require.cache[file];const drawing=require(file),errors=[];let owner={token:'original',campaign:{id:'campaign'},floors:[{id:'ground',scopeId:'local'}],rooms:[]},prepare=async()=>true;
 window.campaign=new Proxy({},{get(){throw Error('Drafts must not write or load data');}});
 drawing.initDrawing((s,error)=>{if(error)errors.push(s);},()=>owner,()=>null,()=>prepare(),async()=>{},()=>{});
 await drawing.activateDrawing(owner,false);document.querySelector('#floors').value=JSON.stringify(['local','ground']);document.querySelector('#drawing-tool').value='room-cave';document.querySelector('#drawing-brush').value='1';document.querySelector('#drawing-snap').checked=false;
 const ui=Object.assign(Object.create(drawing.CampaignAtlasWorkbench.prototype),{scopeId:'local',brushQueue:Promise.resolve(),frame:()=>({x:0,y:0,angle:0}),render(){},error:e=>errors.push(e)});
 return{...drawing,ui,document,window,errors,owner:()=>owner,hold(){let release;const task=new Promise(r=>release=r);prepare=()=>task;return()=>release(true);},switchOwner:async()=>{owner={...owner,token:'next'};await drawing.activateDrawing(owner,false);}};
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

const doorRoom={id:'wall-room',scopeId:'local',floorId:'ground',revision:3,name:'Wache',number:'1',polygons:[{outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],holes:[]}]};
function doorWrites(f){
 const writes=[],view={elements:[],styles:[],features:[],hiddenRooms:[],hiddenFloors:[]};
 f.document.getElementById('drawing-tool').value='door';
 f.window.campaign={atlasDrawingCommit:async c=>{writes.push(c);return{ok:true,value:{workspace:f.owner(),view,atlasRevision:writes.length}};},drawingMap:async()=>({ok:true,value:view})};
 return writes;
}
test('two direct door clicks create independent commands and wall anchors without a draft or repeated tool selection',async t=>{
 const f=await fixture(t),writes=doorWrites(f),resolve=async()=>({room:doorRoom,maxDistance:.5});
 // Grid snapping must not move a clicked wall onto a different parallel wall.
 f.document.getElementById('drawing-snap').checked=true;f.document.getElementById('drawing-grid').value='1.524';
 await f.atlasDrawingPoint({x:10.1,y:4},undefined,resolve);await f.atlasDrawingPoint({x:6,y:.1},undefined,resolve);
 assert.equal(writes.length,2);assert.notEqual(writes[0].commandId,writes[1].commandId);
 for(const c of writes){assert.deepEqual(c.action.expectedRoom,{id:'wall-room',revision:3});assert.equal(c.action.expectedRevision,null);assert.equal(c.action.element.roomId,'wall-room');}
 assert.deepEqual(writes[0].action.element.points,[{x:10,y:4}]);assert.deepEqual(writes[1].action.element.points,[{x:6,y:0}]);
 assert.equal(f.document.getElementById('drawing-tool').value,'door');assert.deepEqual(f.atlasDrawingDraft().path,[]);assert.equal(await f.flushDrawing(),true);
 f.syncDrawingControls();assert.equal(f.document.getElementById('drawing-finish').hasAttribute('hidden'),true);assert.equal(f.document.getElementById('drawing-cancel').hasAttribute('hidden'),true);
 f.document.getElementById('drawing-cancel').click();assert.equal(f.document.getElementById('drawing-tool').value,'select');
});
for(const cancel of ['tool','owner'])test('a pending direct door read cannot write after '+cancel+' changes',async t=>{
 const f=await fixture(t),writes=doorWrites(f);let release;const blocked=new Promise(r=>release=r);
 const task=f.atlasDrawingPoint({x:10,y:4},undefined,()=>blocked);await new Promise(r=>setImmediate(r));
 if(cancel==='owner')await f.switchOwner();else{const tool=f.document.getElementById('drawing-tool');tool.value='select';tool.dispatchEvent(new f.window.Event('change'));}
 release({room:doorRoom,maxDistance:.5});await task;assert.equal(writes.length,0);assert.deepEqual(f.atlasDrawingDraft().path,[]);
});
test('door placement refuses another floor and distant points, and remains usable after failure',async t=>{
 const f=await fixture(t),writes=doorWrites(f);
 await assert.rejects(f.atlasDrawingPoint({x:10,y:4},undefined,async()=>({room:{...doorRoom,floorId:'upper'},maxDistance:.5})),/Geschoss/);
 await assert.rejects(f.atlasDrawingPoint({x:5,y:5},undefined,async()=>({room:doorRoom,maxDistance:.5})),/Raumwand/);
 await f.atlasDrawingPoint({x:10,y:4},undefined,async()=>({room:doorRoom,maxDistance:.5}));assert.equal(writes.length,1);
});
