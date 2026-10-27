import {attachAtlasAuthorRecovery} from './helpers/atlas-author-recovery.mjs';
import {atlasFixture} from './helpers/atlas-workbench.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from './helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseHTML } from './helpers/dom.mjs';
buildSync({ stdin: {contents: "export {atlasWriteReference} from './src/app/atlas-write-recovery'; export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui'; export * from './src/app/world-ui';",resolveDir:process.cwd()}, outfile: '.build/atlas-context-ui.cjs', bundle: true, platform: 'node', format: 'cjs' });
buildSync({ entryPoints: ['src/app/storage/store.ts'], outfile: '.build/atlas-context-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
const require = createRequire(import.meta.url), worldUI = require('../.build/atlas-context-ui.cjs'), { CampaignAtlasWorkbench } = worldUI, { CampaignStore } = require('../.build/atlas-context-store.cjs');
function fixture(t) {
    const dir = mkdtempSync(tmpdir() + '/atlas-context-'), store = new CampaignStore(dir + '/world.sqlite'), campaign = store.create('Reise'), w = store.activate(campaign.id), command = action => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
    store.executeAtlasCommit(command({kind:'landscape-put',record:{id:randomUUID(),revision:0,kind:'patch',name:'Testland',points:[],polygons:[{outer:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}],holes:[]}],resolution:1,width:0,values:{terrain:'plains'}},expectedRevision:null}));
    const a = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision })).scene;
    const character = store.executeLive(command({ kind: 'create-character', profile: { name: 'Ada', speedFeet: 30 } })).character, live = store.live(w.token);
    store.executeLive(command({ kind: 'membership', characterId: character.id, expectedRevision: character.membershipRevision, expectedRosterRevision: live.rosterRevision, active: true, targetSceneId: a.id, expectedFocusRevision: live.focusRevision }));
    const beforeGlobals = { window: globalThis.window, document: globalThis.document, Event:globalThis.Event, CustomEvent:globalThis.CustomEvent };
    const { window, document } = parseHTML(readFileSync('src/app/index.html','utf8')+'<div id="atlas-context-fields"></div><p id="atlas-local-status"></p><p id="atlas-save-status"></p><button id="atlas-recover"></button><p id="atlas-hint"></p><button id="atlas-region-retry"></button><div id="atlas-entrance-field"></div><select id="atlas-entrance-choice"></select>' + ['start', 'preview', 'refresh', 'place', 'entrance', 'step', 'round', 'play', 'pause', 'end'].map(k => `<button id="atlas-local-${k}"></button>`).join(''));
    Object.assign(globalThis, { window, document, Event:window.Event, CustomEvent:window.CustomEvent });
    for (const select of document.querySelectorAll('select'))
        Object.defineProperty(select, 'value', { value: '', writable: true });
    const sent = [];
    const snapshot=()=>({...store.atlasRenderView(w.token),region:{coverage:{mode:'detail',unreadable:0}}});
    window.campaign = { cancelAtlasRegion:async()=>({ok:true,value:null}),atlasRegion: async () => ({ ok: true, value: snapshot() }), previewAtlasTravel: async (token, end) => ({ ok: true, value: store.previewAtlasTravel(token, end) }), executeAtlasTravelCommit: async (c) => { sent.push(c); return { ok: true, value: store.executeAtlasTravelCommit(c) }; } };
    attachAtlasAuthorRecovery(window.campaign,store,dir);
    // Exercise the production controller/render methods with real SQLite snapshots.
    // Whole-workbench mounting and click wiring are covered by the native probe.
    const ui = Object.assign(atlasFixture(CampaignAtlasWorkbench), { owner: w, data: snapshot(), root: document.createElement('section'),svg:document.createElement('svg'),regionQuery:()=>({box:{x:0,y:0,width:100,height:100},width:1024,height:768,scopeId:'local',floorId:'ground',slice:null,roofs:true}), request: 0, hitVersion:0,hitDialog:{open:true,close(){this.open=false;}},landscape:{load:async()=>{},contours:()=>0}, previewRequest: 0, busy: false, pendingTravel: null, localPreview: null, lastPoint: { x: 20, y: 0 }, entranceId: null, travelReadState: 'ready', family: 'travel', playback: { running: false, stop() { }, async settled() { } }, opts: { status() { } } });
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
    assert.equal(document.getElementById('atlas-context-fields').inert, true);
    assert.equal(document.getElementById('atlas-entrance-choice').disabled, true);
    assert.match(x.get('status').textContent, /geladen/);
    await x.ui.travelControl('start');
    assert.equal(x.sent.length, 0);
    release({ ok: false, error: 'Datenträger nicht lesbar' });
    await read;
    assert.equal(x.get('start').disabled, true);
    assert.equal(x.get('place').disabled, true);
    assert.equal(x.get('refresh').hidden, false);
    assert.match(x.get('status').textContent, /nicht verfügbar/);
    assert.equal(document.getElementById('atlas-entrance-choice').disabled, true);
    window.campaign.atlasRegion = async () => ({ ok: true, value: {...x.store.atlasRenderView(x.w.token),region:{coverage:{mode:'detail',unreadable:0}}} });
    await x.ui.refresh();
    assert.equal(x.get('place').disabled, false);
    assert.equal(document.getElementById('atlas-context-fields').inert, false);
    assert.equal(document.getElementById('atlas-entrance-choice').disabled, false);
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
 const ui=atlasFixture(CampaignAtlasWorkbench);ui.suppressClick();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(ui.ignoreClick,true,'native drag completion can deliver its click after a zero-delay timer');
 await ui.click({});assert.equal(ui.ignoreClick,false,'the generated click is consumed before any selection/read');
 ui.suppressClick();ui.down({button:1});assert.equal(ui.ignoreClick,false,'a new pointer press starts an independent gesture even if no click followed the drag');
});

test('a visible drawing glyph joins the candidate picker even beyond the canonical point-pick radius',async()=>{
 const chosen=[],ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{family:'navigation',entranceDraft:null,root:{dataset:{}},camera:{ready:true,hitAt:()=>({data:{kind:'element',id:'glyph'}})},point:()=>({x:20,y:0}),geometryCurrent:()=>true,navigateElement:async id=>chosen.push(id),chooseAt:async(p,layer,id)=>chosen.push({p,layer,id})});
 await ui.click({button:0,altKey:false});assert.deepEqual(chosen,[{p:{x:20,y:0},layer:'all',id:'glyph'}],'a glyph must not silently outrank overlapping rooms and landscape');
});

test('a press rejected during saving cannot become a selection after saving completes',async()=>{
 const chosen=[],ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{busy:true,family:'navigation',root:{dataset:{}},entranceDraft:null,camera:{ready:true,hitAt:()=>null},geometryCurrent:()=>true,point:()=>({x:0,y:0}),chooseAt:async()=>chosen.push('unexpected')});
 ui.down({button:0,altKey:false});ui.busy=false;await ui.click({button:0,altKey:false});
 assert.deepEqual(chosen,[],'release belongs to the rejected press, even if its write has finished');
});


test('camera input preserves useful buffered reads and replaces obsolete destinations before completion',async t=>{
 const original={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};t.after(()=>Object.assign(global,original));let now=0,id=0;const jobs=new Map(),reads=[];
 global.setTimeout=(run,delay)=>{jobs.set(++id,{run,at:now+delay});return id;};global.clearTimeout=id=>jobs.delete(id);
 const advance=ms=>{now+=ms;for(const [id,job]of [...jobs])if(job.at<=now){jobs.delete(id);job.run();}};
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:{hidden:false,dataset:{}},owner:{token:'t'},svg:{setAttribute(){}},geometryCurrent:()=>false,refresh:async keepScene=>reads.push(keepScene),request:0});
 ui.scheduleRegion(true);advance(90);assert.deepEqual(reads,[]);ui.scheduleRegion(true);advance(40);assert.deepEqual(reads,[true],'continuous input must not starve loading');assert.equal(jobs.size,0);assert.equal(ui.root.dataset.regionState,'loading');
 const q={box:{x:0,y:0,width:100,height:80},width:100,height:80,scopeId:'local',floorId:'ground',slice:null,roofs:true};
 ui.regionQuery=()=>q;ui.camera={destination:{...q.box,x:20}};ui.regionReading=ui.request;
 ui.regionReadingQuery={...q,box:{x:-50,y:-40,width:200,height:160},width:200,height:160};
 ui.scheduleRegion(true);advance(200);assert.deepEqual(reads,[true],'panning within the buffer must preserve useful work');assert.equal(ui.request,0);
 ui.camera.destination={...q.box,width:50,height:40};ui.scheduleRegion(true);advance(90);ui.scheduleRegion(true);advance(40);assert.deepEqual(reads,[true,true],'a scale change must reach the busy worker without waiting for the old answer');
 ui.camera.destination={...q.box,x:500};ui.scheduleRegion(true);advance(120);assert.deepEqual(reads,[true,true,true],'leaving the buffer replaces an obsolete pan request');
 ui.camera.destination=q.box;ui.scheduleRegion(false);assert.equal(ui.request,1,'a source/filter change must invalidate the earlier reply');advance(60);assert.deepEqual(reads,[true,true,true,false]);
});

test('camera refresh preserves a checked local route only after the identical source is confirmed',async t=>{
 const x=fixture(t);x.ui.data.region.fence='confirmed-source';await x.ui.travelControl('preview');const preview=x.ui.localPreview;assert(preview);
 let release;window.campaign.atlasRegion=()=>new Promise(r=>release=r);const pending=x.ui.refresh(true);assert.equal(x.get('start').disabled,true);assert.equal(x.ui.localPreview,null);
 release({ok:true,value:{...x.store.atlasRenderView(x.w.token),region:{fence:'confirmed-source',coverage:{mode:'detail',unreadable:0}}}});await pending;
 assert.equal(x.ui.localPreview,preview);assert.equal(x.get('start').disabled,false);
 window.campaign.atlasRegion=async()=>({ok:true,value:{...x.store.atlasRenderView(x.w.token),region:{fence:'new-source',coverage:{mode:'detail',unreadable:0}}}});await x.ui.refresh(true);
 assert.equal(x.ui.localPreview,null);assert.equal(x.get('start').disabled,true,'A source change must revoke the old checked route');assert.equal(x.sent.length,0);
});

test('leaving the Atlas revokes a late complete region response before reopening',async t=>{
 const x=fixture(t),before=x.ui.data;let release;window.campaign.atlasRegion=()=>new Promise(r=>release=r);
 const pending=x.ui.refresh(true);x.ui.hide();release({ok:true,value:{...before,revision:999,region:{fence:'late',coverage:{mode:'detail',unreadable:0}}}});await pending;
 assert.equal(x.ui.data,before);assert.equal(x.ui.loadedRegionQuery,null);assert.equal(x.ui.root.hidden,true);
});

test('camera reads predict the zoom destination while authoring still requires the displayed scale',t=>{
 const x=fixture(t);delete x.ui.regions.regionQuery;
 x.document.body.insertAdjacentHTML('beforeend','<input id="atlas-slice-enabled" type="checkbox"><input id="atlas-slice" value="0"><input id="atlas-roofs" type="checkbox"><input id="atlas-perception" type="checkbox">');
 Object.defineProperties(x.ui.svg,{clientWidth:{value:100},clientHeight:{value:80}});
 x.ui.camera={view:{x:0,y:0,width:100,height:80},destination:{x:-50,y:-40,width:200,height:160}};
 x.ui.scopeId='local';x.ui.floorId='ground';
 const q=x.ui.regionQuery(true);assert.deepEqual(q.box,{x:-150,y:-120,width:400,height:320});
 x.ui.loadedRegionQuery=q;assert(x.ui.geometryCoversView());assert.equal(x.ui.geometryCurrent(),false,'a preview is not permission to author stale geometry');
 x.ui.camera.view=x.ui.camera.destination;assert(x.ui.geometryCurrent());
 x.ui.landscape.contours=()=>50;assert.equal(x.ui.geometryCoversView(),false,'a different contour display needs a new region');x.ui.landscape.contours=()=>0;
 x.ui.floorId='other';assert.equal(x.ui.geometryCoversView(),false,'different floors never share a preview');
});

test('settling at a prefetched scale republishes constant-pixel author handles once',()=>{
 let renders=0;const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{root:{hidden:false,dataset:{regionState:'loading'}},owner:{token:'t'},svg:{setAttribute(){}},geometryCurrent:()=>true,scheduleRender:()=>renders++});
 ui.scheduleRegion(true);assert.equal(renders,1);assert.equal(ui.root.dataset.regionState,'ready');
 ui.scheduleRegion(true);assert.equal(renders,1,'an unchanged camera does not rebuild the scene repeatedly');
});

test('an obsolete camera rejection cannot fail or clear the newer pending view',async t=>{
 const x=fixture(t),replies=[],errors=[];
 x.ui.error=error=>errors.push(String(error));window.campaign.atlasRegion=()=>new Promise(resolve=>replies.push(resolve));
 const old=x.ui.refresh(true),firstQuery=x.ui.regionReadingQuery;
 const nextQuery={...firstQuery,box:{x:100,y:0,width:50,height:50}};x.ui.regionQuery=()=>nextQuery;
 const latest=x.ui.refresh(true),latestRequest=x.ui.request;
 replies[0]({ok:false,error:'Kartenausschnitt durch neuere Anfrage ersetzt.'});await old;
 assert.deepEqual(errors,[]);assert.equal(x.ui.root.dataset.regionState,'loading');assert.equal(x.ui.regionReading,latestRequest);assert.equal(x.ui.regionReadingQuery,nextQuery);
 replies[1]({ok:true,value:{...x.store.atlasRenderView(x.w.token),region:{fence:'current',coverage:{mode:'detail',unreadable:0}}}});await latest;
 assert.equal(x.ui.root.dataset.regionState,'ready');assert.equal(x.ui.regionReading,null);assert.equal(x.ui.regionReadingQuery,null);assert.equal(x.ui.loadedRegionQuery,nextQuery);assert.deepEqual(errors,[]);
});

test('terrain redraws preserve a matching pending region; only a real representation change replaces it',t=>{
 const x=fixture(t);
 const original={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};t.after(()=>Object.assign(global,original));
 let now=0,id=0,renders=0;const jobs=new Map(),reads=[];
 global.setTimeout=(run,delay)=>{jobs.set(++id,{run,at:now+delay});return id;};global.clearTimeout=id=>jobs.delete(id);
 const advance=ms=>{now+=ms;for(const [id,job]of [...jobs])if(job.at<=now){jobs.delete(id);job.run();}};
 let required=false;const q={box:{x:0,y:0,width:100,height:80},width:100,height:80,scopeId:null,floorId:'ground',slice:null,roofs:true,terrainRaster:false};
 const ui=Object.assign(x.ui,{
  root:{hidden:false,dataset:{regionState:'loading'}},owner:{token:'t'},svg:{setAttribute(){}},
  geometryCurrent:()=>false,refresh:async keep=>reads.push(keep),scheduleRender:()=>renders++,regionQuery:()=>({...q,terrainRaster:required}),
  request:4,regionReading:4,regionReadingQuery:q,loadedRegionQuery:null,
 });
 for(let n=0;n<6;n++){ui.redrawSpatial();advance(100);}
 assert.equal(renders,6);assert.equal(ui.request,4);assert.equal(jobs.size,0);assert.deepEqual(reads,[],'terrain refinements must not cancel an unchanged pending geometry read');
 assert.equal(ui.root.dataset.regionState,'loading','redraw does not authorize editing');
 required=true;ui.redrawSpatial();assert.equal(ui.request,5,'graphics fallback must invalidate the old representation');
 advance(40);ui.redrawSpatial();advance(25);assert.deepEqual(reads,[false],'subsequent redraws must not postpone the required replacement');
 ui.regionReading=5;ui.regionReadingQuery={...q,terrainRaster:true};required=false;ui.redrawSpatial();advance(60);assert.deepEqual(reads,[false,false],'graphics recovery also replaces a pending fallback read');
 ui.regionReading=null;ui.loadedRegionQuery={...q,terrainRaster:false};required=true;ui.redrawSpatial();advance(60);assert.deepEqual(reads,[false,false,false],'an already loaded representation must change as well');
 ui.loadedRegionQuery=null;ui.regionReadingQuery=null;ui.redrawSpatial();advance(100);assert.deepEqual(reads,[false,false,false],'opening/error ownership remains with its existing refresh/retry path');
});

test('stale terrain waits for an existing geometry owner without replacing or authorizing it',async t=>{
 const x=fixture(t);let release,reads=0;
 window.campaign.atlasRegion=()=>{reads++;return new Promise(resolve=>release=resolve);};
 const pending=x.ui.refresh(true),request=x.ui.request;
 assert.equal(await x.ui.refreshSpatialSource(),false);assert.equal(await x.ui.refreshSpatialSource(),false);
 assert.equal(reads,1);assert.equal(x.ui.request,request);assert.equal(x.ui.regionReading,request);
 assert.equal(x.ui.travelReadState,'loading');assert.equal(x.ui.root.dataset.regionState,'loading');
 release({ok:true,value:{...x.store.atlasRenderView(x.w.token),region:{fence:'fresh',coverage:{mode:'detail',unreadable:0}}}});assert.equal(await pending,true);
 assert.equal(x.ui.regionReading,null);assert.equal(x.ui.data.region.fence,'fresh');assert.equal(x.ui.travelReadState,'ready');
 window.campaign.atlasRegion=async()=>{reads++;return{ok:false,error:'source unavailable'};};x.ui.error=()=>{};
 assert.equal(await x.ui.refreshSpatialSource(),false);assert.equal(reads,2,'without an owner, stale terrain still requests a source');assert.equal(x.ui.travelReadState,'failed');
 window.campaign.atlasRegion=async()=>{reads++;return{ok:true,value:{...x.store.atlasRenderView(x.w.token),region:{fence:'retry',coverage:{mode:'detail',unreadable:0}}}};};
 assert.equal(await x.ui.refreshSpatialSource(),true);assert.equal(reads,3);assert.equal(x.ui.data.region.fence,'retry');
});

// A0.08: controller evidence crosses actual Main registrations, preload and worker.
// Electron's native shell is substituted; whole-process/native restart is A0.14.
import {desktopMainHost,storeFaultWorker} from './helpers/desktop-main-host.mjs';
import Database from 'better-sqlite3';
const ok=r=>{assert.equal(r.ok,true,r.error);return r.value;};
const response=fn=>{try{return{ok:true,value:fn()};}catch(error){return{ok:false,error:error.message};}};
function productionBusy(ui){delete ui.busy;}
function stepFixture(x){
 productionBusy(x.ui);
 const preview=x.store.previewAtlasTravel(x.w.token,{x:20,y:0});
 x.store.executeAtlasTravel({...x.command({kind:'start',preview}),sceneId:x.a.id});
 x.ui.data={...x.store.atlasRenderView(x.w.token),region:{fence:'travel',coverage:{mode:'detail',unreadable:0}}};
 const j=x.ui.data.localJourney;
 x.window.campaign.executeAtlasTravelCommit=async c=>{x.sent.push(c);return response(()=>x.store.executeAtlasTravelCommit(c));};
 x.ui.refresh=async()=>{x.ui.data={...x.store.atlasRenderView(x.w.token),region:{fence:'travel',coverage:{mode:'detail',unreadable:0}}};return true;};
 return{kind:'step',id:j.id,expectedRevision:j.revision};
}
function facts(filename){const db=new Database(filename,{readonly:true});try{return Object.fromEntries(['scene_clock','scene_position','atlas_local_journey','atlas_travel_receipt','scene_time_step','atlas_command','campaign_atlas'].map(table=>[table,db.prepare('SELECT * FROM '+table).all()]));}finally{db.close();}}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function hostTravel(t,mode){
 const dom=fixture(t),host=await desktopMainHost(t,{workerFile:storeFaultWorker('executeAtlasTravelCommit',mode)}),cam=ok(await host.api.create('Reiseantwort')),w=ok(await host.api.activateShell(cam.id)),command=action=>({campaignId:cam.id,token:w.token,commandId:randomUUID(),action});
 ok(await host.api.executeAtlasCommit(command({kind:'landscape-put',record:{id:randomUUID(),revision:0,kind:'patch',name:'Land',points:[],polygons:[{outer:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}],holes:[]}],resolution:1,width:0,values:{terrain:'plains'}},expectedRevision:null})));
 const initial=ok(await host.api.live(w.token)),scene=ok(await host.api.executeLive(command({kind:'initialize',expectedRosterRevision:initial.rosterRevision}))).scene;
 const character=ok(await host.api.executeLive(command({kind:'create-character',profile:{name:'Ada',speedFeet:30}}))).character,live=ok(await host.api.live(w.token));
 ok(await host.api.executeLive(command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision})));
 const preview=ok(await host.api.previewAtlasTravel(w.token,{x:20,y:0})),started=ok(await host.api.executeAtlasTravel({...command({kind:'start',preview}),sceneId:scene.id}));
 const action={kind:'step',id:started.localJourney.id,expectedRevision:started.localJourney.revision};
 const snapshot=await host.api.campaignAtlas(w.token);
 return{...dom,host,cam,w,action,snapshot:ok(snapshot)};
}
function freshTravelOwner(x,w,api,snapshot){
 x.window.campaign=api;
 const ui=Object.assign(atlasFixture(CampaignAtlasWorkbench),{owner:w,data:snapshot,root:x.document.createElement('section'),svg:x.document.createElement('canvas'),family:'travel',lastPoint:{x:20,y:0},opts:{status(){},updated(){throw Error('Travel must preserve independent author inputs');}}});
 productionBusy(ui);
 ui.error=e=>{x.document.getElementById('atlas-save-status').textContent=e.message;};
 ui.render=()=>ui.renderTravel();
 ui.refresh=async()=>{const r=await api.campaignAtlas(w.token);if(r.ok)ui.data=r.value;return r.ok;};
 return ui;
}
for(const mode of ['before-execution','lost-response','uncloneable-response'])for(const thrown of [false,true])test(`travel owner: real ${mode}, ${thrown?'thrown transport':'structured unknown'}, new owner restores disk identity and never repeats a step`,async t=>{
 const x=await hostTravel(t,mode),api=thrown?{...x.host.api,executeAtlasTravelCommit:async c=>{const r=await x.host.api.executeAtlasTravelCommit(c);assert.equal(r.errorKind,'store-outcome-unknown');throw Error('IPC-Antwort verloren');}}:x.host.api;
 const first=freshTravelOwner(x,x.w,api,x.snapshot);await first.journey.activate();first.travelReadState='ready';const before=facts(x.host.store.filename);
 const travel=first.travel(x.action);assert.ok(first.pendingTravel,'reserved synchronously before first await');
 assert.equal(await first.travel(x.action),false);assert.equal(await travel,false);
 assert.equal(first.journey.recoveryState.durableConfirmed,true,'successful keep survives terminal worker failure');
 const original=first.pendingTravel;assert.equal(original.token,x.w.token);assert.deepEqual(original.action,x.action);
 assert.equal(x.host.dispatches.filter(d=>d.method==='executeAtlasTravelCommit').length,1);
 const fresh=await x.host.restart(),active=ok(await fresh.api.activateShell(x.cam.id)),after=facts(fresh.store.filename);
 if(mode==='before-execution')assert.deepEqual(after,before);else{
  assert.notDeepEqual(after.scene_clock,before.scene_clock);assert.notDeepEqual(after.scene_position,before.scene_position);
  assert.equal(after.scene_time_step.length,before.scene_time_step.length+1);
 }
 // A genuinely new controller receives campaign+current authorization only.
 // Its saved reference is discovered by activate(), never supplied by this test.
 const second=freshTravelOwner(x,active,fresh.api,null),loading=second.journey.activate();
 assert.ok(second.pendingTravel);assert.equal(second.journey.recoveryState.phase,'loading');await loading;
 assert.notEqual(active.token,x.w.token);assert.equal(second.pendingTravel.action,undefined);assert.equal(second.pendingTravel.commandId,original.commandId);
 assert.equal(second.pendingTravel.token,undefined);assert.equal(second.journey.playback.running,false);
 const db=new Database(fresh.store.filename);db.prepare('DELETE FROM live_state WHERE campaign_id=?').run(x.cam.id);db.close();
 const noFocus=facts(fresh.store.filename),count=fresh.dispatches.filter(d=>d.method==='executeAtlasTravelCommit').length;
 await second.recoverWrite();assert.equal(second.pendingTravel,null);
 if(mode!=='before-execution')assert.equal(second.recoveryProjection,active,'confirmed result survives missing focus projection');
 for(let i=0;i<3;i++)await second.recoverWrite();
 assert.deepEqual(facts(fresh.store.filename),noFocus,'status/projection recovery must not change position, clock, receipts or history');
 assert.equal(fresh.dispatches.filter(d=>d.method==='executeAtlasTravelCommit').length,count);
 assert.deepEqual(ok(await fresh.api.atlasWriteReferences(x.cam.id,active.token)),[]);
 assert.equal(second.journey.playback.running,false);
});

test('unknown, failed status and failed clear retain the exact command and preserve independent inputs',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,write=api.executeAtlasTravelCommit,status=api.atlasWriteStatus,clear=api.clearAtlasWriteReference;
 x.document.body.insertAdjacentHTML('beforeend','<textarea id="a08-draft">Offene Autoren-, Raum- und Landschaftseingabe</textarea>');
 const authorDraft=[{x:5,y:8}],roomDraft={name:'Offener Raum'},landscapeDraft={name:'Offene Landschaft'};
 x.ui.author.draft=authorDraft;x.ui.opts.roomDraft=()=>roomDraft;x.ui.landscape.doc=landscapeDraft;
 api.executeAtlasTravelCommit=async c=>{ok(await write(c));return{ok:false,error:'Antwort verloren',errorKind:'store-outcome-unknown'};};
 assert.equal(await x.ui.travel(action),false);const command=x.ui.pendingTravel,bytes=x.store.db.serialize();
 for(const reader of [async()=>({ok:true,value:{outcome:'unknown'}}),async()=>({ok:false,error:'Status nicht lesbar'}),async()=>{throw Error('Leseantwort verloren');}]){
  api.atlasWriteStatus=reader;await x.ui.recoverWrite();assert.equal(x.ui.pendingTravel,command);assert.equal(x.get('step').disabled,true);
 }
 api.atlasWriteStatus=status;api.clearAtlasWriteReference=async()=>({ok:false,error:'Clear nicht dauerhaft'});
 await x.ui.recoverWrite();assert.equal(x.ui.pendingTravel,command);assert.equal(x.ui.journey.recoveryState.outcome,'applied');assert.equal(x.ui.journey.recoveryState.durableConfirmed,true);
 api.clearAtlasWriteReference=clear;await x.ui.recoverWrite();assert.equal(x.ui.pendingTravel,null);
 for(let i=0;i<3;i++)await x.ui.recoverWrite();
 assert.equal(x.ui.author.draft,authorDraft);assert.equal(x.ui.opts.roomDraft(),roomDraft);assert.equal(x.ui.landscape.doc,landscapeDraft);
 assert.equal(x.sent.length,1);assert.ok(x.store.db.serialize().equals(bytes));assert.equal(x.document.getElementById('a08-draft').textContent,'Offene Autoren-, Raum- und Landschaftseingabe');
});

test('keep failure prevents dispatch and recovery reads an occupied slot instead of overwriting it',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,keep=api.keepAtlasWriteReference;
 api.keepAtlasWriteReference=async()=>({ok:false,error:'fsync fehlgeschlagen'});
 assert.equal(await x.ui.travel(action),false);assert.equal(x.sent.length,0);assert.equal(x.ui.journey.recoveryState.durableConfirmed,false);
 assert.equal(await x.ui.travel(action),false);await x.ui.recoverWrite();assert.equal(x.ui.pendingTravel,null);
 api.keepAtlasWriteReference=keep;
 // Save an older command through the same real reference helper, then try a new one.
 const older={commandId:randomUUID(),campaignId:x.w.campaign.id,token:x.w.token,sceneId:x.a.id,action};
 const {atlasWriteReference}=require('../.build/atlas-context-ui.cjs');
 ok(await keep(await atlasWriteReference({kind:'travel',command:older}),x.w.token));
 assert.equal(await x.ui.travel(action),false);assert.equal(x.sent.length,0);
 await x.ui.recoverWrite();assert.equal(x.ui.pendingTravel,null);assert.equal(x.sent.length,0,'missing receipt is not a first application');
});

test('definitive rejection stays correctable; confirmed commit with failed projection retries only reads',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,refresh=x.ui.refresh;
 assert.equal(await x.ui.travel({...action,expectedRevision:999}),false);assert.equal(x.ui.pendingTravel,null);
 x.ui.refresh=async()=>false;assert.equal(await x.ui.travel(action),false);assert.equal(x.ui.pendingTravel,null);assert.equal(x.ui.recoveryProjection,x.w);assert.equal(x.ui.recoveryTravel,true);assert.equal(x.ui.busy,true);assert.equal(await x.ui.travel(action),false);
 const bytes=x.store.db.serialize(),count=x.sent.length;api.atlasWriteStatus=async()=>{throw Error('confirmed projection cannot reread receipt');};
 await x.ui.recoverWrite();assert.equal(x.ui.recoveryProjection,x.w);x.ui.refresh=refresh;
 await x.ui.recoverWrite();assert.equal(x.ui.recoveryProjection,null);assert.equal(x.sent.length,count);assert.ok(x.store.db.serialize().equals(bytes));
});

test('captured command is reserved before keep, playback stops on unknown and paused resume never starts playback after failure',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,keep=api.keepAtlasWriteReference,gate=deferred();
 api.keepAtlasWriteReference=async(ref,token)=>{await gate.promise;return keep(ref,token);};
 const original=structuredClone(action),travel=x.ui.travel(action);action.expectedRevision=999;assert.deepEqual(x.ui.pendingTravel.action,original);
 assert.equal(x.sent.length,0);assert.equal(await x.ui.travel(original),false);gate.resolve();assert.equal(await travel,true);assert.deepEqual(x.sent[0].action,original);
 x.ui.data.localJourney.status='paused';let plays=0,stops=0;x.ui.playback={running:false,stop(){stops++;},settled:async()=>{},play(){plays++;}};
 api.executeAtlasTravelCommit=async()=>({ok:false,error:'unknown',errorKind:'store-outcome-unknown'});
 await x.ui.travelControl('play');assert.equal(plays,0);assert.ok(stops>0);assert.ok(x.ui.pendingTravel);
});

test('late keep waits at same-campaign activation and cannot dispatch; foreign campaign gets only its own slot',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,keep=api.keepAtlasWriteReference,gate=deferred();let entered=false;
 api.keepAtlasWriteReference=async(ref,token)=>{entered=true;await gate.promise;return keep(ref,token);};
 const old=x.ui.travel(action);await until(()=>entered);const same={...x.w};x.ui.owner=same;
 const loading=x.ui.journey.activate();assert.ok(x.ui.pendingTravel);assert.equal(x.ui.journey.recoveryState.phase,'loading');
 await tick();assert.equal(x.sent.length,0);gate.resolve();await old;await loading;
 assert.equal(x.sent.length,0);assert.equal(x.ui.pendingTravel.action,undefined);assert.equal(x.ui.journey.recoveryState.durableConfirmed,true);
 const other=x.store.create('Andere Reise'),foreign=x.store.activateShell(other.id);x.ui.owner=foreign;await x.ui.journey.activate();assert.equal(x.ui.pendingTravel,null);
 const fresh=x.store.activateShell(x.w.campaign.id);x.ui.owner=fresh;await x.ui.journey.activate();assert.ok(x.ui.pendingTravel);assert.equal(x.ui.pendingTravel.campaignId,x.w.campaign.id);
 assert.equal(await x.ui.journey.recover(),'not-applied');assert.equal(x.sent.length,0);
});

for(const phase of ['read','status','clear','write'])test(`late ${phase} answer belongs to its activation and never unlocks a new campaign`,async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,gate=deferred();let entered=false,old;
 const read=api.atlasWriteReferences;
 if(phase==='read'){
  api.atlasWriteReferences=async(campaignId,token)=>{const r=await read(campaignId,token);entered=true;await gate.promise;return r;};old=x.ui.journey.activate();
 }else{
  const write=api.executeAtlasTravelCommit;
  api.executeAtlasTravelCommit=async c=>{if(phase==='write'){const r=await write(c);entered=true;await gate.promise;return r;}return{ok:false,error:'unknown',errorKind:'store-outcome-unknown'};};
  if(phase==='write')old=x.ui.travel(action);
  else{await x.ui.travel(action);const method=phase==='status'?'atlasWriteStatus':'clearAtlasWriteReference',run=api[method];api[method]=async(...args)=>{const r=await run(...args);entered=true;await gate.promise;return r;};old=x.ui.recoverWrite();}
 }
 await until(()=>entered);
 const other=x.store.create('Fremd'),foreign=x.store.activateShell(other.id);x.ui.owner=foreign;api.atlasWriteReferences=read;
 await x.ui.journey.activate();assert.equal(x.ui.pendingTravel,null);assert.equal(x.ui.journey.recoveryState,null);
 gate.resolve();await old;assert.equal(x.ui.pendingTravel,null);assert.equal(x.ui.journey.recoveryState,null);assert.equal(x.ui.owner,foreign);assert.equal(x.ui.journey.busy,false);
 const fresh=x.store.activateShell(x.w.campaign.id);x.ui.owner=fresh;await x.ui.journey.activate();
 if(phase==='read'||phase==='clear')assert.equal(x.ui.pendingTravel,null);else{assert.ok(x.ui.pendingTravel);assert.equal(x.ui.pendingTravel.campaignId,x.w.campaign.id);assert.equal(x.ui.pendingTravel.token,undefined);}
});

test('failed reference reads remain blocked until a successful explicit reload; competing activation reads cannot replace the newest slot',async t=>{
 const x=fixture(t),api=x.window.campaign,read=api.atlasWriteReferences,gate=deferred();
 api.atlasWriteReferences=async()=>({ok:false,error:'Referenz nicht lesbar'});await x.ui.journey.activate();assert.ok(x.ui.pendingTravel);assert.equal(x.ui.journey.recoveryState.phase,'error');
 await x.ui.recoverWrite();assert.ok(x.ui.pendingTravel);
 api.atlasWriteReferences=async()=>{await gate.promise;return{ok:false,error:'Alter Lesefehler'};};const old=x.ui.journey.activate();await tick();
 x.ui.owner={...x.w};api.atlasWriteReferences=read;await x.ui.journey.activate();assert.equal(x.ui.pendingTravel,null);gate.resolve();await old;assert.equal(x.ui.pendingTravel,null);
});

test('Workbench activation awaits the travel reference read before completing and uses the new owner',async t=>{
 const x=fixture(t),api=x.window.campaign,read=api.atlasWriteReferences,gate=deferred();let reads=0,complete=false;
 x.document.body.insertAdjacentHTML('beforeend','<div id="atlas-search-results"></div>');
 // Unrelated view controllers are inert; activation and Journey stay production code.
 x.ui.output.reset=()=>{};x.ui.reference={close(){}};x.ui.landscape.context=()=>{};x.ui.camera={context(){},set(){}};x.ui.scheduleRender=()=>{};
 api.atlasWriteReferences=async(campaignId,token)=>{assert.equal(x.ui.owner,next);const r=await read(campaignId,token);if(++reads===1)await gate.promise;return r;};
 const next={...x.w},activation=x.ui.activate(next).then(()=>complete=true);
 await until(()=>reads===2);assert.equal(complete,false);assert.ok(x.ui.pendingTravel);assert.equal(x.ui.journey.recoveryState.phase,'loading');
 gate.resolve();await activation;assert.equal(complete,true);assert.equal(x.ui.pendingTravel,null);assert.equal(x.ui.owner,next);
});

test('travel restoration and clearing leave the independent Atlas slot untouched',async t=>{
 const x=fixture(t),action=stepFixture(x),api=x.window.campaign,{atlasWriteReference}=require('../.build/atlas-context-ui.cjs');
 const authorRef=await atlasWriteReference({kind:'atlas',command:x.command({kind:'dungeon-create',name:'Ungeklärt',x:0,y:0})});
 ok(await api.keepAtlasWriteReference(authorRef,x.w.token));api.executeAtlasTravelCommit=async()=>({ok:false,error:'unknown',errorKind:'store-outcome-unknown'});
 await x.ui.travel(action);assert.equal(ok(await api.atlasWriteReferences(x.w.campaign.id,x.w.token)).length,2);
 await x.ui.journey.activate();assert.equal(x.ui.pendingTravel.family,'travel');assert.equal(await x.ui.journey.recover(),'not-applied');
 assert.deepEqual(ok(await api.atlasWriteReferences(x.w.campaign.id,x.w.token)),[authorRef]);assert.equal(x.sent.length,0);
});
