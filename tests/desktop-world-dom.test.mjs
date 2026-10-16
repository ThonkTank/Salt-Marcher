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
  const initialMap = store.world(w.token).maps[0];
  const map = { ...initialMap, name: 'Region', hexMeters: 4828.032, climate: 'temperate', seed: 'world-test', cells: [] };
  const event = { id: randomUUID(), revision: 0, name: 'Markt', startMs: '0', durationMs: '86400000', repeatMs: null, locationId: null, notes: 'Vorher', trashed: false };
  const phenomenon = { id: randomUUID(), revision: 0, mapId: map.id, name: 'Nebel', kind: 'fog', intensity: .5, center: { q: 0, r: 0 }, radiusHexes: 3, movement: { q: 0, r: 0 }, startMs: '0', durationMs: '86400000', state: 'active', pausedAtMs: null, temperatureC: null, travelFactor: null, notes: 'Vorher' };
  for (const action of [{ kind: 'map', map, expectedRevision: initialMap.revision }, { kind: 'calendar-event', event, expectedRevision: null }, { kind: 'phenomenon', phenomenon, expectedRevision: null }]) store.executeWorld(command(action));
  const saved = { window: globalThis.window, document: globalThis.document, Event: globalThis.Event, CustomEvent: globalThis.CustomEvent };
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, Event: window.Event, CustomEvent: window.CustomEvent });
  let hold = false, release, beforeHold = false, releaseBefore, writes = 0;
  const sent = [], statuses = [];
  const response = fn => { try { return { ok: true, value: fn() }; } catch (error) { return { ok: false, error: error.message }; } };
  window.campaign = {
    world: async token => response(() => store.world(token)), preparation: async token => response(() => store.preparation(token)), live: async token => response(() => store.live(token)),
    sceneWorld: async (token, id) => response(() => store.sceneWorld(token, id)),
    reconcileWorld: async (command, token) => response(() => store.reconcileWorld(command, token)),
    executeWorld: async c => {
      writes++; const captured = structuredClone(c); sent.push(captured);
      const result = response(() => {
        if (!['map','cell','place','place-create','place-presentation'].includes(captured.action.kind)) return store.executeWorld(captured);
        const atlasAck = store.executeAtlas({...captured,action:{kind:'world',command:captured}});
        return {...atlasAck.result,atlasAck};
      });
      if (hold) { hold = false; return new Promise(resolve => { release = () => resolve(result); }); }
      return result;
    },
  };
  window.campaign.executeAtlas = async command => {
    assert.equal(command.action.kind, 'world');
    const r = await window.campaign.executeWorld(command.action.command);
    return r.ok ? {ok:true,value:r.value.atlasAck} : r;
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
test('a delayed travel preview cannot repopulate a different campaign selection',async()=>{
 const x=await travelFixture();let release;try{
  x.enter('travel-q','1');
  const original=x.window.campaign.previewTravel;x.window.campaign.previewTravel=async(...args)=>{const response=await original(...args);return new Promise(resolve=>{release=()=>resolve(response);});};
  x.preview();await until(()=>!!release);const second=x.store.create('Andere Kampagne'),next=x.store.activate(second.id);x.ui.activateWorld(next);await x.ui.openWorld();release();await tick();await tick();
  assert.equal(x.document.getElementById('travel-preview-summary').textContent,'');assert.equal(x.document.getElementById('travel-preview-accept').disabled,true);
 }finally{x.cleanup();}
});
test('out-of-order travel previews keep the latest requested destination',async()=>{
 const x=await travelFixture();let release;try{
  const original=x.window.campaign.previewTravel;let first=true;x.window.campaign.previewTravel=async(...args)=>{const response=await original(...args);if(first){first=false;return new Promise(resolve=>{release=()=>resolve(response);});}return response;};
  x.preview();await until(()=>!!release);x.enter('travel-q','3');x.preview();await until(()=>x.document.getElementById('travel-preview-summary').textContent.includes('3 Abschnitte'));release();await tick();await tick();
  assert.match(x.document.getElementById('travel-preview-summary').textContent,/3 Abschnitte/);
 }finally{x.cleanup();}
});
test('editing travel fields invalidates an older approved-looking preview',async()=>{
 const x=await travelFixture();try{
  x.preview();await until(()=>x.document.getElementById('travel-preview-summary').textContent.includes('1 Abschnitte'));
  x.enter('travel-q','3');assert.equal(x.document.getElementById('travel-preview-accept').disabled,true);assert.equal(x.document.getElementById('travel-preview-summary').textContent,'');
 }finally{x.cleanup();}
});
test('cancelling a preview while live input is flushing prevents later route acceptance',async()=>{
 const x=await travelFixture();try{
  x.preview();await until(()=>!x.document.getElementById('travel-preview-accept').disabled);x.holdBefore();x.document.getElementById('travel-preview-accept').click();await until(x.hasBefore);
  x.document.getElementById('travel-preview-cancel').click();x.releaseBefore();await tick();await tick();await x.ui.flushWorld();
  assert.equal(x.sent.length,0);assert.equal(x.store.sceneWorld(x.w.token,x.scene.id).journey,null);
 }finally{x.cleanup();}
});
test('ordinary current travel preview is still accepted through the real writer',async()=>{
 const x=await travelFixture();try{
  x.preview();await until(()=>!x.document.getElementById('travel-preview-accept').disabled);x.document.getElementById('travel-preview-accept').click();
  await until(()=>x.store.sceneWorld(x.w.token,x.scene.id).journey!==null);await tick();await tick();
  const j=x.store.sceneWorld(x.w.token,x.scene.id).journey;assert.equal(j.status,'active');assert.equal(j.route.at(-1).q,1);assert.equal(x.sent.length,1);
  assert.equal(x.document.getElementById('travel-preview-dialog').open,false);
 }finally{x.cleanup();}
});
// Calendar events now use CampaignAgenda; its concurrent note edits and reopen
// are covered in tests/core/agenda-ui.test.ts through the actual event editor.
for (const field of ['world-map-name', 'hex-label', 'calendar-name', 'phen-notes']) test(`world flush preserves ${field} entered after the exact command snapshot`, async () => {
  const x = await fixture(); try {
    if (field === 'phen-notes') await x.select('phen-select', x.phenomenon.id);
    x.enter(field, 'Erste Eingabe'); x.hold(); const saving = x.ui.flushWorld(); await until(x.hasReply);
    x.enter(field, '  Weitere Eingabe\n'); const joining = x.ui.flushWorld(); assert.equal(x.writes, 1);
    x.release(); assert.equal(await saving, true); assert.equal(await joining, true);
    assert.equal(x.writes, 2);
    const read = () => { const world = x.store.world(x.w.token); return field === 'world-map-name' ? world.maps[0].name : field === 'hex-label' ? world.maps[0].cells[0].label : field === 'calendar-name' ? world.calendar.name : world.phenomena[0].notes; };
    assert.equal(read(), '  Weitere Eingabe\n');
    await x.ui.openWorld(); if (field === 'phen-notes') await x.select('phen-select', x.phenomenon.id);
    assert.equal(x.document.getElementById(field).value, '  Weitere Eingabe\n');
    const first = x.sent[0].action, second = x.sent[1].action;
    assert.equal(second.expectedRevision, first.expectedRevision + 1);
  } finally { x.cleanup(); }
});
test('switching campaigns during live-input drainage cancels the captured old world write', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Alte offene Eingabe'); x.holdBefore(); const saving = x.ui.flushWorld(); await until(x.hasBefore);
    const next = x.store.create('Andere Welt'), w = x.store.activate(next.id); x.ui.activateWorld(w); await x.ui.openWorld();
    x.releaseBefore(); assert.equal(await saving, false); assert.equal(x.writes, 0);
    assert.equal(x.store.world(w.token).maps.length, 1);
    assert.notEqual(x.store.world(w.token).maps[0].id, x.map.id);
    const previous = x.store.activate(x.campaign.id); assert.equal(x.store.world(previous.token).maps[0].name, 'Region');
  } finally { x.cleanup(); }
});
test('an old world display rejection cannot overwrite the current campaign display', async () => {
  const x = await fixture(); try {
    const read = x.window.campaign.sceneWorld; let release;
    x.window.campaign.sceneWorld = async () => new Promise(resolve => { release = resolve; });
    const old = x.ui.renderLiveWorld(x.w.token, x.scene.id); await until(() => !!release);
    const next = x.store.create('Andere Welt'), w = x.store.activate(next.id);
    const scene = x.store.executeLive({ commandId: randomUUID(), campaignId: next.id, token: w.token, action: { kind: 'initialize', expectedRosterRevision: x.store.live(w.token).rosterRevision } }).scene;
    x.ui.activateWorld(w); x.window.campaign.sceneWorld = read; await x.ui.renderLiveWorld(w.token, scene.id);
    const visible = x.document.getElementById('live-world-summary').textContent; assert.ok(visible);
    release({ ok: false, error: 'Verspäteter Fehler der alten Kampagne' }); await old;
    assert.equal(x.document.getElementById('live-world-summary').textContent, visible);
  } finally { x.cleanup(); }
});

test('world command captures its fields before draining unrelated live input', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Erster Stand'); x.holdBefore(); const saving = x.ui.flushWorld(); await until(x.hasBefore);
    x.enter('world-map-name', 'Späterer Stand'); x.releaseBefore(); assert.equal(await saving, true);
    assert.deepEqual(x.sent.map(c => c.action.map.name), ['Erster Stand', 'Späterer Stand']);
    assert.equal(x.store.world(x.w.token).maps[0].name, 'Späterer Stand');
  } finally { x.cleanup(); }
});
test('an old committed reply cannot adopt old world state or release a new campaign flush', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Bestätigt in alter Kampagne'); x.hold(); const saving = x.ui.flushWorld(); await until(x.hasReply);
    const next = x.store.create('Andere Welt'), w = x.store.activate(next.id); x.ui.activateWorld(w); await x.ui.openWorld();
    x.enter('calendar-name', 'Neuer eigener Kalender'); assert.equal(await x.ui.flushWorld(), true);
    x.release(); assert.equal(await saving, false);
    assert.equal(x.store.world(w.token).maps.length, 1);
    assert.notEqual(x.store.world(w.token).maps[0].id, x.map.id); assert.equal(x.store.world(w.token).calendar.name, 'Neuer eigener Kalender');
    await x.ui.openWorld(); assert.equal(x.document.getElementById('calendar-name').value, 'Neuer eigener Kalender');
    const previous = x.store.activate(x.campaign.id); assert.equal(x.store.world(previous.token).maps[0].name, 'Bestätigt in alter Kampagne');
  } finally { x.cleanup(); }
});
test('a later invalid world input keeps navigation blocked and the confirmed first snapshot intact', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Bestätigter Stand'); x.hold(); const saving = x.ui.flushWorld(); await until(x.hasReply);
    x.enter('world-map-name', ''); x.release(); assert.equal(await saving, false);
    assert.equal(x.document.getElementById('world-map-name').value, ''); assert.equal(x.store.world(x.w.token).maps[0].name, 'Bestätigter Stand');
  } finally { x.cleanup(); }
});


for (const phase of ['before-commit', 'after-commit']) test(`lost world reply ${phase} blocks replay until explicit read-only clarification`, async () => {
  const x = await fixture(); try {
    const write = x.window.campaign.executeWorld;
    const initialAtlasCommands=x.store.db.prepare('SELECT COUNT(*) AS n FROM atlas_command').get().n;
    let attempts = 0;
    x.window.campaign.executeWorld = async command => { attempts++; if (phase === 'after-commit') await write(command); throw new Error('Kontrollierter Antwortverlust'); };
    x.enter('world-map-name', 'Ungeklärter Stand'); assert.equal(await x.ui.flushWorld(), false);
    x.enter('world-map-name', 'Spätere Eingabe'); assert.equal(await x.ui.flushWorld(), false); assert.equal(attempts, 1);
    assert.equal(x.document.getElementById('world-write-recovery').hidden, false);
    const before = Object.fromEntries(['world_record', 'world_receipt', 'world_history', 'campaign_atlas', 'atlas_command', 'atlas_receipt'].map(t => [t, x.store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));
    x.document.getElementById('world-write-check').click(); await until(() => x.document.getElementById('world-write-recovery').hidden);
    for (const t of Object.keys(before)) assert.deepEqual(x.store.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all(), before[t]);
    assert.equal(x.document.getElementById('world-map-name').value, 'Spätere Eingabe'); assert.equal(attempts, 1);
    x.window.campaign.executeWorld = write; assert.equal(await x.ui.flushWorld(), true);
    assert.equal(x.store.world(x.w.token).maps[0].name, 'Spätere Eingabe');
    assert.equal(x.store.db.prepare('SELECT COUNT(*) AS n FROM atlas_command').get().n-initialAtlasCommands,phase==='after-commit'?2:1);
  } finally { x.cleanup(); }
});
test('world clarification refuses mismatched fingerprint, corrupt receipt and foreign campaign authority', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Neue Region'); assert.equal(await x.ui.flushWorld(), true); const command = x.sent[0];
    const before = x.store.db.prepare('SELECT * FROM world_receipt WHERE command_id=?').get(command.commandId);
    assert.equal(x.store.reconcileWorld(command, x.w.token).outcome, 'applied');
    assert.throws(() => x.store.reconcileWorld({ ...command, action: { ...command.action, map: { ...command.action.map, name: 'Andere Eingabe' } } }, x.w.token), /anders verwendet/);
    x.store.db.prepare("UPDATE world_receipt SET checksum='bad' WHERE command_id=?").run(command.commandId);
    assert.throws(() => x.store.reconcileWorld(command, x.w.token));
    const damaged = x.store.db.prepare('SELECT * FROM world_receipt WHERE command_id=?').get(command.commandId);
    assert.equal(damaged.payload, before.payload);
    const next = x.store.create('Fremd'), w = x.store.activate(next.id); assert.throws(() => x.store.reconcileWorld(command, w.token));
    assert.deepEqual(x.store.db.prepare('SELECT * FROM world_receipt WHERE command_id=?').get(command.commandId), damaged);
  } finally { x.cleanup(); }
});


test('navigation drainage waits for a non-editor world action before granting close', async () => {
  const x = await fixture(); try {
    const location={kind:'location',version:1,id:randomUUID(),name:'Reiseziel',type:'poi',sections:[],detailMaps:[],keyLinks:[]};
    x.store.changePreparation({commandId:randomUUID(),token:x.w.token,campaignId:x.campaign.id,change:{kind:'location',expectedRevision:null,document:location}});
    await x.ui.openWorld();await x.select('world-anchor-location',location.id);
    x.hold(); x.document.getElementById('world-anchor-save').click(); await until(x.hasReply);
    let completed = false;
    const closing = x.ui.flushWorld().then(result => { completed = true; return result; });
    await tick(); assert.equal(completed, false);
    x.release(); assert.equal(await closing, true); await tick(); await tick();
    assert.equal(x.store.world(x.w.token).places.length, 1); assert.equal(x.writes, 1);
  } finally { x.cleanup(); }
});
test('a confirmed lost reply without later edits grants close after clarification without another write', async () => {
  const x = await fixture(); try {
    const write = x.window.campaign.executeWorld;
    x.window.campaign.executeWorld = async c => { await write(c); throw new Error('Kontrollierter Antwortverlust'); };
    x.enter('calendar-name', 'Bestätigter Kalender'); assert.equal(await x.ui.flushWorld(), false);
    assert.equal(await x.ui.reconcileWorldWrite(), true); const writes = x.writes;
    assert.equal(await x.ui.flushWorld(), true); assert.equal(x.writes, writes);
    assert.equal(x.store.world(x.w.token).calendar.name, 'Bestätigter Kalender');
  } finally { x.cleanup(); }
});


test('native blur change after acknowledged input does not generate a redundant world revision', async () => {
  const x = await fixture(); try {
    x.enter('world-map-name', 'Bestätigter Wert'); assert.equal(await x.ui.flushWorld(), true); const writes = x.writes;
    x.document.getElementById('world-map-name').dispatchEvent(new x.window.Event('change', { bubbles: true }));
    assert.equal(await x.ui.flushWorld(), true); assert.equal(x.writes, writes);
    assert.ok(!x.statuses.includes('Welt und Reise gespeichert.'));
  } finally { x.cleanup(); }
});


test('semantic receipt damage with matching hash cannot adopt an absent acknowledged editor target', async () => {
  const x = await fixture(); try {
    const write = x.window.campaign.executeWorld;
    x.window.campaign.executeWorld = async c => { await write(c); throw new Error('Kontrollierter Antwortverlust'); };
    x.enter('world-map-name', 'Bestätigter Stand'); assert.equal(await x.ui.flushWorld(), false);
    const command = x.sent[0], row = x.store.db.prepare('SELECT * FROM world_receipt WHERE command_id=?').get(command.commandId), ack = JSON.parse(row.payload); ack.world.maps = [];
    const payload = JSON.stringify(ack), checksum = createHash('sha256').update(payload).digest('hex');
    x.store.db.prepare('UPDATE world_receipt SET payload=?,checksum=? WHERE command_id=?').run(payload,checksum,command.commandId);
    assert.throws(()=>x.store.reconcileWorld(command,x.w.token),/widerspricht/);
    assert.equal(await x.ui.reconcileWorldWrite(),false); assert.equal(x.document.getElementById('world-write-recovery').hidden,false);
    assert.equal(x.document.getElementById('world-map-name').value,'Bestätigter Stand');
    assert.equal(x.store.db.prepare('SELECT payload FROM world_receipt WHERE command_id=?').get(command.commandId).payload,payload);
  } finally { x.cleanup(); }
});
