import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { parseHTML } from 'linkedom';
buildSync({ entryPoints: ['src/app/campaign-atlas-ui.ts'], outfile: '.build/atlas-context-ui.cjs', bundle: true, platform: 'node', format: 'cjs' });
buildSync({ entryPoints: ['src/app/storage/store.ts'], outfile: '.build/atlas-context-store.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3'] });
const require = createRequire(import.meta.url), { CampaignAtlasWorkbench } = require('../.build/atlas-context-ui.cjs'), { CampaignStore } = require('../.build/atlas-context-store.cjs');
function fixture(t) {
    const dir = mkdtempSync(tmpdir() + '/atlas-context-'), store = new CampaignStore(dir + '/world.sqlite'), campaign = store.create('Reise'), w = store.activate(campaign.id), command = action => ({ commandId: randomUUID(), campaignId: campaign.id, token: w.token, action });
    const a = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: store.live(w.token).rosterRevision })).scene;
    const character = store.executeLive(command({ kind: 'create-character', profile: { name: 'Ada', speedFeet: 30 } })).character, live = store.live(w.token);
    store.executeLive(command({ kind: 'membership', characterId: character.id, expectedRevision: character.membershipRevision, expectedRosterRevision: live.rosterRevision, active: true, targetSceneId: a.id, expectedFocusRevision: live.focusRevision }));
    const beforeGlobals = { window: globalThis.window, document: globalThis.document };
    const { window, document } = parseHTML('<html><body><div id="atlas-advanced-fields"></div><p id="atlas-local-status"></p><p id="atlas-save-status"></p><div id="atlas-entrance-field"></div><select id="atlas-entrance-choice"></select>' + ['start', 'preview', 'refresh', 'place', 'entrance', 'step', 'round', 'play', 'pause', 'end'].map(k => `<button id="atlas-local-${k}"></button>`).join('') + '</body></html>');
    Object.assign(globalThis, { window, document });
    for (const select of document.querySelectorAll('select'))
        Object.defineProperty(select, 'value', { value: '', writable: true });
    const sent = [];
    window.campaign = { campaignAtlas: async () => ({ ok: true, value: store.campaignAtlas(w.token) }), previewAtlasTravel: async (token, end) => ({ ok: true, value: store.previewAtlasTravel(token, end) }), executeAtlasTravel: async (c) => { sent.push(c); return { ok: true, value: store.executeAtlasTravel(c) }; } };
    // Exercise the production controller/render methods with real SQLite snapshots.
    // Whole-workbench mounting and click wiring are covered by the native probe.
    const ui = Object.assign(Object.create(CampaignAtlasWorkbench.prototype), { owner: w, data: store.campaignAtlas(w.token), root: { hidden: false }, request: 0, previewRequest: 0, busy: false, pendingTravel: null, localPreview: null, lastPoint: { x: 20, y: 0 }, entranceId: null, travelReadState: 'ready', family: 'travel', playback: { running: false, stop() { }, async settled() { } }, opts: { status() { } } });
    ui.render = () => ui.renderTravel();
    ui.render();
    t.after(() => { Object.assign(globalThis, beforeGlobals); store.close(); rmSync(dir, { recursive: true, force: true }); });
    return { ui, store, w, a, command, sent, get: id => document.getElementById('atlas-local-' + id) };
}
test('pending and failed Atlas context reads revoke previews and block travel; retry remains read-only', async (t) => {
    const x = fixture(t);
    await x.ui.travelControl('preview');
    assert.equal(x.get('start').disabled, false);
    let release;
    window.campaign.campaignAtlas = () => new Promise(r => release = r);
    const before = x.store.db.serialize(), read = x.ui.refresh();
    assert.equal(x.get('start').disabled, true);
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
    window.campaign.campaignAtlas = async () => ({ ok: true, value: x.store.campaignAtlas(x.w.token) });
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
    const other = x.store.campaignAtlas(x.w.token), afterFocus = x.store.db.serialize();
    window.campaign.campaignAtlas = async () => ({ ok: true, value: other });
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
    window.campaign.campaignAtlas = () => new Promise(r => release = r);
    const old = x.ui.refresh();
    window.campaign.campaignAtlas = async () => ({ ok: true, value: x.store.campaignAtlas(x.w.token) });
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
    window.campaign.campaignAtlas = async () => ({ ok: true, value: empty });
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
