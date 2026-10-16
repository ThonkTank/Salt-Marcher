import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML,DOMParser} from 'linkedom';
buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/drawing-dom-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['src/app/drawing-model.ts'],outfile:'.build/drawing-dom-model.cjs',bundle:true,platform:'node',format:'cjs'});
buildSync({entryPoints:['src/app/drawing-ui.ts'],outfile:'.build/drawing-dom-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/drawing-dom-store.cjs'),{newElement}=require('../.build/drawing-dom-model.cjs'),tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(fn){for(let i=0;i<60;i++){if(fn())return;await tick();}assert.ok(fn(),'Expected drawing state did not arrive.');}
async function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'drawing-dom-')),store=new CampaignStore(path.join(dir,'workbench.sqlite')),saved={window:globalThis.window,document:globalThis.document,DOMParser:globalThis.DOMParser,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8'));Object.assign(globalThis,{window,document,DOMParser,Event:window.Event,CustomEvent:window.CustomEvent});
 for(const select of document.querySelectorAll('select')){let chosen='';Object.defineProperty(select,'value',{get(){const options=[...select.querySelectorAll('option')];return options.find(o=>o.value===chosen)?.value??options[0]?.value??'';},set(v){chosen=String(v);}});if(!select.options)Object.defineProperty(select,'options',{get:()=>[...select.querySelectorAll('option')]});}
 const ids={},elements={},rooms={};for(const name of ['Alpha','Beta']){const r={id:randomUUID(),scopeId:'local',floorId:'ground',number:'1',name,revision:0,polygons:[{outer:[{x:0,y:0},{x:3,y:0},{x:3,y:3},{x:0,y:3}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:''}]},c=store.create(name,[r]),w=store.activate(c.id);ids[name]=c.id;rooms[name]=r;const e={...newElement('object','local','ground',r.id,[{x:1,y:1}]),name};elements[name]=e;store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:c.id,action:{kind:'element',element:e,expectedRevision:null}});store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:c.id,action:{kind:'style',expectedRevision:null,style:{id:r.id,scopeId:'local',revision:0,ceilingMeters:3,fill:'#aabbcc',wall:'#123456',publicLabel:'',secret:false}}});}
 let current=store.activate(ids.Alpha),holdBefore=false,releaseBefore;const sent=[],changed=[],statuses=[];const reply=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
 window.campaign={drawing:async token=>reply(()=>store.drawing(token)),executeDrawing:async command=>{sent.push(structuredClone(command));return reply(()=>{const result=store.executeAtlas({...command,action:{kind:'drawing',command}});return {workspace:result.atlas.workspace,view:result.atlas.geometry.drawing};});},executeAtlas:async command=>{const r=await window.campaign.executeDrawing(command.action.command);return r.ok?reply(()=>({atlas:store.campaignAtlas(command.token),result:r.value})):r;}};
 delete require.cache[require.resolve('../.build/drawing-dom-ui.cjs')];const ui=require('../.build/drawing-dom-ui.cjs');ui.initDrawing(text=>statuses.push(text),()=>current,()=>current.rooms.find(r=>r.id===current.selectedId)??null,async()=>{if(holdBefore){holdBefore=false;await new Promise(resolve=>{releaseBefore=resolve;});}return true;},async w=>{changed.push(w);current=w;},()=>{});await ui.activateDrawing(current);
 async function select(name='Alpha',expectedName=name){document.getElementById('drawing-tool').value='select';const map=document.getElementById('map');map.replaceChildren();ui.drawingOverlay(map);const g=[...map.querySelectorAll('[data-drawing-id]')].find(g=>g.getAttribute('data-drawing-id')===elements[name].id);assert.ok(g);g.dispatchEvent(new window.Event('click',{bubbles:true}));await tick();await tick();await until(()=>document.getElementById('drawing-element-name').value===expectedName).catch(error=>{error.message+=' '+JSON.stringify(statuses);throw error;});}
 const click=id=>document.getElementById(id).click(),enter=(id,text)=>{const input=document.getElementById(id);input.value=text;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 await select();return{dir,store,window,document,ui,rooms,elements,sent,changed,statuses,click,enter,select,current:()=>current,async switchTo(name){current=store.activate(ids[name]);await ui.activateDrawing(current);},holdBefore(){holdBefore=true;},hasBefore:()=>!!releaseBefore,releaseBefore:()=>releaseBefore(),async cleanup(){if(releaseBefore)releaseBefore();await tick();await tick();store.close();Object.assign(globalThis,saved);rmSync(dir,{recursive:true,force:true});}};
}
test('inspector input typed during a save is drained rather than discarded by its acknowledgement',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;let first=true;x.window.campaign.executeDrawing=async command=>{const result=await send(command);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(result);});}return result;};x.enter('drawing-element-name','First');const flush=x.ui.flushDrawing();await until(()=>!!release);x.enter('drawing-element-name','Second');x.enter('drawing-element-notes','  Further prose\r\n');release();assert.equal(await flush,true);const e=x.store.drawing(x.current().token).elements.find(e=>e.id===x.elements.Alpha.id);assert.equal(e.name,'Second');assert.equal(e.notes,'  Further prose\r\n');assert.equal(x.document.getElementById('drawing-element-name').value,'Second');assert.equal(x.sent.length,2);assert.equal(x.sent[1].action.expectedRevision,x.sent[0].action.expectedRevision+1);}finally{if(release)release();await x.cleanup();}});
test('concurrent inspector flushes join the same pending write',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;x.window.campaign.executeDrawing=async command=>{const result=await send(command);return new Promise(resolve=>{release=()=>resolve(result);});};x.enter('drawing-element-name','Changed');const first=x.ui.flushDrawing();await until(()=>!!release);const second=x.ui.flushDrawing();await tick();assert.equal(x.sent.length,1);release();assert.equal(await first,true);assert.equal(await second,true);}finally{if(release)release();await x.cleanup();}});
test('drawing intent waiting for another editor flush cannot adopt a different campaign',async()=>{const x=await fixture();try{x.holdBefore();x.click('drawing-element-hide');await until(x.hasBefore);await x.switchTo('Beta');x.releaseBefore();await tick();await tick();assert.deepEqual(x.sent,[]);}finally{await x.cleanup();}});
test('a confirmed old drawing write cannot replace a newer campaign workspace',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;x.window.campaign.executeDrawing=async command=>{const result=await send(command);return new Promise(resolve=>{release=()=>resolve(result);});};x.enter('drawing-element-name','Saved Alpha');const flush=x.ui.flushDrawing();await until(()=>!!release);await x.switchTo('Beta');const token=x.current().token;release();await flush;assert.equal(x.current().token,token);assert.deepEqual(x.changed,[]);}finally{if(release)release();await x.cleanup();}});
test('an older drawing read cannot overwrite newer styles in the same campaign',async()=>{const x=await fixture();let release;try{let first=true;x.window.campaign.drawing=async token=>{const value=x.store.drawing(token);if(first){first=false;return new Promise(resolve=>{release=()=>resolve({ok:true,value});});}return{ok:true,value};};const old=x.ui.reloadDrawing();await until(()=>!!release);const w=x.current(),s=x.store.drawing(w.token).styles.find(s=>s.id===x.rooms.Alpha.id);x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'style',style:{...s,fill:'#abcdef'},expectedRevision:s.revision}});await x.ui.reloadDrawing();release();await old;assert.equal(x.ui.roomDrawingStyle(x.rooms.Alpha.id).fill,'#abcdef');}finally{if(release)release();await x.cleanup();}});

test('room-transform callback awaiting a flush cannot recapture Beta as its target',async()=>{const x=await fixture();try{x.holdBefore();x.click('drawing-transform');await until(x.hasBefore);await x.switchTo('Beta');x.releaseBefore();await tick();await tick();assert.deepEqual(x.sent,[]);}finally{await x.cleanup();}});
test('room style input during an acknowledgement is drained on its own confirmed revision',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;let first=true;x.window.campaign.executeDrawing=async command=>{const result=await send(command);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(result);});}return result;};x.enter('drawing-public-label','First');const flush=x.ui.flushDrawing();await until(()=>!!release);x.enter('drawing-public-label','Second');release();assert.equal(await flush,true);const style=x.store.drawing(x.current().token).styles.find(s=>s.id===x.rooms.Alpha.id);assert.equal(style.publicLabel,'Second');assert.equal(x.sent.length,2);assert.equal(x.sent[1].action.expectedRevision,x.sent[0].action.expectedRevision+1);}finally{if(release)release();await x.cleanup();}});
test('a dirty style keeps its original base across an unrelated newer read rather than overwriting it',async()=>{const x=await fixture();try{x.enter('drawing-public-label','Local edit');const w=x.current(),s=x.store.drawing(w.token).styles.find(s=>s.id===x.rooms.Alpha.id);x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'style',expectedRevision:s.revision,style:{...s,publicLabel:'Other confirmed edit'}}});await x.ui.reloadDrawing();assert.equal(await x.ui.flushDrawing(),false);assert.equal(x.store.drawing(w.token).styles.find(item=>item.id===s.id).publicLabel,'Other confirmed edit');assert.equal(x.document.getElementById('drawing-public-label').value,'Local edit');assert.equal(x.sent[0].action.expectedRevision,s.revision);}finally{await x.cleanup();}});
test('invalid newer inspector input remains editable after the first valid save is confirmed',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;let first=true;x.window.campaign.executeDrawing=async command=>{const result=await send(command);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(result);});}return result;};x.enter('drawing-element-name','First valid');const flush=x.ui.flushDrawing();await until(()=>!!release);x.enter('drawing-width','not-a-number');release();assert.equal(await flush,false);assert.equal(x.document.getElementById('drawing-width').value,'not-a-number');assert.equal(x.store.drawing(x.current().token).elements.find(e=>e.id===x.elements.Alpha.id).name,'First valid');x.enter('drawing-width','2');assert.equal(await x.ui.flushDrawing(),true);assert.equal(x.store.drawing(x.current().token).elements.find(e=>e.id===x.elements.Alpha.id).width,2);}finally{if(release)release();await x.cleanup();}});

test('a synchronous inspector parse failure cannot leave a completed failed flush permanently pending',async()=>{const x=await fixture();try{x.enter('drawing-element-points','invalid point');assert.equal(await x.ui.flushDrawing(),false);assert.deepEqual(x.sent,[]);x.enter('drawing-element-points','1, 1');assert.equal(await x.ui.flushDrawing(),true);assert.equal(x.sent.length,1);}finally{await x.cleanup();}});

test('selecting an element after flushing its edits uses the newly confirmed revision',async()=>{const x=await fixture();try{x.enter('drawing-element-notes','First confirmed edit');await x.select();x.enter('drawing-element-notes','Second confirmed edit');assert.equal(await x.ui.flushDrawing(),true);assert.equal(x.store.drawing(x.current().token).elements.find(e=>e.id===x.elements.Alpha.id).notes,'Second confirmed edit');assert.equal(x.sent[1].action.expectedRevision,x.sent[0].action.expectedRevision+1);}finally{await x.cleanup();}});
test('a dirty element preserves its own base after another writer updates it',async()=>{const x=await fixture();try{x.enter('drawing-element-notes','Local draft');const w=x.current(),e=x.store.drawing(w.token).elements.find(e=>e.id===x.elements.Alpha.id);x.store.executeDrawing({commandId:randomUUID(),token:w.token,campaignId:w.campaign.id,action:{kind:'element',element:{...e,notes:'Other confirmed edit'},expectedRevision:e.revision}});await x.ui.reloadDrawing();assert.equal(await x.ui.flushDrawing(),false);assert.equal(x.document.getElementById('drawing-element-notes').value,'Local draft');assert.equal(x.store.drawing(w.token).elements.find(e=>e.id===x.elements.Alpha.id).notes,'Other confirmed edit');assert.equal(x.sent[0].action.expectedRevision,e.revision);}finally{await x.cleanup();}});
test('concurrent room style flushes join a single pending write',async()=>{const x=await fixture();let release;try{const send=x.window.campaign.executeDrawing;x.window.campaign.executeDrawing=async command=>{const result=await send(command);return new Promise(resolve=>{release=()=>resolve(result);});};x.enter('drawing-public-label','Changed');const first=x.ui.flushDrawing();await until(()=>!!release);const second=x.ui.flushDrawing();await tick();assert.equal(x.sent.length,1);release();assert.equal(await first,true);assert.equal(await second,true);}finally{if(release)release();await x.cleanup();}});

test('successive rectangle drags create independent rooms while retaining the chosen drawing tool',async()=>{
 const x=await fixture(),savedPoint=globalThis.DOMPoint;try{
  globalThis.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  const map=x.document.getElementById('map');map.getScreenCTM=()=>({inverse:()=>({})});map.setPointerCapture=()=>{};map.focus=()=>{};
  x.document.getElementById('drawing-tool').value='room-rectangle';
  function pointer(type,px,py){const event=new x.window.Event(type,{bubbles:true});Object.assign(event,{clientX:px,clientY:py,pointerId:1,button:0});map.dispatchEvent(event);}
  for(const [name,left] of [['Gate',6.096],['Guard',15.24]]){
   x.document.getElementById('drawing-room-name').value=name;
   pointer('pointerdown',left,6.096);await tick();await tick();
   pointer('pointermove',left+4.572,10.668);pointer('pointerup',left+4.572,10.668);
   await until(()=>x.current().rooms.some(r=>r.name===name));await tick();await tick();
   assert.equal(x.document.getElementById('drawing-tool').value,'room-rectangle');
   assert.equal(x.store.drawing(x.current().token).elements.length,1);
  }
  assert.equal(x.sent.length,2);assert.deepEqual(x.sent.map(c=>c.action.kind),['create-room','create-room']);
  assert.equal(x.current().rooms.length,3);assert.notEqual(x.current().rooms[1].id,x.current().rooms[2].id);
 }finally{globalThis.DOMPoint=savedPoint;await x.cleanup();}
});

test('room visibility shortcut autosaves and survives reopening without changing its style',async()=>{
 const x=await fixture();try{
  const input=x.document.getElementById('drawing-room-secret');input.checked=true;input.dispatchEvent(new x.window.Event('change'));
  await until(()=>x.sent.some(c=>c.action.kind==='style'));assert.equal(await x.ui.flushDrawing(),true);
  const s=x.store.drawing(x.current().token).styles.find(s=>s.id===x.rooms.Alpha.id);
  assert.equal(s.secret,true);assert.equal(s.fill,'#aabbcc');assert.equal(s.wall,'#123456');
  await x.ui.activateDrawing(x.current());assert.equal(input.checked,true);
  assert.match(x.document.getElementById('drawing-visibility-status').textContent,/Nur für die Spielleitung/);
 }finally{await x.cleanup();}
});

test('door pointer input chooses its wall before raster snap and stores that wall attachment',async()=>{
 const x=await fixture(),savedPoint=globalThis.DOMPoint;try{
  globalThis.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  const map=x.document.getElementById('map');map.getScreenCTM=()=>({inverse:()=>({})});map.focus=()=>{};
  x.document.getElementById('drawing-tool').value='door';x.document.getElementById('drawing-snap').checked=true;
  const down=new x.window.Event('pointerdown',{bubbles:true});Object.assign(down,{clientX:3,clientY:1.5,pointerId:1,button:0});map.dispatchEvent(down);await tick();await tick();
  x.click('drawing-finish');await until(()=>x.sent.some(c=>c.action.kind==='element'));
  await tick();await tick();assert.equal(await x.ui.flushDrawing(),true);
  const door=x.store.drawing(x.current().token).elements.find(e=>e.kind==='door');
  assert.equal(door.anchor.edge,1);assert.equal(door.anchor.t,.5);assert.deepEqual(door.points,[{x:3,y:1.5}]);
 }finally{globalThis.DOMPoint=savedPoint;await x.cleanup();}
});


test('shared Atlas rectangle drags use the drawing transaction without changing existing rooms',async()=>{
 const x=await fixture();try{
  const first=structuredClone(x.current().rooms[0]);
  x.document.querySelector('[data-drawing-tool="room-rectangle"]').click();x.enter('drawing-room-name','Atlas room');
  await x.ui.atlasDrawingRectangle({x:6.096,y:0},{x:10.668,y:4.572});
  assert.equal(x.current().rooms.length,2);assert.deepEqual(x.current().rooms.find(r=>r.id===first.id),first);
  assert.equal(x.current().rooms.find(r=>r.name==='Atlas room').polygons[0].outer.length,4);
  assert.equal(x.sent.length,1);assert.equal(x.sent[0].action.kind,'create-room');
 }finally{await x.cleanup();}
});
test('switching tools while a shared rectangle waits for a flush cancels the old gesture',async()=>{
 const x=await fixture();try{
  x.document.querySelector('[data-drawing-tool="room-rectangle"]').click();x.holdBefore();
  const pending=x.ui.atlasDrawingRectangle({x:6,y:0},{x:10,y:4});await until(x.hasBefore);
  x.document.querySelector('[data-drawing-tool="door"]').click();x.releaseBefore();await pending;
  assert.deepEqual(x.sent,[]);assert.deepEqual(x.ui.atlasDrawingDraft().path,[]);
  assert.equal(x.document.getElementById('drawing-tool').value,'door');
 }finally{await x.cleanup();}
});
test('shared Atlas door input keeps its wall point before grid snapping',async()=>{
 const x=await fixture();try{
  x.document.querySelector('[data-drawing-tool="door"]').click();
  await x.ui.atlasDrawingPoint({x:3,y:1.6});x.click('drawing-finish');await until(()=>x.sent.length===1);await until(()=>x.current().canUndo);
  const door=x.store.drawing(x.current().token).elements.find(e=>e.kind==='door');assert.ok(door);
  assert.ok(Math.abs(door.points[0].x-3)<1e-7);assert.ok(Math.abs(door.points[0].y-1.6)<1e-7);
  assert.equal(door.roomId,x.rooms.Alpha.id);assert.ok(door.anchor);
 }finally{await x.cleanup();}
});


test('Escape while the first Atlas point waits for a flush leaves no delayed point',async()=>{
 const x=await fixture();try{
  x.document.querySelector('[data-drawing-tool="room-rectangle"]').click();x.holdBefore();
  const pending=x.ui.atlasDrawingPoint({x:6,y:0});await until(x.hasBefore);
  x.ui.cancelDrawingGesture();x.releaseBefore();await pending;
  assert.deepEqual(x.sent,[]);assert.deepEqual(x.ui.atlasDrawingDraft().path,[]);
 }finally{await x.cleanup();}
});
