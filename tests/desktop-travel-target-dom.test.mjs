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
  const sent = [], statuses = [];
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
  ui.initWorld(text => statuses.push(text), async () => { if (beforeHold) { beforeHold = false; await new Promise(resolve => { releaseBefore = resolve; }); } return true; }, async () => {}, async () => {});
  for (const select of document.querySelectorAll('select')) Object.defineProperty(select, 'value', { value: '', writable: true });
  for(const dialog of document.querySelectorAll('dialog')){dialog.open=false;dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
  ui.activateWorld(w); await ui.openWorld();
  const enter = (id, text) => { const input = document.getElementById(id); input.value = text; input.dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { root, store, campaign, w, scene, map, event, phenomenon, ui, window, document, enter, statuses, sent,
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

for(const [field,text]of [['travel-waypoints','1,0,3'],['travel-waypoints','1,'],['travel-waypoints',' ,1'],['travel-q',''],['travel-r','']])test(`incomplete route ${field}=${JSON.stringify(text)} cannot be silently interpreted by the preview`,async()=>{
 const x=await travelFixture();try{const original=x.window.campaign.previewTravel,requests=[];x.window.campaign.previewTravel=async(...args)=>{requests.push(structuredClone(args[1]));return original(...args);};
 x.enter('travel-q','2');x.enter('travel-r','0');x.enter('travel-waypoints','1,0');assert.equal(x.document.getElementById('travel-stops').children.length,2);
 x.enter(field,text);x.preview();await tick();await tick();assert.equal(requests.length,0);assert.equal(x.document.getElementById('travel-preview-dialog').open,false);assert.equal(x.document.getElementById('travel-preview-accept').disabled,true);assert.equal(x.document.getElementById(field).value,text);assert.match(x.document.getElementById('travel-draft-status').textContent,/q.*r|koordinaten/i);assert.equal(x.writes,0);
 x.enter('travel-q','2');x.enter('travel-r','0');x.enter('travel-waypoints','1,0');x.preview();await until(()=>x.document.getElementById('travel-preview-dialog').open);assert.deepEqual(requests[0].waypoints,[{q:1,r:0}]);assert.deepEqual(requests[0].destination,{q:2,r:0});assert.equal(x.document.getElementById('travel-preview-accept').disabled,false);assert.equal(x.writes,0);
 }finally{x.cleanup();}
});
