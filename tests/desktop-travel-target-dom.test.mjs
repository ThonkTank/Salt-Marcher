import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from 'linkedom';
const require = createRequire(import.meta.url);
buildSync({ entryPoints: ['src/app/storage/store.ts'], outfile: '.build/world-dom-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
buildSync({ entryPoints: ['src/app/world-ui.ts'], outfile: '.build/world-dom.cjs', bundle: true, platform: 'node', format: 'cjs' });
if (process.env.WORLD_REVIEW_CAPTURE) writeFileSync(process.env.WORLD_REVIEW_CAPTURE, readFileSync('.build/world-dom.cjs'));
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 50; i++) { if (check()) return; await tick(); } assert.ok(check(), 'Expected world state did not arrive.'); }
async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'world-dom-')), filename = path.join(root, 'store.sqlite');
  const { CampaignStore } = require('../.build/world-dom-store.cjs');
  const store = new CampaignStore(filename), campaign = store.create('Welteditor'), w = store.activate(campaign.id);
  const command = action => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
  const scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision })).scene;
  const map = { id: randomUUID(), revision: 0, name: 'Region', hexMeters: 4828.032, climate: 'temperate', seed: 'world-test', cells: [] };
  const event = { id: randomUUID(), revision: 0, name: 'Markt', startMs: '0', durationMs: '86400000', repeatMs: null, locationId: null, notes: 'Vorher', trashed: false };
  const phenomenon = { id: randomUUID(), revision: 0, mapId: map.id, name: 'Nebel', kind: 'fog', intensity: .5, center: { q: 0, r: 0 }, radiusHexes: 3, movement: { q: 0, r: 0 }, startMs: '0', durationMs: '86400000', state: 'active', pausedAtMs: null, temperatureC: null, travelFactor: null, notes: 'Vorher' };
  for (const action of [{ kind: 'map', map, expectedRevision: null }, { kind: 'calendar-event', event, expectedRevision: null }, { kind: 'phenomenon', phenomenon, expectedRevision: null }]) store.executeWorld(command(action));
  const saved = { window: globalThis.window, document: globalThis.document };
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  let hold = false, release, beforeHold = false, releaseBefore, writes = 0;
  const sent = [], statuses = [], camps = [];
  const response = fn => { try { return { ok: true, value: fn() }; } catch (error) { return { ok: false, error: error.message }; } };
  window.campaign = {
    world: async token => response(() => store.world(token)), preparation: async token => response(() => store.preparation(token)), live: async token => response(() => store.live(token)),
    sceneWorld: async (token, id) => response(() => store.sceneWorld(token, id)),
    reconcileWorld: async (command, token) => response(() => store.reconcileWorld(command, token)),
    executeWorld: async c => {
      writes++; const captured = structuredClone(c); sent.push(captured);
      const result = response(() => store.executeWorld(captured));
      if (hold) { hold = false; return new Promise(resolve => { release = () => resolve(result); }); }
      return result;
    },
  };
  delete require.cache[require.resolve('../.build/world-dom.cjs')];
  const ui = require('../.build/world-dom.cjs');
  ui.initWorld(text => statuses.push(text), async () => { if (beforeHold) { beforeHold = false; await new Promise(resolve => { releaseBefore = resolve; }); } return true; }, async () => {}, async () => {}, async (sceneId,kind) => { camps.push({sceneId,kind}); });
  for (const select of document.querySelectorAll('select')) Object.defineProperty(select, 'value', { value: '', writable: true });
  for(const dialog of document.querySelectorAll('dialog')){dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
  ui.activateWorld(w); await ui.openWorld();
  const enter = (id, text) => { const input = document.getElementById(id); input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { root, store, campaign, w, scene, map, event, phenomenon, ui, window, document, enter, statuses, sent, camps,
    hold: () => { hold = true; }, holdBefore: () => { beforeHold = true; }, release: () => release(), releaseBefore: () => releaseBefore(),
    hasReply: () => !!release, hasBefore: () => !!releaseBefore, get writes() { return writes; },
    async select(id, selected) { const input = document.getElementById(id); input.value = selected; input.onchange(); await tick(); await tick(); },
    cleanup() { Object.assign(globalThis, saved); store.close(); rmSync(root, { recursive: true, force: true }); },
  };
}

async function travelFixture(){
 const x=await fixture(),command=action=>({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action});
 const c=x.store.executeLive(command({kind:'create-character',profile:{name:'Iri'}})).character,live=x.store.live(x.w.token);
 x.store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));
 x.store.executeWorld(command({kind:'place-scene',sceneId:x.scene.id,position:{mapId:x.map.id,q:0,r:0,locationId:null},expectedSceneRevision:x.scene.revision,expectedPositionRevision:0}));
 x.window.campaign.previewTravel=async(token,request)=>({ok:true,value:x.store.previewTravel(token,request)});
 await x.ui.openWorld();x.enter('travel-q','1');x.enter('travel-r','0');x.enter('travel-pace','1');x.enter('travel-factor','1');x.enter('travel-final-hours','');
 x.preview=()=>x.document.getElementById('world-travel-form').onsubmit(new x.window.Event('submit',{cancelable:true}));
 return x;
}
async function targetFixture(){
 const x=await travelFixture(),id=randomUUID(),command=action=>({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action});
 x.store.changePreparation({...command(null),change:{kind:'location',expectedRevision:null,document:{kind:'location',version:1,id,name:'Ruine',type:'poi',sections:[],detailMaps:[],keyLinks:[]}}});
 x.store.executeWorld(command({kind:'place',mapId:x.map.id,locationId:id,expectedRevision:null,hex:{q:3,r:0}}));await x.ui.openWorld();
 x.document.querySelector('#world-map polygon[data-q="1"][data-r="0"]').dispatchEvent(new x.window.Event('click'));
 await until(()=>x.document.getElementById('travel-q').value==='1');return{...x,locationId:id};
}
test('returning from a named destination restores the hex actually selected on the map',async()=>{
 const x=await targetFixture();try{await x.select('world-destination',x.locationId);assert.equal(x.document.getElementById('travel-q').value,'3');await x.select('world-destination','');assert.equal(x.document.getElementById('travel-q').value,'1');assert.equal(x.document.getElementById('travel-r').value,'0');}finally{x.cleanup();}
});
test('a manually edited coordinate releases a named place binding and previews the requested hex',async()=>{
 const x=await targetFixture();try{await x.select('world-destination',x.locationId);x.enter('travel-q','2');assert.equal(x.document.getElementById('world-destination').value,'');
 let requested;const real=x.window.campaign.previewTravel;x.window.campaign.previewTravel=async(token,request)=>{requested=structuredClone(request);return real(token,request);};
 x.document.getElementById('world-travel-form').onsubmit({preventDefault(){}});await until(()=>x.document.getElementById('travel-preview-dialog').open);assert.deepEqual(requested.destination,{q:2,r:0});assert.equal(requested.destinationLocationId,null);assert.equal(x.document.getElementById('travel-preview-accept').disabled,false);
 }finally{x.cleanup();}
});


test('a fresh travel console derives party pace and the preview explains its speed source',async()=>{
 const x=await travelFixture();try{const box=x.document.getElementById('travel-party-pace');box.checked=true;box.onchange();assert.equal(x.document.getElementById('travel-pace').disabled,true);assert.match(x.document.getElementById('travel-pace-context').textContent,/Iri.*30 ft/);x.preview();await until(()=>x.document.getElementById('travel-preview-dialog').open);assert.match(x.document.getElementById('travel-preview-itinerary').textContent,/langsamste Bewegung/);assert.match(x.document.getElementById('travel-preview-warnings').textContent,/Iri.*30 ft/);box.checked=false;box.onchange();assert.equal(x.document.getElementById('travel-pace').disabled,false);}finally{x.cleanup();}
});


test('a paused journey does not tell the GM to pause it first',async()=>{
 const x=await travelFixture();try{const p=x.store.previewTravel(x.w.token,{sceneId:x.scene.id,mapId:x.map.id,destination:{q:1,r:0},destinationLocationId:null,waypoints:[],paceKmh:1,factor:1,finalSeconds:null});let j=x.store.executeWorld({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action:{kind:'journey',preview:p}}).scene.journey;x.store.executeWorld({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action:{kind:'journey-state',id:j.id,expectedRevision:j.revision,state:'paused'}});await x.ui.openWorld();assert.match(x.document.getElementById('world-journey-status').textContent,/Pausiert/);assert.doesNotMatch(x.document.getElementById('world-journey-refresh').textContent,/zuerst pausieren/);assert.match(x.document.getElementById('world-journey-refresh').textContent,/Restweg.*neu bewerten/);}finally{x.cleanup();}
});

test('camera zoom and reset preserve an off-centre unsaved hex, its level and travel target without writes',async()=>{
 const x=await fixture();try{
  x.document.querySelector('#world-map polygon[data-q="3"][data-r="0"]').dispatchEvent(new x.window.Event('click'));await until(()=>x.document.getElementById('travel-q').value==='3');
  x.enter('hex-label','Alte Fähre');const root=x.document.getElementById('world-map'),initial=root.getAttribute('viewBox'),writes=x.writes;
  x.document.getElementById('world-zoom-out').onclick();assert.notEqual(root.getAttribute('viewBox'),initial);assert.equal(x.writes,writes);assert.equal(x.document.getElementById('hex-label').value,'Alte Fähre');assert.match(x.document.getElementById('hex-selected').textContent,/Hex 3,0.*4.83/);assert.equal(x.document.getElementById('travel-q').value,'3');
  x.document.getElementById('world-zoom-in').onclick();assert.equal(root.getAttribute('viewBox'),initial);
  const wheel=new x.window.Event('wheel',{cancelable:true});Object.assign(wheel,{deltaY:100});root.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,true);assert.notEqual(root.getAttribute('viewBox'),initial);
  x.document.getElementById('world-view-reset').onclick();assert.equal(root.getAttribute('viewBox'),initial);assert.equal(x.document.getElementById('hex-label').value,'Alte Fähre');assert.equal(x.writes,writes);
  for(let i=0;i<30;i++)x.document.getElementById('world-zoom-out').onclick();assert.equal(x.document.getElementById('world-zoom-out').disabled,true);assert.ok(root.querySelectorAll('polygon').length<=631);
  for(let i=0;i<30;i++)x.document.getElementById('world-zoom-in').onclick();assert.equal(x.document.getElementById('world-zoom-in').disabled,true);
  x.document.getElementById('hex-form').onsubmit({preventDefault(){}});await until(()=>x.store.world(x.w.token).maps[0].cells.some(c=>c.q===3&&c.r===0&&c.level===0&&c.label==='Alte Fähre'));await until(()=>root.textContent.includes('Alte Fähre'));const children=[...root.children],label=children.findIndex(c=>c.tagName.toLowerCase()==='text'&&c.textContent==='Alte Fähre');assert.ok(children.every((c,i)=>c.tagName.toLowerCase()!=='polygon'||i<label),'neighbouring terrain must not paint over map labels');
 }finally{x.cleanup();}
});
test('explicit edit raster saves the local cell before changing its separate authored layer',async()=>{
 const x=await fixture();try{x.enter('hex-label','Lokaler Ort');await x.select('world-edit-level','1');await until(()=>/9.66/.test(x.document.getElementById('hex-selected').textContent));assert.equal(x.store.world(x.w.token).maps[0].cells.find(c=>c.level===0).label,'Lokaler Ort');assert.equal(x.document.getElementById('hex-label').value,'');await x.select('world-edit-level','0');await until(()=>x.document.getElementById('hex-label').value==='Lokaler Ort');}finally{x.cleanup();}
});
test('arrows select one hex without also panning; Alt arrows pan without changing the selected hex',async()=>{
 const x=await fixture();try{const root=x.document.getElementById('world-map'),initial=root.getAttribute('viewBox');const key=altKey=>{const e=new x.window.Event('keydown',{cancelable:true});Object.assign(e,{key:'ArrowRight',altKey});root.dispatchEvent(e);};key(false);await until(()=>x.document.getElementById('travel-q').value==='1');assert.equal(root.getAttribute('viewBox'),initial);key(true);assert.notEqual(root.getAttribute('viewBox'),initial);assert.equal(x.document.getElementById('travel-q').value,'1');assert.match(x.document.getElementById('hex-selected').textContent,/Hex 1,0/);}finally{x.cleanup();}
});
for(const [field,text]of [['travel-waypoints','1,0,3'],['travel-waypoints','1,'],['travel-waypoints',' ,1'],['travel-q',''],['travel-r','']])test(`incomplete route ${field}=${JSON.stringify(text)} cannot be silently interpreted by the preview`,async()=>{
 const x=await travelFixture();try{const original=x.window.campaign.previewTravel,requests=[];x.window.campaign.previewTravel=async(...args)=>{requests.push(structuredClone(args[1]));return original(...args);};
 x.enter('travel-q','2');x.enter('travel-r','0');x.enter('travel-waypoints','1,0');assert.equal(x.document.getElementById('travel-stops').children.length,2);
 x.enter(field,text);x.preview();await tick();await tick();assert.equal(requests.length,0);assert.equal(x.document.getElementById('travel-preview-dialog').open,false);assert.equal(x.document.getElementById('travel-preview-accept').disabled,true);assert.equal(x.document.getElementById(field).value,text);assert.match(x.document.getElementById('travel-draft-status').textContent,/q.*r|koordinaten/i);assert.equal(x.writes,0);
 x.enter('travel-q','2');x.enter('travel-r','0');x.enter('travel-waypoints','1,0');x.preview();await until(()=>x.document.getElementById('travel-preview-dialog').open);assert.deepEqual(requests[0].waypoints,[{q:1,r:0}]);assert.deepEqual(requests[0].destination,{q:2,r:0});assert.equal(x.document.getElementById('travel-preview-accept').disabled,false);assert.equal(x.writes,0);
 }finally{x.cleanup();}
});


test('a rendered hex label selects its own hex in edit and route modes; location labels keep their place binding',async()=>{
 const x=await targetFixture();try{
  x.document.querySelector('#world-map polygon[data-q="3"][data-r="0"]').dispatchEvent(new x.window.Event('click'));await until(()=>/Hex 3,0/.test(x.document.getElementById('hex-selected').textContent));x.enter('hex-label','Alte Fähre');x.document.getElementById('hex-form').onsubmit({preventDefault(){}});await until(()=>[...x.document.querySelectorAll('#world-map text')].some(t=>t.textContent==='Alte Fähre'));
  const clickText=async(name)=>{const t=[...x.document.querySelectorAll('#world-map text')].find(t=>t.textContent===name);assert.ok(t);assert.notEqual(t.getAttribute('pointer-events'),'none');t.dispatchEvent(new x.window.Event('click',{bubbles:true}));await tick();await tick();};
  x.document.querySelector('#world-map polygon[data-q="0"][data-r="0"]').dispatchEvent(new x.window.Event('click'));await until(()=>/Hex 0,0/.test(x.document.getElementById('hex-selected').textContent));await clickText('Alte Fähre');await until(()=>/Hex 3,0/.test(x.document.getElementById('hex-selected').textContent));assert.match(x.document.getElementById('hex-selected').textContent,/Hex 3,0/);
  x.document.getElementById('travel-mode-target').onclick();await clickText('Ruine');assert.equal(x.document.getElementById('world-destination').value,x.locationId);await clickText('Alte Fähre');assert.equal(x.document.getElementById('world-destination').value,'');assert.equal(x.document.getElementById('travel-q').value,'3');
 }finally{x.cleanup();}
});

for(const response of ['committed','not yet sent'])test(`a ${response} travel acceptance cannot erase a newer route after its preview was cancelled`,async()=>{
 const x=await travelFixture();try{
  x.preview();await until(()=>x.document.getElementById('travel-preview-dialog').open);
  if(response==='committed')x.hold();else x.holdBefore();
  x.document.getElementById('travel-preview-accept').onclick();await until(response==='committed'?x.hasReply:x.hasBefore);
  x.document.getElementById('travel-preview-cancel').onclick();x.enter('travel-q','4');x.enter('travel-waypoints','1,1; 2,1');
  const before=x.store.sceneWorld(x.w.token,x.scene.id);
  if(response==='committed')x.release();else x.releaseBefore();await x.ui.flushWorld();await tick();await tick();
  assert.equal(x.document.getElementById('travel-q').value,'4');assert.equal(x.document.getElementById('travel-waypoints').value,'1,1; 2,1');assert.equal(x.document.getElementById('travel-stops').children.length,3);assert.equal(x.document.getElementById('travel-preview-dialog').open,false);assert.equal(x.document.getElementById('travel-preview-accept').disabled,true);assert.doesNotMatch(x.document.getElementById('journey-playback-status').textContent,/^Wiedergabe [125]/);
  const after=x.store.sceneWorld(x.w.token,x.scene.id);assert.deepEqual(after,before);assert.equal(x.writes,response==='committed'?1:0);if(response==='committed')assert.deepEqual(after.journey.route.at(-1),{q:1,r:0});
 }finally{await x.ui.stopWorldPlayback();x.cleanup();}
});


test('renaming above the canvas is saved with the same map and preserves hex edits', async()=>{
 const x=await fixture();try{
  x.enter('world-map-name','Moorfähre');x.enter('hex-label','Fähre');
  assert.equal(await x.ui.flushWorld(),true);
  const saved=x.store.world(x.w.token).maps.find(m=>m.id===x.map.id);
  assert.equal(saved.name,'Moorfähre');assert.equal(saved.cells.find(c=>c.q===0&&c.r===0).label,'Fähre');
  await x.ui.openWorld();assert.equal(x.document.getElementById('world-map-name').value,'Moorfähre');
  assert.equal(x.store.world(x.w.token).maps.length,1);
 }finally{x.cleanup();}
});


test('unpainted map is distinguishable from an explicitly authored plain after reopen',async()=>{
 const x=await fixture();try{
  const tile=()=>x.document.querySelector('#world-map polygon[data-q="0"][data-r="0"]');
  assert.equal(tile().dataset.authored,'false');assert.match(x.document.getElementById('hex-authored-status').textContent,/ungezeichnet/);
  Object.defineProperty(x.document.getElementById('world-map'),'clientHeight',{value:320,configurable:true});
  x.enter('hex-label','Moorfähre');assert.equal(await x.ui.flushWorld(),true);await x.ui.openWorld();
  assert.equal(Number(x.document.querySelector('#world-map text').getAttribute('font-size'))*320/1360,14);
  const camera=x.document.getElementById('world-map').getAttribute('viewBox');Object.defineProperty(x.document.getElementById('world-map'),'clientHeight',{value:480});x.window.dispatchEvent(new x.window.Event('resize'));
  assert.equal(Number(x.document.querySelector('#world-map text').getAttribute('font-size'))*480/1360,14);assert.equal(x.document.getElementById('world-map').getAttribute('viewBox'),camera);
  assert.equal(tile().dataset.authored,'true');assert.equal(tile().getAttribute('fill'),'#b8c896');
  assert.equal(x.document.querySelector('#world-map polygon[data-q="1"][data-r="0"]').dataset.authored,'false');
 }finally{x.cleanup();}
});


for(const kind of ['wait','rest'])for(const switched of [false,true])test(`pending travel ${kind} ${switched?'is cancelled on focus change':'pauses its latest confirmed checkpoint'}`,async()=>{
 const x=await travelFixture(),command=action=>({commandId:randomUUID(),campaignId:x.campaign.id,token:x.w.token,action});
 try{
  const c=x.store.executeLive(command({kind:'create-character',profile:{name:'Borin'}})).character;let live=x.store.live(x.w.token);
  x.store.executeLive(command({kind:'membership',characterId:c.id,expectedRevision:c.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:x.scene.id,expectedFocusRevision:live.focusRevision}));live=x.store.live(x.w.token);const a=x.store.liveScene(x.w.token,x.scene.id);
  const b=x.store.executeLive(command({kind:'move',sceneId:a.id,expectedRosterRevision:live.rosterRevision,expectedFocusRevision:live.focusRevision,expectedClockRevision:a.clock.revision,expectedSceneMembershipRevision:a.membershipRevision,memberIds:[c.id],target:{kind:'new',title:'Nachhut',expectedContentRevision:a.revision}})).session.createdScene;
  x.store.executeWorld(command({kind:'place-scene',sceneId:b.id,expectedSceneRevision:x.store.liveScene(x.w.token,b.id).revision,expectedPositionRevision:x.store.sceneWorld(x.w.token,b.id).position.revision,position:{mapId:x.map.id,q:0,r:0,locationId:null}}));
  for(const id of [a.id,b.id]){const p=x.store.previewTravel(x.w.token,{sceneId:id,mapId:x.map.id,destination:{q:2,r:0},destinationLocationId:null,waypoints:[],paceKmh:1,factor:1,finalSeconds:2});x.store.executeWorld(command({kind:'journey',preview:p}));}
  x.store.executeLive(command({kind:'focus',sceneId:a.id,expectedRevision:x.store.live(x.w.token).focusRevision}));await x.ui.openWorld();x.ui.setWorldSurface('live');await x.ui.renderLiveWorld(x.w.token,a.id);x.document.getElementById('live-travel-toggle').onclick();await until(()=>x.document.getElementById('live-travel-host').hidden===false);await tick();
  x.hold();x.document.getElementById('journey-play').onclick();for(let i=0;i<250&&!x.hasReply();i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(x.hasReply(),'the real checkpoint reply must be held before changing focus');
  x.document.getElementById('journey-'+kind).onclick();await tick();
  if(switched){x.store.executeLive(command({kind:'focus',sceneId:b.id,expectedRevision:x.store.live(x.w.token).focusRevision}));await x.ui.renderLiveWorld(x.w.token,b.id);}
  const other=x.store.sceneWorld(x.w.token,b.id),writes=x.writes;
  x.release();await x.ui.stopWorldPlayback();await tick();await tick();
  if(!switched){await until(()=>x.camps.length===1);assert.deepEqual(x.camps,[{sceneId:a.id,kind}]);assert.equal(x.store.sceneWorld(x.w.token,a.id).journey.status,'paused');assert.equal(x.store.sceneWorld(x.w.token,a.id).position.q,1);assert.equal(x.store.sceneWorld(x.w.token,a.id).scene.clock.instantMs,'1000');assert.deepEqual(x.store.sceneWorld(x.w.token,b.id),other);return;}
  assert.deepEqual(x.camps,[],'a delayed camp action must not open for the new focus');assert.equal(x.writes,writes,'the new group must not be paused');assert.deepEqual(x.store.sceneWorld(x.w.token,b.id),other);
  assert.equal(x.store.sceneWorld(x.w.token,a.id).position.q,1,'only the already confirmed checkpoint remains');
  x.document.getElementById('journey-'+kind).onclick();await until(()=>x.camps.length===1);assert.deepEqual(x.camps,[{sceneId:b.id,kind}]);assert.equal(x.store.sceneWorld(x.w.token,b.id).journey.status,'paused');assert.deepEqual(x.store.sceneWorld(x.w.token,b.id).position,other.position);assert.deepEqual(x.store.sceneWorld(x.w.token,b.id).scene.clock,other.scene.clock);
 }finally{if(x.hasReply())x.release();await x.ui.stopWorldPlayback();x.cleanup();}
});
