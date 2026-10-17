import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseHTML } from 'linkedom';
buildSync({ stdin: {contents: "export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui'; export * from './src/app/world-ui';",resolveDir:process.cwd()}, outfile: '.build/atlas-context-ui.cjs', bundle: true, platform: 'node', format: 'cjs' });
buildSync({ entryPoints: ['src/app/storage/store.ts'], outfile: '.build/atlas-context-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
const require = createRequire(import.meta.url), worldUI = require('../.build/atlas-context-ui.cjs'), { CampaignAtlasWorkbench } = worldUI, { CampaignStore } = require('../.build/atlas-context-store.cjs');
function fixture(t) {
    const dir = mkdtempSync(tmpdir() + '/atlas-context-'), store = new CampaignStore(dir + '/world.sqlite'), campaign = store.create('Reise'), w = store.activate(campaign.id), command = action => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
    const a = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision })).scene;
    const character = store.executeLive(command({ kind: 'create-character', profile: { name: 'Ada', speedFeet: 30 } })).character, live = store.live(w.token);
    store.executeLive(command({ kind: 'membership', characterId: character.id, expectedRevision: character.membershipRevision, expectedRosterRevision: live.rosterRevision, active: true, targetSceneId: a.id, expectedFocusRevision: live.focusRevision }));
    const beforeGlobals = { window: globalThis.window, document: globalThis.document, Event:globalThis.Event, CustomEvent:globalThis.CustomEvent };
    const { window, document } = parseHTML(readFileSync('src/app/index.html','utf8')+'<div id="atlas-advanced-fields"></div><p id="atlas-local-status"></p><p id="atlas-save-status"></p><p id="atlas-hint"></p><button id="atlas-region-retry"></button><div id="atlas-entrance-field"></div><select id="atlas-entrance-choice"></select>' + ['start', 'preview', 'refresh', 'place', 'entrance', 'step', 'round', 'play', 'pause', 'end'].map(k => `<button id="atlas-local-${k}"></button>`).join(''));
    Object.assign(globalThis, { window, document, Event:window.Event, CustomEvent:window.CustomEvent });
    for (const select of document.querySelectorAll('select'))
        Object.defineProperty(select, 'value', { value: '', writable: true });
    const sent = [];
    const snapshot=()=>({...store.atlasRenderView(w.token),region:{coverage:{mode:'detail',unreadable:0}}});
    window.campaign = { cancelAtlasRegion:async()=>({ok:true,value:null}),atlasRegion: async () => ({ ok: true, value: snapshot() }), previewAtlasTravel: async (token, end) => ({ ok: true, value: store.previewAtlasTravel(token, end) }), executeAtlasTravelCommit: async (c) => { sent.push(c); return { ok: true, value: store.executeAtlasTravelCommit(c) }; } };
    // Exercise the production controller/render methods with real SQLite snapshots.
    // Whole-workbench mounting and click wiring are covered by the native probe.
    const ui = Object.assign(Object.create(CampaignAtlasWorkbench.prototype), { owner: w, data: snapshot(), root: document.createElement('section'),svg:document.createElement('svg'),regionQuery:()=>({box:{x:0,y:0,width:100,height:100},width:1024,height:768,scopeId:'local',floorId:'ground',slice:null,roofs:true}), request: 0, hitVersion:0,hitDialog:{open:true,close(){this.open=false;}},landscape:{load:async()=>{}}, previewRequest: 0, busy: false, pendingTravel: null, localPreview: null, lastPoint: { x: 20, y: 0 }, entranceId: null, travelReadState: 'ready', family: 'travel', playback: { running: false, stop() { }, async settled() { } }, opts: { status() { } } });
    ui.render = () => ui.renderTravel();
    ui.render();
    t.after(() => { Object.assign(globalThis, beforeGlobals); store.close(); rmSync(dir, { recursive: true, force: true }); });
    return { ui, store, w, a, command, sent, document, window, get: id => document.getElementById('atlas-local-' + id) };
}
test('pending and failed Atlas context reads revoke previews and block travel; retry remains read-only', async (t) => {
    const x = fixture(t);
    await x.ui.travelControl('preview');
    assert.equal(x.get('start').disabled, false);
    let release;
    window.campaign.atlasRegion = () => new Promise(r => release = r);
    const before = x.store.db.serialize(), read = x.ui.refresh();
    assert.equal(x.get('start').disabled, true);
    assert.equal(x.ui.hitDialog.open,false,'pending source refresh closes the old exact-choice dialog');
    assert.equal(x.get('place').disabled, true);
    assert.equal(document.getElementById('atlas-advanced-fields').inert, true);
    assert.match(x.get('status').textContent, /geladen/);
    await x.ui.travelControl('start');
    assert.equal(x.sent.length, 0);
    release({ ok: false, error: 'Datenträger nicht lesbar' });
    await read;
    assert.equal(x.get('start').disabled, true);
    assert.equal(x.get('place').disabled, true);
    assert.equal(x.get('refresh').hidden, false);
    assert.match(x.get('status').textContent, /nicht verfügbar/);
    window.campaign.atlasRegion = async () => ({ ok: true, value: {...x.store.atlasRenderView(x.w.token),region:{coverage:{mode:'detail',unreadable:0}}} });
    await x.ui.refresh();
    assert.equal(x.get('place').disabled, false);
    assert.equal(document.getElementById('atlas-advanced-fields').inert, false);
    assert.equal(x.get('start').disabled, true);
    assert.equal(x.get('refresh').hidden, true);
    assert.equal(x.ui.localPreview, null);
    assert.ok(x.store.db.serialize().equals(before));
});
test('late local preview cannot reappear after a confirmed focus refresh', async (t) => {
    const x = fixture(t);
    let release;
    const preview = x.store.previewAtlasTravel(x.w.token, { x: 20, y: 0 });
    window.campaign.previewAtlasTravel = () => new Promise(r => release = r);
    const old = x.ui.travelControl('preview');
    await new Promise(setImmediate);
    const pc = x.store.executeLive(x.command({ kind: 'create-character', profile: { name: 'Bela', speedFeet: 30 } })).character;
    let live = x.store.live(x.w.token);
    x.store.executeLive(x.command({ kind: 'membership', characterId: pc.id, expectedRevision: pc.membershipRevision, expectedRosterRevision: live.rosterRevision, active: true, targetSceneId: x.a.id, expectedFocusRevision: live.focusRevision }));
    live = x.store.live(x.w.token);
    const scene = x.store.liveScene(x.w.token, x.a.id);
    const b = x.store.executeLive(x.command({ kind: 'move', sceneId: x.a.id, expectedRosterRevision: live.rosterRevision, expectedFocusRevision: live.focusRevision, expectedClockRevision: scene.clock.revision, expectedSceneMembershipRevision: scene.membershipRevision, memberIds: [pc.id], target: { kind: 'new', title: 'Nachhut', expectedContentRevision: scene.revision } })).session.createdScene;
    x.store.executeLive(x.command({ kind: 'focus', sceneId: b.id, expectedRevision: x.store.live(x.w.token).focusRevision }));
    const other = {...x.store.atlasRenderView(x.w.token),region:{coverage:{mode:'detail',unreadable:0}}}, afterFocus = x.store.db.serialize();
    window.campaign.atlasRegion = async () => ({ ok: true, value: other });
    await x.ui.refresh();
    release({ ok: true, value: preview });
    await old;
    assert.equal(x.ui.localPreview, null);
    assert.equal(x.get('start').disabled, true);
    assert.doesNotMatch(x.get('status').textContent, /geprüfte Vorschau/);
    assert.ok(x.store.db.serialize().equals(afterFocus));
});
test('obsolete context failure cannot lock a newer confirmed context', async (t) => {
    const x = fixture(t);
    let release;
    window.campaign.atlasRegion = () => new Promise(r => release = r);
    const old = x.ui.refresh();
    window.campaign.atlasRegion = async () => ({ ok: true, value: {...x.store.atlasRenderView(x.w.token),region:{coverage:{mode:'detail',unreadable:0}}} });
    await x.ui.refresh();
    release({ ok: false, error: 'Veralteter Fehler' });
    await old;
    assert.equal(x.get('place').disabled, false);
    assert.doesNotMatch(x.get('status').textContent, /Veralteter Fehler/);
});
test('an absent focused scene disables the whole Atlas travel console without creating a replacement', async (t) => {
    const x = fixture(t), empty = structuredClone(x.ui.data), before = x.store.db.serialize();
    empty.scene = null;
    empty.geometry.sceneId = null;
    window.campaign.atlasRegion = async () => ({ ok: true, value: empty });
    await x.ui.refresh();
    for (const k of ['preview', 'place', 'start', 'step', 'round', 'play', 'pause', 'end', 'entrance'])
        assert.equal(x.get(k).disabled, true, k);
    assert.match(x.get('status').textContent, /Fokusgruppe/);
    assert.ok(x.store.db.serialize().equals(before));
});
test('a preview for another focused scene is rejected even without an observed refresh', async (t) => {
    const x = fixture(t), preview = x.store.previewAtlasTravel(x.w.token, { x: 20, y: 0 }), before = x.store.db.serialize();
    preview.sceneId = randomUUID();
    window.campaign.previewAtlasTravel = async () => ({ ok: true, value: preview });
    await x.ui.travelControl('preview');
    assert.equal(x.ui.localPreview, null);
    assert.equal(x.get('start').disabled, true);
    assert.match(document.getElementById('atlas-save-status').textContent, /Fokusgruppe/);
    assert.equal(x.get('refresh').hidden, false);
    assert.ok(x.store.db.serialize().equals(before));
});
test('leaving the Atlas revokes a pending local preview without a write', async (t) => {
    const x = fixture(t);
    let release;
    const preview = x.store.previewAtlasTravel(x.w.token, { x: 20, y: 0 }), before = x.store.db.serialize();
    window.campaign.previewAtlasTravel = () => new Promise(r => release = r);
    const old = x.ui.travelControl('preview');
    await new Promise(setImmediate);
    x.ui.hide();
    release({ ok: true, value: preview });
    await old;
    assert.equal(x.ui.localPreview, null);
    assert.equal(x.sent.length, 0);
    assert.ok(x.store.db.serialize().equals(before));
});

test('reevaluating an existing local preview disables its old start until the new answer arrives', async t => {
    const x = fixture(t);
    await x.ui.travelControl('preview');
    assert.equal(x.get('start').disabled, false);
    let release;
    const preview = x.store.previewAtlasTravel(x.w.token, {x: 20, y: 0}), before = x.store.db.serialize();
    window.campaign.previewAtlasTravel = () => new Promise(r => release = r);
    const read = x.ui.travelControl('preview');
    await new Promise(setImmediate);
    assert.equal(x.get('start').disabled, true);
    await x.ui.travelControl('start');
    assert.equal(x.sent.length, 0);
    release({ok: true, value: preview});
    await read;
    assert.equal(x.get('start').disabled, false);
    assert.ok(x.store.db.serialize().equals(before));
});

const tick=()=>new Promise(setImmediate);
async function until(check){for(let i=0;i<100&&!check();i++)await tick();assert.ok(check(),'Expected travel state did not arrive');}
test('Atlas long-distance preview exposes duration and starts the same world journey; a changed target revokes it',async t=>{
 const x=fixture(t),response=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 Object.assign(x.window.campaign,{
  world:async token=>response(()=>x.store.world(token)),preparation:async token=>response(()=>x.store.preparation(token)),live:async token=>response(()=>x.store.live(token)),sceneWorld:async(token,id)=>response(()=>x.store.sceneWorld(token,id)),previewTravel:async(token,request)=>response(()=>x.store.previewTravel(token,request)),
  executeWorld:async c=>{x.sent.push(c);return response(()=>x.store.executeWorld(c));}
 });
 const map=x.store.world(x.w.token).maps[0];x.store.executeWorld(x.command({kind:'place-scene',sceneId:x.a.id,position:{mapId:map.id,q:0,r:0,locationId:null},expectedSceneRevision:x.a.revision,expectedPositionRevision:0}));x.ui.data={...x.store.atlasRenderView(x.w.token),region:{coverage:{mode:'detail',unreadable:0}}};
 worldUI.initWorld(()=>{},async()=>true,async()=>{},async()=>{});
 for(const select of x.document.querySelectorAll('select'))if(!Object.getOwnPropertyDescriptor(select,'value')?.writable)Object.defineProperty(select,'value',{value:'',writable:true});
 for(const d of x.document.querySelectorAll('dialog')){d.open=false;d.showModal=()=>{d.open=true;};d.close=()=>{d.open=false;};}
 worldUI.activateWorld(x.w);await worldUI.openWorld();worldUI.setWorldSurface('atlas');
 x.document.getElementById('world-journey-console').scrollIntoView=()=>{throw new Error('Hidden world transport must not steal the Atlas viewport');};
 try {
 const field=(id,value)=>{const e=x.document.getElementById(id);e.value=value;e.dispatchEvent(new x.window.Event('input',{bubbles:true}));};
 field('travel-pace','4.8');field('travel-factor','1');field('travel-final-hours','');
 x.ui.lastPoint={x:20000,y:0};worldUI.atlasWorldTarget({q:4,r:0});
 const before=x.store.db.serialize();await x.ui.travelControl('preview');await until(()=>worldUI.atlasWorldTravelState().preview);x.ui.renderTravel();
 assert.equal(x.document.getElementById('travel-preview-dialog').open,false,'Atlas evaluation must stay in its visible console');
 assert.equal(x.get('start').disabled,false);assert.match(x.get('status').textContent,/km.*h.*Ankunft/);
 const owner=x.ui.owner;x.ui.owner={...owner,token:'other-campaign'};x.ui.renderTravel();assert.equal(x.get('start').disabled,true);x.ui.owner=owner;
 const sceneId=x.ui.data.geometry.sceneId;x.ui.data.geometry.sceneId='other-scene';x.ui.renderTravel();assert.equal(x.get('start').disabled,true);x.ui.data.geometry.sceneId=sceneId;x.ui.renderTravel();assert.ok(x.store.db.serialize().equals(before));
 worldUI.atlasWorldTarget({q:3,r:0});x.ui.renderTravel();assert.equal(x.get('start').disabled,true);
 await x.ui.travelControl('preview');await until(()=>worldUI.atlasWorldTravelState().preview);x.ui.renderTravel();
 await x.ui.travelControl('start');await until(()=>x.sent.some(c=>c.action.kind==='journey'));assert.match(x.document.getElementById('journey-playback-status').textContent,/Wiedergabe 1/);await worldUI.stopWorldPlayback();
 const starts=x.sent.filter(c=>c.action.kind==='journey');assert.equal(starts.length,1);assert.deepEqual(starts[0].action.preview.request.destination,{q:3,r:0});assert.equal(starts[0].action.preview.request.sceneId,x.a.id);
 const scene=x.store.sceneWorld(x.w.token,x.a.id);assert.ok(scene.journey);assert.equal(scene.journey.route.at(-1).q,3);
 } finally {await worldUI.stopWorldPlayback();}
});

test('a delayed click after a geometry drag stays suppressed until the next actual pointer press',async()=>{
 const ui=Object.create(CampaignAtlasWorkbench.prototype);ui.suppressClick();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(ui.ignoreClick,true,'native drag completion can deliver its click after a zero-delay timer');
 await ui.click({});assert.equal(ui.ignoreClick,false,'the generated click is consumed before any selection/read');
 ui.suppressClick();ui.down({button:1});assert.equal(ui.ignoreClick,false,'a new pointer press starts an independent gesture even if no click followed the drag');
});

test('a visible drawing glyph selects its exact source ID even beyond the canonical point-pick radius',async()=>{
 const chosen=[],ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{family:'navigation',entranceDraft:null,root:{dataset:{}},camera:{ready:true,hitAt:()=>({dataset:{kind:'element',id:'glyph'}})},point:()=>({x:20,y:0}),geometryCurrent:()=>true,navigateElement:async id=>chosen.push(id),chooseAt:async()=>chosen.push('point-radius')});
 await ui.click({button:0,altKey:false});assert.deepEqual(chosen,['glyph'],'visual glyph hit must keep the existing exact-ID navigation/read path');
});

test('a press rejected during saving cannot become a selection after saving completes',async()=>{
 const chosen=[],ui=Object.assign(Object.create(CampaignAtlasWorkbench.prototype),{busy:true,family:'navigation',root:{dataset:{}},entranceDraft:null,camera:{ready:true,hitAt:()=>null},geometryCurrent:()=>true,point:()=>({x:0,y:0}),chooseAt:async()=>chosen.push('unexpected')});
 ui.down({button:0,altKey:false});ui.busy=false;await ui.click({button:0,altKey:false});
 assert.deepEqual(chosen,[],'release belongs to the rejected press, even if its write has finished');
});
