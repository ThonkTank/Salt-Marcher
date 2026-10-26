import { afterFixture, freshFixtureModule } from '../helpers/fixture-lifecycle.mjs';
import { liveInstance } from '../helpers/live.mjs';
import { fixtureStore } from '../helpers/store.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
const base = '.build/planner-live-moment',
  require = createRequire(import.meta.url);
mkdirSync(base + '/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  base + '/catalog/srd-5.1.generated.json',
);
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  stdin: {
    contents:
      "export {newLocation} from './src/features/location/location-schema';export * from './src/app/runtime/live';export {createCombat} from './src/app/runtime/combat';export {initSessionPacket,setSessionPacketSurface} from './src/app/campaign/session-packet-ui';",
    resolveDir: process.cwd(),
    sourcefile: 'live-packet-fixture.ts',
  },
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
async function setup(t, resume = true, initialize = true, recapRaw, browserTextareas = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'moment-context-')),
    { CampaignStore } = require('../../' + base + '/store.cjs'),
    store = fixtureStore(CampaignStore, path.join(root, 'store.sqlite')),
    campaign = store.create('Abend'),
    w = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: w.token,
    action,
  });
  const heroes = ['Ada', 'Borin'].map(
    (name) => store.executeLive(command({ kind: 'create-character', profile: { name } })).character,
  );
  const scene = initialize
    ? store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 2 })).scene
    : null;
  if (initialize)
    for (const h of heroes) {
      const v = store.live(w.token);
      store.executeLive(
        command({
          kind: 'membership',
          characterId: h.id,
          expectedRevision: 0,
          expectedRosterRevision: v.rosterRevision,
          active: true,
          targetSceneId: scene.id,
          expectedFocusRevision: v.focusRevision,
        }),
      );
    }
  if (recapRaw !== undefined) {
    store.executeLive(
      command({
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: store.live(w.token).scene.revision,
        marker: 'start',
        summary: '',
      }),
    );
    store.db
      .prepare('INSERT INTO settings VALUES(?,?)')
      .run('session-recap:' + campaign.id, recapRaw);
  }
  const { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8')),
    saved = {
      HTMLInputElement: globalThis.HTMLInputElement,
      HTMLSelectElement: globalThis.HTMLSelectElement,
      HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
      Option: globalThis.Option,
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    },
    storage = new Map();
  window.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() {
      return this._value ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this._value = v;
    },
    configurable: true,
  });
  for (const select of document.querySelectorAll('select'))
    Object.defineProperty(select, 'value', { value: '', writable: true });
  function Option(text = '', value = '') {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
  }
  window.HTMLSelectElement.prototype.add = function (o) {
    this.append(o);
  };
  Object.assign(globalThis, {
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Option,
    window,
    document,
    Event: window.Event,
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  if (browserTextareas) {
    const values = new WeakMap();
    Object.defineProperty(window.HTMLTextAreaElement.prototype, 'value', {
      configurable: true,
      get() {
        return values.get(this) ?? '';
      },
      set(text) {
        values.set(this, String(text).replace(/\r\n?/g, '\n'));
      },
    });
  }
  const x = {
    store,
    w,
    scene,
    heroes,
    root,
    CampaignStore,
    command,
    window,
    document,
    commands: [],
    messages: [],
    reply: async (ack) => ack,
    releases: [],
    followUps: [],
    noteOpens: [],
    rewardOpens: [],
    openPacketResult: true,
  };
  const wrap = (fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  window.campaign = {
    sceneCreationDraft: async (token, id) => wrap(() => store.sceneCreationDraft(token, id)),
    session: async (token, id) => wrap(() => store.session(token, id)),
    sessionPacket: async (token, id) => wrap(() => store.sessionPacket(token, id)),
    previewTime: async (token, query) => wrap(() => store.previewTime(token, query)),
    world: async (token) => wrap(() => store.world(token)),
    agenda: async (token, query) => wrap(() => store.agenda(token, query)),
    scenePreparation: async (token, id) => wrap(() => store.scenePreparation(token, id)),
    narrativeJournal: async (token, query) => wrap(() => store.narrativeJournal(token, query)),
    chronicle: async (token, category, search) =>
      wrap(() => store.chronicle(token, category, search)),
    narrative: async (token, id) => wrap(() => store.narrative(token, id)),
    live: async (token) => wrap(() => store.live(token)),
    progress: async (token) => wrap(() => store.progress(token)),
    ledgerParties: async (token) => wrap(() => store.ledgerParties(token)),
    preparation: async (token) => wrap(() => store.preparation(token)),
    sceneWorld: async (token, id) => wrap(() => store.sceneWorld(token, id)),
    executeLive: async (cmd) => {
      x.commands.push(cmd);
      return x.reply(
        wrap(() => store.executeLive(cmd)),
        cmd,
      );
    },
  };
  for (const method of [
    'combat',
    'chase',
    'treasures',
    'sceneDesk',
    'searchDesk',
    'deskContent',
    'sceneRules',
    'sceneShops',
    'sceneChecks',
    'ledger',
    'lootBalance',
    'progressHistory',
    'sessionProgress',
    'keepSessionRecapDraft',
    'keepLiveMomentDraft',
    'liveScene',
  ])
    window.campaign[method] = async (...args) => wrap(() => store[method](...args));
  x.ui = liveInstance(freshFixtureModule(require, '../../' + base + '/ui.cjs'), document, window);
  x.ui.initSessionPacket(
    (text, error) => x.messages.push({ text, error }),
    () => null,
    async () => true,
  );
  x.ui.setSessionPacketSurface('live');
  x.ui.initLive(
    (text, error) => x.messages.push({ text, error }),
    async () => {},
    async (id, current) => {
      if (current()) {
        if (x.noteOpenError) throw x.noteOpenError;
        x.noteOpens.push(id);
      }
    },
    async () => {},
    async (plan, visit, current) => {
      if (x.rewardDelay) await x.rewardDelay();
      if (current()) x.rewardOpens.push([plan, visit]);
    },
    async (seed, current) => {
      if (current()) x.followUps.push(['deadline', seed]);
    },
    async (plan, seed, current, openPacket) => {
      if (current()) {
        const row = ['visit', plan, seed];
        if (openPacket) row.push(true);
        x.followUps.push(row);
      }
      return openPacket ? x.openPacketResult : true;
    },
  );
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.close = () => {
      dialog.open = false;
    };
    dialog.showModal = () => {
      dialog.open = true;
    };
  }
  x.ui.activateLive(w);
  await x.ui.openLive();
  if (resume && !initialize) {
    document.getElementById('live-continue').click();
    await settle();
  }
  x.el = (id) => document.getElementById(id);
  x.fields = (title, summary) => {
    x.el('live-moment-title').value = title;
    x.el('live-moment-summary').value = summary;
    x.el('live-moment-category').value = 'narrative';
  };
  x.submit = () =>
    x.el('live-moment-form').onsubmit(new window.Event('submit', { cancelable: true }));
  x.end = async () => {
    x.el('live-session-end').click();
    await settle();
    assert.equal(x.el('live-session-close-dialog').open, true);
    assert.equal(x.el('live-session-close-confirm').disabled, false);
    x.el('live-session-close-confirm').click();
    await settle();
  };
  x.defer = (kind) => {
    let release;
    const promise = new Promise((r) => (release = r));
    x.releases.push(() => release());
    let held = false;
    x.reply = async (ack, cmd) => {
      if (cmd.action.kind === kind && !held) {
        held = true;
        await promise;
      }
      return ack;
    };
    return release;
  };
  x.focusOther = async () => {
    let v = store.live(w.token);
    const ack = store.executeLive(
      command({
        kind: 'move',
        sceneId: v.scene.id,
        expectedRosterRevision: v.rosterRevision,
        expectedFocusRevision: v.focusRevision,
        expectedClockRevision: v.scene.clock.revision,
        expectedSceneMembershipRevision: v.scene.membershipRevision,
        memberIds: [heroes[1].id],
        target: { kind: 'new', title: 'Andere Gruppe', expectedContentRevision: v.scene.revision },
      }),
    );
    const id = ack.session.createdScene.id;
    v = store.live(w.token);
    store.executeLive(command({ kind: 'focus', sceneId: id, expectedRevision: v.focusRevision }));
    await x.ui.openLive();
    return id;
  };
  afterFixture(t, async () => {
    for (const release of x.releases) release();
    await settle();
    x.ui.activateLive(null);
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return x;
}
test('a live moment keeps submitted wording through a flush and preserves later input', async (t) => {
  const x = await setup(t),
    release = x.defer('scene-content');
  x.el('running-notes').value = 'Offene Sceneeingabe';
  x.el('running-notes').oninput();
  x.fields('Erster Moment', '  Erstes Ergebnis\r\n');
  x.submit();
  await settle();
  x.fields('Nächster Moment', '  Neue Eingabe  ');
  release();
  await settle();
  const moments = x.commands.filter((c) => c.action.kind === 'live-moment');
  assert.equal(moments.length, 1);
  assert.equal(moments[0].action.title, 'Erster Moment');
  assert.equal(moments[0].action.summary, '  Erstes Ergebnis\r\n');
  assert.equal(x.el('live-moment-title').value, 'Nächster Moment');
  assert.equal(x.el('live-moment-summary').value, '  Neue Eingabe  ');
  assert.ok(
    x.store
      .chronicle(x.w.token)
      .entries.some((e) => e.title === 'Erster Moment' && e.summary === '  Erstes Ergebnis\r\n'),
  );
});
test('a scene focus change during flush prevents the old live moment from publishing', async (t) => {
  const x = await setup(t),
    release = x.defer('scene-content');
  x.el('running-notes').value = 'Noch speichern';
  x.el('running-notes').oninput();
  x.fields('Alter Auftrag', 'Ursprüngliche Gruppe');
  x.submit();
  await settle();
  const other = await x.focusOther();
  release();
  await settle();
  assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 0);
  assert.equal(x.el('live-moment-title').value, '');
  x.fields('Moment der neuen Gruppe', 'Neue Gruppe');
  x.submit();
  await settle();
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'live-moment').at(-1).action.sceneId,
    other,
  );
  const v = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({ kind: 'focus', sceneId: x.scene.id, expectedRevision: v.focusRevision }),
  );
  await x.ui.openLive();
  assert.equal(x.el('live-moment-title').value, 'Alter Auftrag');
});
test('a delayed live moment acknowledgement cannot restore its scene over the new focus', async (t) => {
  const x = await setup(t),
    release = x.defer('live-moment');
  x.fields('Vorheriger Moment', 'Alte Gruppe');
  x.submit();
  await settle();
  const id = await x.focusOther();
  x.fields('Neuer Moment', 'Neue Gruppe');
  release();
  await settle();
  assert.equal(x.el('scene-focus').value, id);
  assert.equal(x.el('running-title').value, 'Andere Gruppe');
  assert.equal(x.el('live-moment-title').value, 'Neuer Moment');
  assert.equal(x.el('live-moment-summary').value, 'Neue Gruppe');
  assert.ok(x.store.chronicle(x.w.token).entries.some((e) => e.title === 'Vorheriger Moment'));
  x.submit();
  await settle();
  assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').at(-1).action.sceneId, id);
});

test('a live moment creates one linked quest and preserves a later follow-up choice', async (t) => {
  const x = await setup(t),
    release = x.defer('live-moment');
  x.fields('  Offene Spur  ', '  Rohnotiz\r\n');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  x.fields('Nächste Spur', 'Noch offen');
  x.el('live-moment-follow-up').value = 'rumor';
  release();
  await settle();
  const cmd = x.commands.find((c) => c.action.kind === 'live-moment');
  assert.equal(cmd.action.followUp.kind, 'quest');
  const id = cmd.action.followUp.id;
  const narrative = x.store.narrative(x.w.token, id);
  assert.equal(narrative.state.revision, 1);
  assert.deepEqual(
    narrative.state.contributors,
    x.heroes.map((h) => h.id),
  );
  let notes = x.store.preparation(x.w.token).notes.filter((row) => row.note.id === id);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].note.kind, 'quest');
  assert.equal(notes[0].note.gmNotes, '  Rohnotiz\r\n');
  assert.equal(notes[0].note.title, 'Offene Spur');
  x.store.executeLive(cmd);
  notes = x.store.preparation(x.w.token).notes.filter((row) => row.note.id === id);
  assert.equal(notes.length, 1);
  const events = x.store.chronicle(x.w.token).entries.filter((e) => e.followUp?.id === id);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].followUp, { id, kind: 'quest' });
  assert.equal(x.el('live-moment-title').value, 'Nächste Spur');
  assert.equal(x.el('live-moment-follow-up').value, 'rumor');
  await x.focusOther();
  assert.equal(x.el('live-moment-follow-up').value, '');
  const v = x.store.live(x.w.token);
  x.store.executeLive(
    x.command({ kind: 'focus', sceneId: x.scene.id, expectedRevision: v.focusRevision }),
  );
  await x.ui.openLive();
  assert.equal(x.el('live-moment-follow-up').value, 'rumor');
});
for (const kind of ['quest', 'rumor'])
  test(`a confirmed ${kind} opens its exact original without searching or republishing`, async (t) => {
    const x = await setup(t);
    x.fields('Neue Spur', '  Absprache\r\n');
    x.el('live-moment-follow-up').value = kind;
    x.submit();
    await settle();
    const reference = x.commands.find((c) => c.action.kind === 'live-moment').action.followUp,
      button = x.el('live-moment-follow-up-open');
    assert.ok(button);
    assert.equal(button.type, 'button');
    assert.equal(button.textContent, kind === 'quest' ? 'Quest öffnen…' : 'Gerücht öffnen…');
    x.fields('Nächster Entwurf', 'Weiterer Text');
    button.click();
    await settle();
    assert.deepEqual(x.noteOpens, [reference.id]);
    assert.equal(x.el('live-moment-title').value, 'Nächster Entwurf');
    assert.equal(x.el('live-moment-summary').value, 'Weiterer Text');
    assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 1);
    assert.equal(
      x.store.preparation(x.w.token).notes.find((row) => row.note.id === reference.id).note.gmNotes,
      '  Absprache\r\n',
    );
  });
test('a saved follow-up action cannot navigate after changing the focused group', async (t) => {
  const x = await setup(t);
  x.fields('Alte Gruppe', 'Alte Spur');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  const previous = x.el('live-moment-follow-up-open');
  assert.ok(previous);
  await x.focusOther();
  assert.equal(x.el('live-moment-follow-up-open'), null);
  previous.click();
  await settle();
  assert.deepEqual(x.noteOpens, []);
});
test('only the latest saved result owns its follow-up action', async (t) => {
  const x = await setup(t);
  x.fields('Erste Spur', 'Erstes Ergebnis');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  const previous = x.el('live-moment-follow-up-open');
  x.fields('Zweite Spur', 'Zweites Ergebnis');
  x.el('live-moment-follow-up').value = 'rumor';
  x.submit();
  await settle();
  previous.click();
  await settle();
  assert.deepEqual(x.noteOpens, []);
  x.el('live-moment-follow-up-open').click();
  await settle();
  assert.deepEqual(x.noteOpens, [
    x.commands.filter((c) => c.action.kind === 'live-moment').at(-1).action.followUp.id,
  ]);
});
test('a failed follow-up navigation retains the saved result and allows retry without another moment', async (t) => {
  const x = await setup(t);
  x.fields('Bestätigte Spur', 'Ergebnis');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  const button = x.el('live-moment-follow-up-open');
  x.noteOpenError = new Error('Kontrollierter Öffnungsfehler');
  button.click();
  await settle();
  assert.match(x.messages.at(-1).text, /Öffnungsfehler/);
  assert.equal(button.disabled, false);
  assert.match(x.el('live-moment-result').textContent, /gespeichert/);
  x.noteOpenError = null;
  button.click();
  await settle();
  assert.equal(x.noteOpens.length, 1);
  assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 1);
});
test('a failed moment offers no unconfirmed follow-up action', async (t) => {
  const x = await setup(t);
  x.window.campaign.executeLive = async () => ({
    ok: false,
    error: 'Kontrollierter Schreibfehler',
  });
  x.fields('Ungesicherte Spur', 'Entwurf');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  assert.equal(x.el('live-moment-follow-up-open'), null);
  assert.equal(x.el('live-moment-title').value, 'Ungesicherte Spur');
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Ungesicherte Spur').length,
    0,
  );
});
test('a follow-up collision rolls back its moment, revision and receipt', async (t) => {
  const x = await setup(t),
    id = randomUUID();
  x.store.changePreparation({
    commandId: randomUUID(),
    campaignId: x.w.campaignId,
    token: x.w.token,
    change: {
      kind: 'note',
      expectedRevision: null,
      note: {
        version: 1,
        id,
        revision: 1,
        kind: 'quest',
        title: 'Vorhanden',
        readAloud: '',
        gmNotes: 'Original',
        relations: [],
        creatureId: null,
        deleted: false,
      },
    },
  });
  const before = x.store.chronicle(x.w.token),
    revision = x.store.live(x.w.token).scene.revision,
    cmd = x.command({
      kind: 'live-moment',
      sceneId: x.scene.id,
      expectedRevision: revision,
      category: 'narrative',
      title: 'Kollision',
      summary: 'Keine Teilwirkung',
      followUp: { id, kind: 'quest' },
    });
  assert.throws(() => x.store.executeLive(cmd));
  assert.deepEqual(x.store.chronicle(x.w.token), before);
  assert.equal(x.store.live(x.w.token).scene.revision, revision);
  cmd.action.followUp.id = randomUUID();
  assert.doesNotThrow(() => x.store.executeLive(cmd));
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Kollision').length,
    1,
  );
});

test('an independent campaign copy binds a moment follow-up to its copied world note', async (t) => {
  const x = await setup(t);
  x.fields('Spur kopieren', 'Rohtext');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  const source = x.store.chronicle(x.w.token).entries.find((e) => e.followUp),
    snapshot = path.join(x.root, 'snapshot.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const bytes = readFileSync(snapshot),
    copy = new x.CampaignStore(path.join(x.root, 'copy.sqlite'));
  try {
    const campaign = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(campaign.id),
      event = copy.chronicle(w.token).entries.find((e) => e.followUp);
    assert.notEqual(event.followUp.id, source.followUp.id);
    assert.ok(
      copy
        .preparation(w.token)
        .notes.some((row) => row.note.id === event.followUp.id && row.note.gmNotes === 'Rohtext'),
    );
    assert.deepEqual(
      x.store.chronicle(x.w.token).entries.find((e) => e.followUp),
      source,
    );
    assert.ok(readFileSync(snapshot).equals(bytes));
  } finally {
    copy.close();
  }
});

test('a failed knowledge refresh still confirms and clears the saved moment exactly once', async (t) => {
  const x = await setup(t);
  x.fields('Bestätigte Spur', 'Ergebnis');
  x.el('live-moment-follow-up').value = 'quest';
  x.window.campaign.preparation = async () => {
    throw new Error('Kontrollierter Readfehler');
  };
  x.submit();
  await settle();
  assert.equal(x.el('live-moment-title').value, '');
  assert.equal(x.el('live-moment-follow-up').value, '');
  assert.match(x.el('live-moment-result').textContent, /gespeichert/);
  assert.match(x.el('live-sources-status').textContent, /Kontrollierter Readfehler/);
  x.el('live-moment-follow-up-open').click();
  await settle();
  assert.deepEqual(x.noteOpens, [
    x.commands.find((c) => c.action.kind === 'live-moment').action.followUp.id,
  ]);
  assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 1);
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Bestätigte Spur').length,
    1,
  );
});

test('a newer recap summary survives the acknowledgement of its previous submitted ending', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  assert.equal(x.store.chronicle(x.w.token).entries[0].sessionMarker, 'start');
  const release = x.defer('session-marker');
  x.el('live-session-summary').value = '  Alter Rückblick\r\n';
  await x.end();
  x.el('live-session-close-summary').value = 'Neuere Notiz';
  x.el('live-session-close-summary').dispatchEvent(new x.window.Event('input'));
  release();
  await settle();
  assert.equal(x.el('live-session-summary').value, 'Neuere Notiz');
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end').summary,
    '  Alter Rückblick\r\n',
  );
});
test('a focus change during recap flush cannot publish the former groups session boundary', async (t) => {
  const x = await setup(t),
    release = x.defer('scene-content');
  x.el('running-notes').value = 'Offene Scene';
  x.el('running-notes').oninput();
  x.el('live-session-start').click();
  await settle();
  await x.focusOther();
  release();
  await settle();
  assert.equal(x.commands.filter((c) => c.action.kind === 'session-marker').length, 0);
});

test('a rejected chronicle read does not prevent the live group from opening or notes from saving', async (t) => {
  const x = await setup(t);
  x.window.campaign.chronicle = async () => {
    throw Error('Chronik nicht erreichbar');
  };
  await x.ui.openLive();
  assert.equal(x.el('live-workspace').hidden, false);
  assert.equal(x.el('live-session-start').disabled, true);
  assert.match(x.el('live-session-status').textContent, /Chronik nicht erreichbar/);
  x.el('running-notes').value = 'Trotzdem spielbereit';
  x.el('running-notes').oninput();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).scene.notes, 'Trotzdem spielbereit');
});

test('a prepared packet visit opens its live adoption review without adopting it', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Nächster Abend',
        scenes: [
          { id: visitId, title: 'Das Nordtor', notes: '  Wachen warten\r\n', locationId: null },
        ],
      },
    },
  });
  x.window.campaign.session = async (token, id) => ({
    ok: true,
    value: x.store.session(token, id),
  });
  x.ui.activateLive(x.w);
  const before = x.store.live(x.w.token).scene,
    commands = x.commands.length,
    opened = await x.ui.openPlannedVisitReview(planId, visitId);
  await settle();
  assert.equal(opened, true);
  assert.equal(x.el('adoption-dialog').open, true);
  assert.match(x.el('adoption-content').textContent, /Das Nordtor/);
  assert.match(x.el('adoption-content').textContent, /Wachen warten/);
  assert.deepEqual(x.store.live(x.w.token).scene.adoption, before.adoption);
  assert.equal(x.commands.filter((c) => c.action.kind === 'apply-visit').length, 0);
  assert.equal(x.commands.length, commands);
});

test('a reviewed visit can be adopted and continue in its exact live packet', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Torabend',
        scenes: [{ id: visitId, title: 'Das Nordtor', notes: 'Wachen befragen', locationId: null }],
      },
    },
  });
  const before = x.store.live(x.w.token).scene;
  assert.equal(await x.ui.openPlannedVisitReview(planId, visitId), true);
  assert.match(x.el('adoption-dialog').textContent, /Party, Uhr/);
  x.el('adoption-confirm-packet').click();
  await settle();
  const after = x.store.live(x.w.token).scene;
  assert.equal(after.adoption.visitId, visitId);
  assert.equal(after.title, 'Das Nordtor');
  assert.deepEqual(after.clock, before.clock);
  assert.deepEqual(after.members, before.members);
  assert.equal(x.commands.filter((c) => c.action.kind === 'apply-visit').length, 1);
  assert.equal(x.el('adoption-dialog').open, false);
  assert.equal(x.el('session-packet-dialog').open, true);
  assert.equal(x.el('live-packet-host').hidden, false);
  assert.match(x.el('session-packet-content').textContent, /Das Nordtor/);
  assert.equal(
    x
      .el('session-packet-visits')
      .querySelector('[data-visit-id="' + visitId + '"]')
      .getAttribute('aria-pressed'),
    'true',
  );
});

test('a delayed session ending cannot restore its scene over the newer focused group', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  const release = x.defer('session-marker');
  x.el('live-session-summary').value = 'Alte Gruppe';
  await x.end();
  const id = await x.focusOther();
  x.el('live-session-summary').value = 'Neue Gruppe';
  release();
  await settle();
  assert.equal(x.el('scene-focus').value, id);
  assert.equal(x.el('running-title').value, 'Andere Gruppe');
  assert.equal(x.el('live-session-summary').value, 'Neue Gruppe');
});
test('recap drafts stay with their campaign when switching away and back', async (t) => {
  const x = await setup(t);
  x.el('live-session-summary').value = 'Notiz für A';
  const next = x.store.create('B'),
    b = x.store.activate(next.id);
  x.ui.activateLive(b);
  await x.ui.openLive();
  assert.equal(x.el('live-session-summary').value, '');
  x.el('live-session-summary').value = 'Notiz für B';
  const a = x.store.activate(x.w.campaign.id);
  x.ui.activateLive(a);
  await x.ui.openLive();
  assert.equal(x.el('live-session-summary').value, 'Notiz für A');
});

test('a pending recap read does not block the next confirmed moment and older results cannot replace it', async (t) => {
  const x = await setup(t),
    reads = [];
  x.window.campaign.chronicle = (token) => {
    const value = { ok: true, value: x.store.chronicle(token) };
    return new Promise((resolve) => {
      reads.push({ resolve, value });
      x.releases.push(() => resolve(value));
    });
  };
  x.el('live-session-start').click();
  await settle();
  assert.equal(reads.length, 1);
  x.fields('Während Rückblick lädt', 'Eigenständige Eingabe');
  x.submit();
  await settle();
  assert.ok(x.commands.some((c) => c.action.kind === 'live-moment'));
  assert.equal(reads.length, 2);
  reads[1].resolve(reads[1].value);
  await settle();
  assert.match(x.el('live-session-events').textContent, /Während Rückblick lädt/);
  reads[0].resolve(reads[0].value);
  await settle();
  assert.match(x.el('live-session-events').textContent, /Während Rückblick lädt/);
});

for (const exit of ['live-session-close-x', 'live-session-close-cancel', 'escape'])
  test(`closing the recap review via ${exit} retains its edited note without ending the session`, async (t) => {
    const x = await setup(t);
    x.el('live-session-start').click();
    await settle();
    x.el('live-session-summary').value = 'Alter Entwurf';
    x.el('live-session-end').click();
    await settle();
    assert.equal(x.el('live-session-close-dialog').open, true);
    const before = x.store.db.serialize();
    x.el('live-session-close-summary').value = 'Bearbeiteter Entwurf';
    x.el('live-session-close-handoff').value = '  Nächster Einstieg\r\n';
    if (exit === 'escape')
      x.el('live-session-close-dialog').dispatchEvent(new x.window.Event('cancel'));
    else x.el(exit).click();
    assert.equal(x.el('live-session-summary').value, 'Bearbeiteter Entwurf');
    assert.equal(x.el('live-session-handoff').value, '  Nächster Einstieg\r\n');
    assert.ok(x.store.db.serialize().equals(before));
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
        .length,
      0,
    );
  });
test('an open recap review keeps its note in the original campaign across activation', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-summary').value = 'Review für A';
  x.el('live-session-close-handoff').value = 'Übergabe für A';
  const next = x.store.create('B'),
    b = x.store.activate(next.id);
  x.ui.activateLive(b);
  await x.ui.openLive();
  assert.equal(x.el('live-session-summary').value, '');
  const a = x.store.activate(x.w.campaign.id);
  x.ui.activateLive(a);
  await x.ui.openLive();
  assert.equal(x.el('live-session-summary').value, 'Review für A');
  assert.equal(x.el('live-session-handoff').value, 'Übergabe für A');
});

test('opening a pending combat from the recap review retains its edited note', async (t) => {
  const x = await setup(t),
    scene = x.store.live(x.w.token).scene;
  x.store.executeCombat({
    ...x.command({
      kind: 'create',
      sceneId: scene.id,
      title: 'Torwache',
      includeParty: true,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  });
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-summary').value = 'Später die Torwache klären';
  x.el('combat-panel').scrollIntoView = () => {};
  const before = x.store.combat(x.w.token, x.scene.id),
    markers = x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker);
  x.el('live-session-close-masks').querySelector('button').click();
  await settle();
  assert.equal(x.el('live-session-close-dialog').open, false);
  assert.equal(x.el('live-session-summary').value, 'Später die Torwache klären');
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
      .length,
    0,
  );
  assert.deepEqual(x.store.combat(x.w.token, x.scene.id), before);
  assert.deepEqual(
    x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker),
    markers,
  );
  x.el('live-session-end').click();
  await settle();
  assert.equal(x.el('live-session-close-summary').value, 'Später die Torwache klären');
});

test('session handoff retains its submitted text while a newer review edit survives the acknowledgement', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  const release = x.defer('session-marker');
  x.el('live-session-handoff').value = '  Im Keller weiter\r\n';
  await x.end();
  x.el('live-session-close-handoff').value = 'Neuere Vorbereitung';
  release();
  await settle();
  const end = x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end');
  assert.equal(end.handoff, '  Im Keller weiter\r\n');
  assert.equal(x.el('live-session-handoff').value, 'Neuere Vorbereitung');
  assert.equal(x.el('live-session-handoff-text').textContent, end.handoff);
  assert.equal(x.el('live-session-close-dialog').open, false);
  assert.equal(x.el('live-session-start').hidden, true);
  assert.equal(x.el('live-session-resume').hidden, false);
  x.el('live-session-resume').click();
  await settle();
  x.el('live-session-resume-groups').querySelector('button').click();
  await settle();
  assert.equal(x.el('live-session-handoff-text').textContent, end.handoff);
  assert.equal(x.el('live-session-handoff').value, 'Neuere Vorbereitung');
  x.el('live-session-handoff').value = '';
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-handoff').value = '';
  x.el('live-session-close-confirm').click();
  await settle();
  assert.equal(x.el('live-session-handoff-preview').hidden, true);
  assert.equal(x.el('live-session-handoff-text').textContent, '');
});

test('a detached next-game group action cannot start a session in another campaign', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  await x.end();
  x.el('live-session-resume').click();
  await settle();
  assert.equal(x.el('live-session-resume-dialog').open, true);
  const old = x.el('live-session-resume-groups').querySelector('button');
  const b = x.store.create('B'),
    w = x.store.activate(b.id);
  const scene = x.store.executeLive({
    commandId: randomUUID(),
    campaignId: b.id,
    token: w.token,
    action: { kind: 'initialize', expectedRosterRevision: 0 },
  }).scene;
  for (const marker of ['start', 'end'])
    x.store.executeLive({
      commandId: randomUUID(),
      campaignId: b.id,
      token: w.token,
      action: {
        kind: 'session-marker',
        sceneId: scene.id,
        expectedRevision: scene.revision,
        marker,
        summary: '',
      },
    });
  x.ui.activateLive(w);
  await x.ui.openLive();
  x.el('live-continue').click();
  await settle();
  x.el('live-session-resume').click();
  await settle();
  assert.equal(x.el('live-session-resume-dialog').open, true);
  const before = x.store.db.serialize();
  old.onclick();
  await settle();
  assert.ok(x.store.db.serialize().equals(before));
  assert.equal(x.el('live-session-resume-dialog').open, true);
  assert.equal(
    x.store.chronicle(w.token).entries.filter((e) => e.sessionMarker === 'start').length,
    1,
  );
  x.el('live-session-resume-groups').querySelector('button').click();
  await settle();
  assert.equal(x.el('live-session-resume-dialog').open, false);
  assert.equal(
    x.store.chronicle(w.token).entries.filter((e) => e.sessionMarker === 'start').length,
    2,
  );
});
test('next-game prep shows the exact opening prose and detached visit actions cannot open another campaign', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    first = randomUUID(),
    next = randomUUID(),
    text = '  Am Tor\r\n**Originaltext**  ';
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Am Tor',
        scenes: [
          { id: first, title: 'Ankunft', notes: '', locationId: null },
          { id: next, title: 'Torwache', notes: 'GM-Hinweis', locationId: null },
        ],
      },
    },
  });
  const detail = x.store.session(x.w.token, planId).visits.find((v) => v.visitId === next);
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: text },
    }),
  );
  const firstDetail = x.store.session(x.w.token, planId).visits.find((v) => v.visitId === first),
    scene = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      planId,
      visitId: first,
      expectedPlanRevision: 1,
      expectedVisitRevision: firstDetail.revision,
      sceneId: scene.id,
      expectedRevision: scene.revision,
    }),
  );
  await x.ui.openLive();
  x.el('live-session-start').click();
  await settle();
  await x.end();
  x.el('live-session-resume').click();
  await settle();
  assert.equal(x.el('live-session-resume-visits').querySelector('blockquote p').textContent, text);
  const old = [...x.el('live-session-resume-visits').querySelectorAll('button')];
  assert.deepEqual(
    old.map((b) => b.textContent),
    ['Übernahme prüfen', 'Mappe öffnen', 'Spielabend beginnen + Text in Szene'],
  );
  const b = x.store.create('B'),
    w = x.store.activate(b.id);
  x.store.executeLive({
    commandId: randomUUID(),
    campaignId: b.id,
    token: w.token,
    action: { kind: 'initialize', expectedRosterRevision: 0 },
  });
  x.ui.activateLive(w);
  await x.ui.openLive();
  await settle();
  let reads = 0;
  const packet = x.window.campaign.sessionPacket;
  x.window.campaign.sessionPacket = async (...args) => {
    reads++;
    return packet(...args);
  };
  const before = x.store.db.serialize(),
    messages = x.messages.length;
  for (const button of old) button.onclick();
  await settle();
  assert.equal(reads, 0);
  assert.equal(x.messages.length, messages);
  assert.ok(x.store.db.serialize().equals(before));
});

test('starting the prepared opening docks its packet and keeps exact prose without adopting the visit or moving time', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    first = randomUUID(),
    next = randomUUID(),
    text = '  Am Tor\r\n**Originaltext**  ';
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Am Tor',
        scenes: [
          { id: first, title: 'Ankunft', notes: '', locationId: null },
          { id: next, title: 'Torwache', notes: 'GM-Hinweis', locationId: null },
        ],
      },
    },
  });
  const detail = x.store.session(x.w.token, planId).visits.find((v) => v.visitId === next);
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: text },
    }),
  );
  const firstDetail = x.store.session(x.w.token, planId).visits.find((v) => v.visitId === first),
    scene = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'apply-visit',
      planId,
      visitId: first,
      expectedPlanRevision: 1,
      expectedVisitRevision: firstDetail.revision,
      sceneId: scene.id,
      expectedRevision: scene.revision,
    }),
  );
  await x.ui.openLive();
  x.el('live-session-start').click();
  await settle();
  await x.end();
  x.el('live-session-resume').click();
  await settle();
  const before = x.store.live(x.w.token).scene,
    starts = x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'start').length;
  [...x.el('live-session-resume-visits').querySelectorAll('button')]
    .find((b) => b.textContent === 'Spielabend beginnen + Text in Szene')
    .click();
  await settle();
  await x.ui.flushLive();
  await settle();
  assert.equal(x.el('live-session-resume-dialog').open, false);
  assert.equal(x.el('session-packet-dialog').parentElement.id, 'live-packet-host');
  assert.equal(x.el('session-packet-content').querySelector('h3').textContent, 'Torwache');
  const reading = x.el('session-packet-content').querySelector('.packet-read-aloud .packet-text');
  assert.equal(reading.querySelector('strong')?.textContent, 'Originaltext');
  assert.match(reading.textContent, /Am Tor\s+Originaltext/);
  const after = x.store.live(x.w.token).scene;
  assert.equal(after.readAloud, text);
  assert.deepEqual(after.adoption, before.adoption);
  assert.deepEqual(after.clock, before.clock);
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'start').length,
    starts + 1,
  );
  assert.deepEqual(
    x.messages.filter((m) => m.error),
    [],
  );
});

for (const raw of ['  Eigene Planung\r\n', ''])
  test(`a late handoff suggestion preserves authored input (${raw ? 'raw text' : 'empty'}) until explicitly adopted`, async (t) => {
    const x = await setup(t);
    x.el('live-session-start').click();
    await settle();
    const read = x.window.campaign.narrativeJournal;
    let release;
    x.window.campaign.narrativeJournal = async (...args) => {
      const result = await read(...args);
      return new Promise((r) => {
        release = () => r(result);
        x.releases.push(release);
      });
    };
    x.el('live-session-end').click();
    await settle();
    assert.equal(x.el('live-session-close-use-suggestion').disabled, true);
    x.el('live-session-close-handoff').value = raw;
    release();
    await settle();
    assert.equal(x.el('live-session-close-handoff').value, raw);
    const suggestion = x.el('live-session-close-suggestion').textContent;
    assert.match(suggestion, /Nächster Einstieg:/);
    x.el('live-session-close-use-suggestion').click();
    assert.equal(x.el('live-session-close-handoff').value, suggestion);
    x.el('live-session-close-x').click();
    assert.equal(x.el('live-session-handoff').value, suggestion);
    assert.equal(
      x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'end').length,
      0,
    );
  });

test('unavailable next-session advice does not prevent closing an audited evening with authored notes', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-handoff').value = '  Eigene Übergabe\r\n';
  x.window.campaign.narrativeJournal = async () => ({
    ok: false,
    error: 'Journal vorübergehend nicht lesbar',
  });
  x.el('live-session-end').click();
  await settle();
  assert.equal(x.el('live-session-close-confirm').disabled, false);
  assert.match(x.el('live-session-close-suggestion').textContent, /nicht verfügbar/);
  assert.equal(x.el('live-session-close-use-suggestion').disabled, true);
  x.el('live-session-close-confirm').click();
  await settle();
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end')?.handoff,
    '  Eigene Übergabe\r\n',
  );
});

test('closing an evening can continue directly into the opening editor before any visit is written', async (t) => {
  const x = await setup(t),
    handoff = '  Weiter am Nordtor\r\n- Die Wache wartet  ';
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-handoff').value = handoff;
  x.el('live-session-close-prepare').click();
  await settle();
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end')?.handoff,
    handoff,
  );
  assert.equal(x.el('live-session-close-dialog').open, false);
  assert.equal(x.el('handoff-visit-dialog').open, true);
  assert.equal(x.el('handoff-visit-notes').value, handoff);
  assert.deepEqual(x.followUps, []);
  x.el('handoff-visit-read-aloud').value = '  Willkommen zurück\r\n';
  x.el('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(x.followUps.length, 1);
  assert.equal(x.followUps[0][0], 'visit');
  assert.equal(x.followUps[0][1], null);
  assert.equal(x.followUps[0][2].notes, handoff);
  assert.equal(x.followUps[0][2].readAloud, '  Willkommen zurück\r\n');
  assert.equal(x.followUps[0][2].newPlan, true);
});

test('the opening editor can request the freshly saved packet in the same handoff', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-handoff').value = 'Einstieg mit Mappe';
  x.el('live-session-close-prepare').click();
  await settle();
  const open = x.el('handoff-visit-open');
  x.el('handoff-visit-form').onsubmit({ preventDefault() {}, submitter: open });
  await settle();
  assert.equal(x.followUps.length, 1);
  assert.equal(x.followUps[0][3], true);
  assert.equal(x.followUps[0][2].notes, 'Einstieg mit Mappe');
  assert.ok(x.messages.some((message) => message.text.includes('GM-Mappe geöffnet')));
});

test('a failed packet open reports the prepared visit without claiming the map is open', async (t) => {
  const x = await setup(t);
  x.openPacketResult = false;
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-handoff').value = 'Einstieg mit beschädigter Mappe';
  x.el('live-session-close-prepare').click();
  await settle();
  const open = x.el('handoff-visit-open');
  x.el('handoff-visit-form').onsubmit({ preventDefault() {}, submitter: open });
  await settle();
  assert.equal(x.followUps.length, 1);
  assert.equal(x.el('handoff-visit-dialog').open, false);
  assert.ok(
    x.messages.some(
      (message) => message.error && message.text.includes('konnte nicht geöffnet werden'),
    ),
  );
  assert.equal(
    x.messages.some((message) => message.text.includes('GM-Mappe geöffnet')),
    false,
  );
});

test('missing optional opening advice still leaves a minimal editor after the ending is confirmed', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.window.campaign.narrativeJournal = async () => ({
    ok: false,
    error: 'Journal vorübergehend nicht lesbar',
  });
  x.el('live-session-end').click();
  await settle();
  assert.equal(x.el('live-session-close-prepare').disabled, false);
  x.el('live-session-close-handoff').value = 'Eigene Basis';
  x.el('live-session-close-prepare').click();
  await settle();
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end')?.handoff,
    'Eigene Basis',
  );
  assert.equal(x.el('handoff-visit-dialog').open, true);
  assert.equal(x.el('handoff-visit-notes').value, 'Eigene Basis');
  assert.match(x.el('handoff-visit-sources').textContent, /Keine offene Ortsquelle/);
  x.el('handoff-visit-cancel').click();
  assert.deepEqual(x.followUps, []);
});

test('an unplayed plan supplies the next opening without adopting its visit or moving time', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    visitId = randomUUID(),
    text = '  Unverbrauchte Eröffnung\r\n';
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Neuer Abend',
        scenes: [{ id: visitId, title: 'Erster Besuch', notes: 'Vorbereitung', locationId: null }],
      },
    },
  });
  const detail = x.store.session(x.w.token, planId).visits.find((v) => v.visitId === visitId);
  x.store.executeSession(
    x.command({
      kind: 'visit',
      planId,
      expectedRevision: detail.revision,
      detail: { ...detail, readAloud: text },
    }),
  );
  await x.ui.openLive();
  x.el('live-session-start').click();
  await settle();
  await x.end();
  x.el('live-session-resume').click();
  await settle();
  assert.equal(x.el('live-session-resume-visits').querySelector('blockquote p')?.textContent, text);
  const before = x.store.live(x.w.token).scene;
  [...x.el('live-session-resume-visits').querySelectorAll('button')]
    .find((b) => b.textContent === 'Spielabend beginnen + Text in Szene')
    .click();
  await settle();
  await x.ui.flushLive();
  const after = x.store.live(x.w.token).scene;
  assert.equal(after.readAloud, text);
  assert.deepEqual(after.adoption, before.adoption);
  assert.deepEqual(after.clock, before.clock);
  assert.deepEqual(
    x.messages.filter((m) => m.error),
    [],
  );
});

test('an unresolved initial chronicle leaves the live editor usable and late results cannot replace a newer recap', async (t) => {
  const x = await setup(t),
    reads = [];
  x.window.campaign.chronicle = (token) =>
    new Promise((resolve) => {
      const value = { ok: true, value: x.store.chronicle(token) };
      reads.push({ resolve, value });
      x.releases.push(() => resolve(value));
    });
  let opened = false;
  const opening = x.ui.openLive().then(() => {
    opened = true;
  });
  await settle();
  assert.equal(opened, true, 'optional chronicle must not hold openLive');
  assert.equal(x.el('live-workspace').hidden, false);
  assert.equal(x.el('live-session-start').disabled, true);
  assert.match(x.el('live-session-status').textContent, /geladen|geprüft/);
  x.el('running-notes').value = 'Spielbar während die Chronik fehlt';
  x.el('running-notes').oninput();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).scene.notes, 'Spielbar während die Chronik fehlt');
  const newer = x.ui.openLive();
  await settle();
  assert.equal(reads.length, 2);
  reads[1].resolve({ ok: false, error: 'Neuere Chronik fehlt' });
  await settle();
  assert.match(x.el('live-session-status').textContent, /Neuere Chronik fehlt/);
  reads[0].resolve(reads[0].value);
  await opening;
  await newer;
  await settle();
  assert.match(x.el('live-session-status').textContent, /Neuere Chronik fehlt/);
});

for (const followUp of ['deadline', 'visit'])
  test(`a saved moment opens its ${followUp} preparation with the submitted raw text`, async (t) => {
    const x = await setup(t),
      release = x.defer('scene-content');
    x.el('running-notes').value = 'Offene Szene';
    x.el('running-notes').oninput();
    x.fields('Verstärkung', '  Morgen\r\n- Spuren  ');
    x.el('live-moment-follow-up').value = followUp;
    x.submit();
    await settle();
    x.fields('Neuere Spur', 'Nicht verdrängen');
    release();
    await settle();
    const moment = x.commands.find((c) => c.action.kind === 'live-moment');
    assert.ok(moment);
    assert.equal(moment.action.followUp, null);
    assert.equal(x.followUps.length, 1);
    assert.deepEqual(
      x.followUps[0],
      followUp === 'deadline'
        ? ['deadline', { title: 'Verstärkung', summary: '  Morgen\r\n- Spuren  ', location: null }]
        : [
            'visit',
            null,
            { title: 'Verstärkung', notes: '  Morgen\r\n- Spuren  ', locationId: null },
          ],
    );
    assert.equal(x.el('live-moment-title').value, 'Neuere Spur');
    assert.equal(x.store.preparation(x.w.token).notes.length, 0);
  });
test('a delayed saved moment cannot open follow-up preparation in a different group', async (t) => {
  const x = await setup(t),
    release = x.defer('live-moment');
  x.fields('Frist für alte Gruppe', 'Alte Frist');
  x.el('live-moment-follow-up').value = 'deadline';
  x.submit();
  await settle();
  await x.focusOther();
  x.fields('Neue Gruppe', 'Neue Eingabe');
  release();
  await settle();
  assert.deepEqual(x.followUps, []);
  assert.equal(x.el('live-moment-title').value, 'Neue Gruppe');
});

test('a prepared packet visit opens its adoption review without an extra live resume or preview click', async (t) => {
  const x = await setup(t, false),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Direkter Test',
        scenes: [
          { id: visitId, title: 'Nordtor prüfen', notes: 'Wache befragen', locationId: null },
        ],
      },
    },
  });
  assert.equal(await x.ui.openPlannedVisitReview(planId, visitId), true);
  assert.equal(x.el('adoption-picker').open, true);
  assert.equal(x.el('adoption-plan').value, planId);
  assert.equal(x.el('adoption-visit').value, visitId);
  assert.equal(x.el('adoption-dialog').open, true);
  assert.match(x.el('adoption-content').textContent, /Nordtor prüfen/);
  assert.match(x.el('adoption-content').textContent, /Wache befragen/);
});

for (const action of ['live-session-close-confirm', 'live-session-close-prepare'])
  test(`cancelling a close review during flush revokes ${action} before the marker write`, async (t) => {
    const x = await setup(t);
    x.el('live-session-start').click();
    await settle();
    x.el('live-session-end').click();
    await settle();
    x.el('live-session-close-handoff').value = '  Originale Übergabe\r\n';
    const release = x.defer('scene-content');
    x.el('running-notes').value = 'Offener Szenentext';
    x.el('running-notes').oninput();
    x.el(action).click();
    await settle();
    assert.equal(x.commands.filter((c) => c.action.kind === 'scene-content').length, 1);
    x.el('live-session-close-cancel').click();
    release();
    await settle();
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
        .length,
      0,
    );
    assert.equal(
      x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'end').length,
      0,
    );
    assert.equal(x.el('live-session-handoff').value, '  Originale Übergabe\r\n');
    assert.equal(x.el('handoff-visit-dialog').open, undefined);
    assert.deepEqual(x.followUps, []);
  });
for (const pending of [false, true])
  test(`a close review cannot acquire a different group after its ${pending ? 'pending' : 'completed'} audit`, async (t) => {
    const x = await setup(t);
    x.el('live-session-start').click();
    await settle();
    let release;
    if (pending) {
      const original = x.window.campaign.scenePreparation;
      let held = false;
      x.window.campaign.scenePreparation = (...args) => {
        if (held) return original(...args);
        held = true;
        return new Promise((resolve) => {
          release = () => resolve(original(...args));
          x.releases.push(release);
        });
      };
    }
    x.el('live-session-end').click();
    await settle();
    if (pending) assert.equal(x.el('live-session-close-confirm').disabled, true);
    const other = await x.focusOther();
    if (release) {
      release();
      await settle();
    }
    x.el('live-session-close-prepare').click();
    await settle();
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
        .length,
      0,
    );
    assert.equal(x.store.live(x.w.token).scene.id, other);
    assert.equal(x.el('handoff-visit-dialog').open, undefined);
    assert.deepEqual(x.followUps, []);
  });

test('cancelling after the end marker committed keeps that single ending and opens no follow-up', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  const raw = '  Bestätigte Übergabe\r\n',
    release = x.defer('session-marker');
  x.el('live-session-close-handoff').value = raw;
  x.el('live-session-close-prepare').click();
  await settle();
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.sessionMarker === 'end').length,
    1,
  );
  x.el('live-session-close-cancel').click();
  release();
  await settle();
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
      .length,
    1,
  );
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end').handoff,
    raw,
  );
  assert.equal(x.el('handoff-visit-dialog').open, undefined);
  assert.deepEqual(x.followUps, []);
});
test('the next opening uses confirmed wording while a later recap draft remains separate', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-end').click();
  await settle();
  const raw = '  Bestätigter Einstieg\r\n',
    later = '  Spätere Vorbereitung\r\n',
    release = x.defer('session-marker');
  x.el('live-session-close-handoff').value = raw;
  x.el('live-session-close-prepare').click();
  await settle();
  x.el('live-session-close-handoff').value = later;
  release();
  await settle();
  assert.equal(x.el('handoff-visit-dialog').open, true);
  assert.equal(x.el('handoff-visit-notes').value, raw);
  assert.equal(x.el('live-session-handoff').value, later);
  x.el('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(x.followUps.length, 1);
  assert.equal(x.followUps[0][2].notes, raw);
  assert.equal(x.el('live-session-handoff').value, later);
});
for (const changed of ['clock', 'membership'])
  test(`a close review needs a new audit after the same group's ${changed} changes`, async (t) => {
    const x = await setup(t);
    x.el('live-session-start').click();
    await settle();
    x.el('live-session-end').click();
    await settle();
    let v = x.store.live(x.w.token);
    if (changed === 'clock')
      x.store.executeLive(
        x.command({
          kind: 'advance-clock',
          sceneId: v.scene.id,
          expectedRevision: v.scene.clock.revision,
          amount: 1,
          unit: 'minutes',
          calendarVersion: 'relative-v1',
          reason: 'Zeit weiter',
        }),
      );
    else {
      const hero = v.roster.find((row) => row.id === x.heroes[1].id);
      x.store.executeLive(
        x.command({
          kind: 'membership',
          characterId: hero.id,
          expectedRevision: hero.membershipRevision,
          expectedRosterRevision: v.rosterRevision,
          active: false,
          targetSceneId: null,
          expectedFocusRevision: v.focusRevision,
        }),
      );
    }
    await x.ui.openLive();
    x.el('live-session-close-confirm').click();
    await settle();
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
        .length,
      0,
    );
    assert.match(x.el('live-session-close-status').textContent, /Erneut prüfen/);
    x.el('live-session-close-refresh').click();
    await settle();
    x.el('live-session-close-confirm').click();
    await settle();
    const ends = x.commands.filter(
      (c) => c.action.kind === 'session-marker' && c.action.marker === 'end',
    );
    assert.equal(ends.length, 1);
    assert.equal(ends[0].action.sceneId, x.scene.id);
  });

test('unfinished recap survives a fresh store and does not publish or end the evening', async (t) => {
  const x = await setup(t);
  x.el('live-session-start').click();
  await settle();
  x.el('live-session-summary').value = 'Mira gab den Brief zurück.';
  x.el('live-session-summary').dispatchEvent(new x.window.Event('input'));
  x.el('live-session-handoff').value = 'Morgen: Zollhaus. Schlüssel bei Ada.';
  x.el('live-session-handoff').dispatchEvent(new x.window.Event('input'));
  await settle();
  assert.equal(await x.ui.flushLive(), true);
  const fresh = new x.CampaignStore(path.join(x.root, 'store.sqlite'));
  try {
    const w = fresh.activate(x.w.campaign.id);
    assert.deepEqual(fresh.live(w.token).recapDraft, {
      summary: 'Mira gab den Brief zurück.',
      handoff: 'Morgen: Zollhaus. Schlüssel bei Ada.',
    });
    assert.equal(fresh.chronicle(w.token).latestSessionMarker.sessionMarker, 'start');
  } finally {
    fresh.close();
  }
  const draft = x.store.live(x.w.token).recapDraft;
  x.store.keepSessionRecapDraft(x.w.token, draft, null); // lost-ack replay is safe
  assert.throws(
    () => x.store.keepSessionRecapDraft(x.w.token, { summary: 'stale', handoff: '' }, null),
    /anderer Stelle/,
  );
  assert.deepEqual(x.store.live(x.w.token).recapDraft, draft);
});
test('recap save recovers a lost reply, preserves newer input and blocks close on a conflicting draft', async (t) => {
  const x = await setup(t);
  const original = x.window.campaign.keepSessionRecapDraft;
  let lost = true;
  x.window.campaign.keepSessionRecapDraft = async (...args) => {
    const result = await original(...args);
    if (lost) {
      lost = false;
      throw new Error('lost reply');
    }
    return result;
  };
  x.el('live-session-summary').value = 'Erste Notiz';
  x.el('live-session-summary').dispatchEvent(new x.window.Event('input'));
  x.el('live-session-summary').value = 'Neuere Notiz';
  x.el('live-session-summary').dispatchEvent(new x.window.Event('input'));
  await settle();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).recapDraft.summary, 'Neuere Notiz');
  const basis = x.store.live(x.w.token).recapDraft;
  x.store.keepSessionRecapDraft(x.w.token, { summary: 'Anderes Fenster', handoff: '' }, basis);
  x.el('live-session-summary').value = 'Eigener neuer Text';
  x.el('live-session-summary').dispatchEvent(new x.window.Event('input'));
  await settle();
  assert.equal(await x.ui.flushLive(), false);
  assert.equal(x.el('live-session-summary').value, 'Eigener neuer Text');
  assert.equal(x.store.live(x.w.token).recapDraft.summary, 'Anderes Fenster');
  assert.match(x.el('live-session-draft-status').textContent, /nicht gesichert/);
  x.window.confirm = () => false;
  x.el('live-session-draft-retry').click();
  await settle();
  assert.equal(x.store.live(x.w.token).recapDraft.summary, 'Anderes Fenster');
  assert.equal(x.el('live-session-summary').value, 'Eigener neuer Text');
  x.window.confirm = () => true;
  x.el('live-session-draft-retry').click();
  await settle();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).recapDraft.summary, 'Eigener neuer Text');
});

test('party setup remains available before starting and moves the same editor beside live notes', async (t) => {
  const x = await setup(t, false, false),
    panel = x.el('live-party-panel'),
    profile = x.el('character-name');
  assert.equal(panel.parentElement.id, 'live-party-start');
  assert.equal(panel.closest('#running-editor'), null);
  x.el('live-party-details').open = true;
  profile.value = 'Ada am Tisch';
  profile.oninput();
  x.el('live-continue').click();
  await settle();
  assert.equal(x.el('live-party-panel'), panel);
  assert.equal(x.el('character-name'), profile);
  assert.equal(panel.parentElement.id, 'live-party-at-table');
  assert.equal(x.el('live-party-details').open, true);
  assert.equal(profile.value, 'Ada am Tisch');
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).roster[0].profile.name, 'Ada am Tisch');
});

test('reopening a saved focused group displays its scene without any session mutation', async (t) => {
  const x = await setup(t, false);
  assert.equal(x.el('running-editor').hidden, false);
  assert.equal(x.el('live-continue').hidden, true);
  assert.equal(x.commands.length, 0);
  x.el('running-notes').value = 'Ada fragt nach dem Schlüssel';
  x.el('running-notes').oninput();
  assert.equal(await x.ui.flushLive(), true);
  const other = await x.focusOther();
  const before = x.store.db.serialize(),
    commands = x.commands.length;
  x.ui.activateLive(x.w);
  await x.ui.openLive();
  await settle();
  assert.equal(x.el('running-editor').hidden, false);
  assert.equal(x.el('scene-focus').value, other);
  assert.equal(x.el('running-title').value, 'Andere Gruppe');
  assert.equal(x.commands.length, commands);
  assert.ok(x.store.db.serialize().equals(before));
});
test('an empty campaign still requires explicit group initialization', async (t) => {
  const x = await setup(t, false, false);
  assert.equal(x.el('running-editor').hidden, true);
  assert.equal(x.el('live-continue').hidden, false);
  assert.equal(x.store.live(x.w.token).scene, null);
  assert.equal(x.commands.length, 0);
  x.el('live-continue').click();
  await settle();
  assert.equal(x.el('running-editor').hidden, false);
  assert.equal(x.commands.filter((c) => c.action.kind === 'initialize').length, 1);
  assert.equal(x.commands.filter((c) => c.action.kind === 'session-marker').length, 0);
});

for (const raw of ['{"summary":', '[]'])
  test(`unreadable persisted recap ${raw} keeps live notes usable and reloads only the recovered recap`, async (t) => {
    const x = await setup(t, true, true, raw);
    await settle();
    assert.equal(x.el('live-workspace').hidden, false);
    assert.match(x.el('live-session-draft-status').textContent, /Rückblickentwurf/);
    assert.equal(x.el('live-session-summary').readOnly, true);
    assert.equal(x.el('live-session-draft-retry').hidden, false);
    assert.equal(x.el('live-session-end').disabled, true);
    x.el('running-notes').value = 'Scene bleibt bedienbar';
    x.el('running-notes').oninput();
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(x.store.live(x.w.token).scene.notes, 'Scene bleibt bedienbar');
    assert.equal(
      x.store.db
        .prepare('SELECT value FROM settings WHERE key=?')
        .get('session-recap:' + x.w.campaign.id).value,
      raw,
    );
    const restored = { summary: '  Wiederhergestellt\r\n', handoff: 'Am Tor' };
    x.store.db
      .prepare('UPDATE settings SET value=? WHERE key=?')
      .run(JSON.stringify(restored), 'session-recap:' + x.w.campaign.id);
    x.el('running-notes').value = 'Noch offene Sceneeingabe';
    x.el('running-notes').oninput();
    x.el('live-session-draft-retry').click();
    await settle();
    assert.equal(x.el('running-notes').value, 'Noch offene Sceneeingabe');
    assert.equal(x.el('live-session-summary').value, restored.summary);
    assert.equal(x.el('live-session-handoff').value, restored.handoff);
    assert.equal(x.el('live-session-summary').readOnly, false);
    assert.equal(x.el('live-session-end').disabled, false);
    assert.deepEqual(x.store.live(x.w.token).recapDraft, restored);
    assert.equal(x.commands.filter((c) => c.action.kind === 'session-marker').length, 0);
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(x.store.live(x.w.token).scene.notes, 'Noch offene Sceneeingabe');
  });

test('unreadable persisted recap preserves a dirty local note and still requires a deliberate replacement', async (t) => {
  const x = await setup(t),
    keep = x.window.campaign.keepSessionRecapDraft;
  x.window.campaign.keepSessionRecapDraft = async () => ({
    ok: false,
    error: 'Write unterbrochen',
  });
  x.el('live-session-summary').value = 'Eigene offene Notiz';
  x.el('live-session-summary').dispatchEvent(new x.window.Event('input'));
  await settle();
  assert.equal(await x.ui.flushLive(), false);
  x.store.db
    .prepare('INSERT INTO settings VALUES(?,?)')
    .run('session-recap:' + x.w.campaign.id, '[]');
  await x.ui.openLive();
  assert.equal(x.el('live-workspace').hidden, false);
  assert.equal(x.el('live-session-summary').value, 'Eigene offene Notiz');
  assert.equal(x.el('live-session-summary').readOnly, true);
  assert.equal(await x.ui.flushLive(), false);
  const restored = { summary: 'Andere wiederhergestellte Fassung', handoff: '' };
  x.store.db
    .prepare('UPDATE settings SET value=? WHERE key=?')
    .run(JSON.stringify(restored), 'session-recap:' + x.w.campaign.id);
  x.window.campaign.keepSessionRecapDraft = keep;
  x.window.confirm = () => false;
  x.el('live-session-draft-retry').click();
  await settle();
  assert.equal(x.el('live-session-summary').value, 'Eigene offene Notiz');
  assert.deepEqual(x.store.live(x.w.token).recapDraft, restored);
  x.window.confirm = () => true;
  x.el('live-session-draft-retry').click();
  await settle();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).recapDraft.summary, 'Eigene offene Notiz');
});

test('unreadable recap reload cannot put the former campaigns recovered text into the next campaign', async (t) => {
  const x = await setup(t, true, true, '[]'),
    restored = { summary: 'Nur in der ersten Kampagne', handoff: 'Bleibt dort' };
  x.store.db
    .prepare('UPDATE settings SET value=? WHERE key=?')
    .run(JSON.stringify(restored), 'session-recap:' + x.w.campaign.id);
  const live = x.window.campaign.live;
  let release,
    hold = true;
  const gate = new Promise((r) => (release = r));
  x.releases.push(() => release());
  x.window.campaign.live = async (token) => {
    const result = await live(token);
    if (hold) {
      hold = false;
      await gate;
    }
    return result;
  };
  x.el('live-session-draft-retry').click();
  await settle();
  const other = x.store.create('Zweiter Tisch'),
    w = x.store.activate(other.id);
  x.ui.activateLive(w);
  await x.ui.openLive();
  release();
  await settle();
  assert.equal(x.el('live-session-summary').value, '');
  assert.equal(x.el('live-session-handoff').value, '');
  assert.equal(x.el('live-session-summary').readOnly, false);
  assert.equal(x.store.live(w.token).recapDraft, null);
});

test('party health desk reuses the existing writer and preserves separate character drafts across close and selection', async (t) => {
  const x = await setup(t),
    section = x.el('character-health'),
    current = x.el('health-current');
  x.window.campaign.executeProgress = async (cmd) => {
    try {
      return { ok: true, value: x.store.executeProgress(cmd) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  const open = async (name) => {
    [...x.el('live-party-reference').querySelectorAll('button')]
      .find((b) => b.textContent.startsWith(name))
      .click();
    await settle();
  };
  const input = (id, value) => {
    x.el(id).value = value;
    x.el(id).dispatchEvent(new x.window.Event('input'));
  };
  await open('Ada');
  assert.equal(x.el('live-health-dialog').open, true);
  assert.match(x.el('live-health-title').textContent, /Ada/);
  assert.equal(section.parentElement.id, 'live-health-slot');
  assert.equal(x.el('health-current'), current);
  assert.equal(x.el('health-controls').open, true);
  assert.equal(x.el('health-adjust').hidden, true);
  input('health-current', '6');
  input('health-maximum', '12');
  input('health-temporary', '0');
  x.el('health-form').onsubmit({ preventDefault() {} });
  assert.equal(await x.ui.flushLive(), true);
  await settle();
  assert.equal(x.store.progress(x.w.token).characters.find((c) => c.name === 'Ada').health.hp, 6);
  assert.equal(x.el('health-adjust').hidden, false);
  x.el('live-health-close').click();
  assert.equal(section.parentElement.id, 'character-health-home');
  await open('Borin');
  assert.match(x.el('live-health-title').textContent, /Borin/);
  assert.equal(current.value, '');
  input('health-current', '10');
  input('health-maximum', '10');
  input('health-temporary', '0');
  input('health-conditions', 'Liegend');
  x.el('live-health-close').click();
  assert.match(x.el('live-party-reference').textContent, /HP-Eingabe offen/);
  await open('Ada');
  assert.equal(current.value, '6');
  assert.equal(x.el('health-conditions').value, '');
  x.el('live-health-close').click();
  await open('Borin');
  assert.equal(current.value, '10');
  assert.equal(x.el('health-conditions').value, 'Liegend');
  assert.match(x.el('health-draft-status').textContent, /offen/);
  x.el('live-health-dialog').dispatchEvent(new x.window.Event('close'));
  assert.equal(
    section.parentElement.id,
    'live-health-slot',
    'a queued old close event must not dismantle a reopened desk',
  );
  x.el('health-form').onsubmit({ preventDefault() {} });
  assert.equal(await x.ui.flushLive(), true);
  await settle();
  const party = x.store.progress(x.w.token).characters;
  assert.ok(party.find((c) => c.name === 'Borin').health, JSON.stringify(x.messages));
  assert.equal(party.find((c) => c.name === 'Borin').health.hp, 10);
  assert.equal(party.find((c) => c.name === 'Borin').health.conditions, 'Liegend');
  assert.equal(party.find((c) => c.name === 'Ada').health.hp, 6);
  x.el('live-health-dialog').open = false;
  x.el('live-health-dialog').dispatchEvent(new x.window.Event('close'));
  assert.equal(section.parentElement.id, 'character-health-home');
});
test('an open health desk closes on group change and detached old party cards cannot open another group character', async (t) => {
  const x = await setup(t),
    old = [...x.el('live-party-reference').querySelectorAll('button')].find((b) =>
      b.textContent.startsWith('Ada'),
    );
  old.click();
  await settle();
  assert.equal(x.el('live-health-dialog').open, true);
  await x.focusOther();
  await settle();
  assert.equal(x.el('live-health-dialog').open, false);
  assert.equal(x.el('character-health').parentElement.id, 'character-health-home');
  old.click();
  await settle();
  assert.equal(x.el('live-health-dialog').open, false);
  assert.match(x.el('running-title').value, /Andere Gruppe/);
});

test('health feedback stays visible inside the desk and a rejected write preserves its authored values', async (t) => {
  const x = await setup(t);
  x.window.campaign.executeProgress = async () => ({
    ok: false,
    error: 'HP konnten nicht gespeichert werden',
  });
  x.window.campaign.commitStatus = async () => ({ ok: true, value: { outcome: 'not-applied' } });
  x.el('live-party-reference').querySelector('button').click();
  await settle();
  for (const [id, value] of [
    ['health-current', '5'],
    ['health-maximum', '10'],
    ['health-temporary', '0'],
  ]) {
    x.el(id).value = value;
    x.el(id).dispatchEvent(new x.window.Event('input'));
  }
  x.el('health-form').onsubmit({ preventDefault() {} });
  assert.equal(await x.ui.flushLive(), false);
  await settle();
  assert.match(x.el('live-health-status').textContent, /HP konnten nicht gespeichert/);
  assert.equal(x.el('live-health-status').className, 'error');
  assert.equal(x.el('health-current').value, '5');
  assert.equal(x.store.progress(x.w.token).characters[0].health, null);
});

test('new live participant joins without an optional health interruption and keeps the same editor available', async (t) => {
  const x = await setup(t);
  x.window.campaign.executeProgress = async (cmd) => {
    try {
      return { ok: true, value: x.store.executeProgress(cmd) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };
  x.el('live-party-new').click();
  assert.equal(x.el('character-dialog').open, true);
  assert.match(x.el('character-create-target').textContent, /Heute dabei/);
  x.el('new-character-name').value = 'Cora';
  x.el('character-form').onsubmit({
    preventDefault() {},
    submitter: x.el('character-create-active'),
  });
  await settle();
  await x.ui.flushLive();
  await settle();
  const live = x.store.live(x.w.token),
    c = live.roster.find((c) => c.profile.name === 'Cora');
  assert.ok(c.active);
  assert.equal(c.sceneId, x.scene.id);
  assert.equal(live.roster.length, 3);
  assert.equal(x.el('character-dialog').open, false);
  assert.equal(!!x.el('live-health-dialog').open, false);
  assert.match(x.messages.at(-1).text, /Cora ist heute dabei/);
  [...x.el('live-party-reference').querySelectorAll('button')]
    .find((b) => b.textContent.startsWith('Cora'))
    .click();
  await settle();
  assert.equal(x.el('live-health-dialog').open, true);
  assert.match(x.el('live-health-title').textContent, /Cora/);
  assert.equal(x.el('character-health').parentElement.id, 'live-health-slot');
  assert.equal(x.el('health-controls').open, true);
  assert.deepEqual(
    x.commands
      .filter((c) => ['create-character', 'membership'].includes(c.action.kind))
      .map((c) => c.action.kind),
    ['create-character', 'membership'],
  );
  x.el('health-current').value = '7';
  x.el('health-maximum').value = '9';
  x.el('health-current').dispatchEvent(new x.window.Event('input'));
  x.el('health-form').onsubmit({ preventDefault() {} });
  await settle();
  await x.ui.flushLive();
  assert.equal(
    x.store.progress(x.w.token).characters.find((p) => p.characterId === c.id).health.hp,
    7,
  );
});
test('roster-only creation stays inactive and reveals its next action without adding a live participant', async (t) => {
  const x = await setup(t);
  x.el('character-toggle').scrollIntoView = () => {};
  let shown = false;
  x.el('character-editor').scrollIntoView = () => {
    shown = true;
  };
  x.el('character-new').click();
  x.el('new-character-name').value = 'Reserve';
  x.el('character-form').onsubmit({ preventDefault() {}, submitter: x.el('character-create') });
  await settle();
  await x.ui.flushLive();
  const c = x.store.live(x.w.token).roster.find((c) => c.profile.name === 'Reserve');
  assert.equal(c.active, false);
  assert.equal(c.sceneId, null);
  assert.ok(shown);
  assert.equal(x.el('live-party-details').open, true);
  assert.equal(x.el('character-name').value, 'Reserve');
  assert.match(x.el('character-result').textContent, /im Roster angelegt/);
  assert.equal(!!x.el('live-health-dialog').open, false);
  assert.equal(x.commands.filter((c) => c.action.kind === 'membership').length, 0);
});
test('group switch during creation keeps one inactive figure and never applies the old attendance intent elsewhere', async (t) => {
  const x = await setup(t);
  x.el('character-toggle').scrollIntoView = () => {};
  x.el('character-editor').scrollIntoView = () => {};
  const release = x.defer('create-character');
  x.el('live-party-new').click();
  x.el('new-character-name').value = 'Später';
  const event = { preventDefault() {}, submitter: x.el('character-create-active') };
  x.el('character-form').onsubmit(event);
  await settle();
  x.el('character-form').onsubmit(event);
  await x.focusOther();
  release();
  await settle();
  await x.ui.flushLive();
  const roster = x.store.live(x.w.token).roster.filter((c) => c.profile.name === 'Später');
  assert.equal(roster.length, 1);
  assert.equal(roster[0].active, false);
  assert.equal(x.commands.filter((c) => c.action.kind === 'membership').length, 0);
  assert.match(x.el('character-result').textContent, /Aktivierung nicht bestätigt/);
});
test('a rejected attendance write cannot duplicate its already-created figure', async (t) => {
  const x = await setup(t);
  x.el('character-toggle').scrollIntoView = () => {};
  x.el('character-editor').scrollIntoView = () => {};
  const original = x.window.campaign.executeLive;
  x.window.campaign.executeLive = async (command) =>
    command.action.kind === 'membership'
      ? { ok: false, error: 'Nicht übernommen' }
      : original(command);
  x.el('live-party-new').click();
  x.el('new-character-name').value = 'Bleibt erhalten';
  const event = { preventDefault() {}, submitter: x.el('character-create-active') };
  x.el('character-form').onsubmit(event);
  await settle();
  await x.ui.flushLive();
  x.el('character-form').onsubmit(event);
  await settle();
  const roster = x.store.live(x.w.token).roster.filter((c) => c.profile.name === 'Bleibt erhalten');
  assert.equal(roster.length, 1);
  assert.equal(roster[0].active, false);
  assert.equal(x.el('character-dialog').open, false);
  assert.match(x.el('character-result').textContent, /Aktivierung nicht bestätigt/);
  assert.equal(x.el('live-reconcile').hidden, false);
});

async function packetMoment(t, text) {
  const x = await setup(t),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Originaltexte',
        scenes: [{ id: visitId, title: 'Wache', notes: text, locationId: null }],
      },
    },
  });
  await x.ui.openLive();
  x.el('live-session-plan').value = planId;
  x.el('live-session-plan').dispatchEvent(new x.window.Event('change'));
  await settle();
  x.el('live-session-packet').click();
  await settle();
  const block = [...x.el('session-packet-content').querySelectorAll('.packet-block')].find(
    (b) => b.querySelector('.packet-text').textContent === text,
  );
  assert.ok(block, 'Prepared source appears verbatim in the packet');
  x.el('live-moment-panel').scrollIntoView = () => {};
  return {
    ...x,
    capture: () =>
      [...block.querySelectorAll('button')]
        .find((b) => b.textContent === 'Als Chronikmoment vormerken')
        .click(),
    source: () => x.store.preparation(x.w.token).plans.find((p) => p.id === planId).scenes[0].notes,
  };
}
for (const [previous, text] of [
  ['', '  Anfang\r\n' + 'x'.repeat(6100) + '\r\n  Ende  '],
  ['V'.repeat(98), 'Q'.repeat(9900)],
])
  test(
    'packet capture preserves full raw wording up to the moment limit, total=' +
      [previous, text].filter(Boolean).join('\n\n').length,
    async (t) => {
      const x = await packetMoment(t, text),
        expected = [previous, text].filter(Boolean).join('\n\n');
      x.fields('Eigener Moment', previous);
      const before = x.store.db.serialize();
      x.capture();
      await settle();
      assert.equal(x.el('live-moment-summary').value, expected);
      assert.equal(x.el('live-moment-title').value, 'Eigener Moment');
      assert.equal(x.el('live-moment-category').value, 'narrative');
      assert.equal(x.store.live(x.w.token).scene.momentDraft.summary, expected);
      assert.equal(
        x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Eigener Moment').length,
        0,
      );
      assert.deepEqual(
        x.messages.filter((m) => m.error),
        [],
      );
      x.submit();
      await settle();
      assert.equal(
        x.store.chronicle(x.w.token).entries.find((e) => e.title === 'Eigener Moment').summary,
        expected,
      );
      assert.equal(x.source(), text);
    },
  );
for (const [previous, text] of [
  ['', 'Q'.repeat(10001)],
  ['  Eigene Notiz\r\n' + 'V'.repeat(9850), 'Q'.repeat(200)],
])
  test(
    'oversized packet capture leaves authored moment and source untouched, existing=' +
      previous.length,
    async (t) => {
      const x = await packetMoment(t, text);
      x.fields('Eigener Moment', previous);
      x.el('live-moment-follow-up').value = 'rumor';
      const before = x.store.db.serialize();
      x.capture();
      await settle();
      assert.equal(x.el('live-moment-summary').value, previous);
      assert.equal(x.el('live-moment-title').value, 'Eigener Moment');
      assert.equal(x.el('live-moment-category').value, 'narrative');
      assert.equal(x.el('live-moment-follow-up').value, 'rumor');
      assert.match(x.messages.at(-1).text, /10\.000/);
      assert.equal(x.messages.at(-1).error, true);
      assert.ok(x.store.db.serialize().equals(before));
      assert.equal(x.source(), text);
    },
  );

test('the empty campaign exposes figure creation and its first submit stays roster-only without a hidden activation default', async (t) => {
  const x = await setup(t),
    c = x.store.create('Erster Abend'),
    w = x.store.activate(c.id);
  x.ui.activateLive(w);
  await x.ui.openLive();
  assert.equal(x.el('live-party-details').open, true);
  x.el('character-editor').scrollIntoView = () => {};
  x.el('character-toggle').scrollIntoView = () => {};
  const before = x.commands.length;
  x.el('character-new').click();
  assert.equal(x.el('character-create-active').hidden, true);
  const submit = [...x.el('character-form').querySelectorAll('button')].find(
    (button) => button.type === 'submit',
  );
  assert.equal(submit.id, 'character-create');
  x.el('new-character-name').value = 'Gila';
  x.el('character-form').onsubmit({ preventDefault() {}, submitter: submit });
  await settle();
  await x.ui.flushLive();
  const live = x.store.live(w.token);
  assert.equal(live.scene, null);
  assert.equal(live.roster.length, 1);
  assert.equal(live.roster[0].profile.name, 'Gila');
  assert.equal(live.roster[0].active, false);
  assert.deepEqual(
    x.commands.slice(before).map((c) => c.action.kind),
    ['create-character'],
  );
  assert.equal(x.el('character-dialog').open, false);
});

test('other split groups stay outside roster details and switch only after saving the current notes', async (t) => {
  const x = await setup(t),
    other = await x.focusOther(),
    select = x.el('scene-focus');
  let focused = 0;
  select.focus = () => focused++;
  const cards = x.el('group-list');
  assert.equal(cards.parentElement.id, 'live-focus-bar');
  assert.equal(cards.closest('details'), null);
  assert.equal(cards.hidden, false);
  assert.equal(cards.querySelectorAll('button').length, 1);
  assert.match(cards.textContent, /Ada/);
  assert.doesNotMatch(cards.textContent, /Borin/);
  x.el('running-notes').value = 'Borin fragt nach dem blauen Tuch';
  x.el('running-notes').oninput();
  cards.querySelector('button').click();
  await settle();
  assert.equal(x.store.live(x.w.token).focusId, x.scene.id);
  assert.equal(focused, 1);
  assert.equal(x.store.liveScene(x.w.token, other).notes, 'Borin fragt nach dem blauen Tuch');
  assert.equal(x.el('running-notes').value, '');
  assert.match(cards.textContent, /Borin/);
  x.el('running-notes').value = 'Ada findet Seilfasern';
  x.el('running-notes').oninput();
  cards.querySelector('button').click();
  await settle();
  assert.equal(x.store.live(x.w.token).focusId, other);
  assert.equal(x.el('running-notes').value, 'Borin fragt nach dem blauen Tuch');
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).notes, 'Ada findet Seilfasern');
  assert.deepEqual(
    x.store
      .live(x.w.token)
      .roster.filter((c) => c.active)
      .map((c) => [c.profile.name, c.sceneId]),
    [
      ['Ada', x.scene.id],
      ['Borin', other],
    ],
  );
});

test('split time inputs follow their scene and retain unfinished raw values without advancing either clock', async (t) => {
  const x = await setup(t);
  x.el('time-amount').value = '';
  x.el('time-unit').value = 'hours';
  x.el('time-reason').value = 'Ada untersucht Seilfasern';
  const other = await x.focusOther(),
    before = x.store.live(x.w.token).scenes.map((s) => [s.id, s.clock]);
  assert.equal(x.el('time-reason').value, '');
  assert.equal(x.el('time-amount').value, '10');
  assert.equal(x.el('time-unit').value, 'minutes');
  x.el('time-amount').value = '5';
  x.el('time-reason').value = 'Borin fragt Nera';
  x.el('group-list').querySelector('button').click();
  await settle();
  assert.equal(x.el('time-reason').value, 'Ada untersucht Seilfasern');
  assert.equal(x.el('time-amount').value, '');
  assert.equal(x.el('time-unit').value, 'hours');
  x.el('group-list').querySelector('button').click();
  await settle();
  assert.equal(x.store.live(x.w.token).focusId, other);
  assert.equal(x.el('time-reason').value, 'Borin fragt Nera');
  assert.equal(x.el('time-amount').value, '5');
  assert.deepEqual(
    x.store.live(x.w.token).scenes.map((s) => [s.id, s.clock]),
    before,
  );
});

for (const failed of [false, true])
  test(`a late ${failed ? 'failed' : 'successful'} live refresh cannot replace a newer group`, async (t) => {
    const x = await setup(t),
      read = x.window.campaign.live,
      oldView = await read(x.w.token);
    let release;
    const held = new Promise((r) => (release = r));
    x.releases.push(() => release(oldView));
    let first = true;
    x.window.campaign.live = (...args) => {
      if (first) {
        first = false;
        return held;
      }
      return read(...args);
    };
    const loading = x.ui.openLive();
    await settle();
    const id = await x.focusOther();
    x.messages.length = 0;
    release(failed ? { ok: false, error: 'Überholte Sceneantwort' } : oldView);
    await loading;
    await settle();
    assert.equal(x.el('live-workspace').hidden, false);
    assert.equal(x.el('scene-focus').value, id);
    assert.equal(x.el('running-title').value, 'Andere Gruppe');
    assert.deepEqual(x.messages, []);
  });
test('reactivating the same workspace invalidates its previous live failure', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.live;
  let release;
  const held = new Promise((r) => (release = r));
  x.releases.push(() => release({ ok: false, error: 'Alte Aktivierung' }));
  x.window.campaign.live = () => held;
  const loading = x.ui.openLive();
  await settle();
  x.ui.activateLive(x.w);
  x.window.campaign.live = read;
  await x.ui.openLive();
  x.messages.length = 0;
  release({ ok: false, error: 'Alte Aktivierung' });
  await loading;
  assert.equal(x.el('live-workspace').hidden, false);
  assert.equal(x.el('scene-focus').value, x.scene.id);
  assert.deepEqual(x.messages, []);
});
for (const saveFirst of [false, true])
  test(`a live read cannot overwrite ${saveFirst ? 'a confirmed save' : 'newer unsaved scene text'}`, async (t) => {
    const x = await setup(t),
      read = x.window.campaign.live,
      oldView = await read(x.w.token);
    let release;
    const held = new Promise((r) => (release = r));
    x.releases.push(() => release(oldView));
    x.window.campaign.live = () => held;
    const text = '  Neuere Sceneprosa\r\n';
    const edit = () => {
      x.el('running-notes').value = text;
      x.el('running-notes').oninput();
    };
    if (saveFirst) edit();
    const loading = x.ui.openLive();
    await settle();
    if (saveFirst) assert.equal(await x.ui.flushLive(), true);
    else edit();
    release(oldView);
    await loading;
    await settle();
    assert.equal(x.el('running-notes').value, text);
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(x.store.live(x.w.token).scene.notes, text);
    const fresh = new x.CampaignStore(path.join(x.root, 'store.sqlite'));
    try {
      assert.equal(fresh.live(fresh.activate(x.w.campaign.id).token).scene.notes, text);
    } finally {
      fresh.close();
    }
  });
test('a refresh retains same-scene prose and its original revision instead of overwriting concurrent content', async (t) => {
  const x = await setup(t),
    local = 'Eigene noch offene Szenennotiz',
    other = 'Anderswo bestätigte Szenennotiz';
  x.el('running-notes').value = local;
  x.el('running-notes').oninput();
  const scene = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      title: scene.title,
      notes: other,
      readAloud: scene.readAloud,
      locationId: scene.locationId,
    }),
  );
  await x.ui.openLive();
  assert.equal(x.el('running-notes').value, local);
  assert.equal(
    await x.ui.flushLive(),
    false,
    'the original revision must still protect concurrent server content',
  );
  assert.equal(x.store.live(x.w.token).scene.notes, other);
  assert.equal(x.el('running-notes').value, local);
  assert.equal(x.el('live-reconcile').hidden, false);
});
test('a failed refresh retains edited prose through retry while clean profiles adopt the confirmed update', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.live,
    text = 'Offene Notiz über einen Leseausfall hinweg';
  let autosave;
  globalThis.setTimeout = (run, ms) => {
    if (ms === 700) autosave = run;
    return 1;
  };
  x.el('running-notes').value = text;
  x.el('running-notes').oninput();
  x.window.campaign.live = async () => ({
    ok: false,
    error: 'Szenenstand vorübergehend nicht lesbar',
  });
  await x.ui.openLive();
  assert.equal(x.el('live-workspace').hidden, true);
  const character = x.store.live(x.w.token).roster[0];
  x.store.executeLive(
    x.command({
      kind: 'profile',
      characterId: character.id,
      expectedRevision: character.profileRevision,
      profile: { ...character.profile, name: 'Neu bestätigtes Profil' },
    }),
  );
  assert.equal(await x.ui.flushLive(), true);
  autosave = null;
  x.window.campaign.live = read;
  await x.ui.openLive();
  assert.equal(x.el('running-notes').value, text);
  assert.equal(x.el('character-name').value, 'Neu bestätigtes Profil');
  assert.equal(
    typeof autosave,
    'function',
    'retry resumes the existing autosave after its earlier timer expired',
  );
  autosave();
  await settle();
  assert.equal(x.store.live(x.w.token).scene.notes, text);
  assert.equal(x.store.live(x.w.token).roster[0].profile.name, 'Neu bestätigtes Profil');
});
test('a refresh recognizes confirmed draft content and keeps later scene and profile edits writable', async (t) => {
  const x = await setup(t),
    scene = x.store.live(x.w.token).scene,
    character = x.store.live(x.w.token).roster[0];
  x.el('running-notes').value = 'Bereits bestätigte Notiz';
  x.el('running-notes').oninput();
  x.el('character-name').value = 'Bestätigter Name';
  x.el('character-name').oninput();
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: scene.id,
      expectedRevision: scene.revision,
      title: scene.title,
      notes: 'Bereits bestätigte Notiz',
      readAloud: scene.readAloud,
      locationId: scene.locationId,
    }),
  );
  x.store.executeLive(
    x.command({
      kind: 'profile',
      characterId: character.id,
      expectedRevision: character.profileRevision,
      profile: { ...character.profile, name: 'Bestätigter Name' },
    }),
  );
  await x.ui.openLive();
  x.el('running-notes').value = 'Nächste Notiz';
  x.el('running-notes').oninput();
  x.el('character-name').value = 'Nächster Name';
  x.el('character-name').oninput();
  assert.equal(await x.ui.flushLive(), true);
  const current = x.store.live(x.w.token);
  assert.equal(current.scene.notes, 'Nächste Notiz');
  assert.equal(current.roster[0].profile.name, 'Nächster Name');
});
test('a current live load failure stays visible and can be explicitly retried', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.live;
  x.window.campaign.live = async () => ({ ok: false, error: 'Aktuelle Scene nicht verfügbar' });
  await x.ui.openLive();
  assert.equal(x.el('live-workspace').hidden, true);
  assert.ok(x.messages.some((m) => m.error && m.text === 'Aktuelle Scene nicht verfügbar'));
  x.window.campaign.live = read;
  await x.ui.openLive();
  assert.equal(x.el('live-workspace').hidden, false);
  assert.equal(x.el('scene-focus').value, x.scene.id);
});

test('party loot opens the named owner and returns to that scene card without writing profiles', async (t) => {
  const x = await setup(t),
    scrolls = [],
    focuses = [];
  x.el('ledger-character-heading').scrollIntoView = () => scrolls.push('loot');
  x.el('ledger-character-heading').focus = () => {};
  x.el('live-party-quick').scrollIntoView = () => scrolls.push('party');
  const before = x.store.live(x.w.token);
  const oldHealth = x.el('live-party-reference').querySelector('[data-character-id]');
  assert.match(oldHealth.textContent, /Wahrnehmung —Einsicht —Untersuchung —/);
  assert.match(oldHealth.textContent, /Sprachen: —/);
  x.el('live-party-reference').querySelectorAll('.live-party-loot')[1].click();
  await settle();
  assert.equal(x.el('live-loot-back').hidden, false);
  assert.equal(x.el('ledger-character-heading').textContent, 'Beute: Borin');
  assert.deepEqual(scrolls, ['loot']);
  assert.deepEqual(x.store.live(x.w.token), before);
  assert.equal(x.commands.length, 0);
  x.el('live-party-reference').querySelector('[data-character-id="' + x.heroes[1].id + '"]').focus =
    () => focuses.push('Borin');
  x.el('live-loot-back').click();
  assert.deepEqual(scrolls, ['loot', 'party']);
  assert.deepEqual(focuses, ['Borin']);
  assert.equal(x.el('live-loot-back').hidden, true);
});
test('detached party loot and delayed flush cannot jump after the focused group changes', async (t) => {
  const x = await setup(t),
    scrolls = [];
  x.el('ledger-character-heading').scrollIntoView = () => scrolls.push('loot');
  x.el('ledger-character-heading').focus = () => {};
  const old = x.el('live-party-reference').querySelector('.live-party-loot'),
    release = x.defer('scene-content');
  x.el('running-notes').value = 'Noch offene Szene';
  x.el('running-notes').oninput();
  old.click();
  await settle();
  await x.focusOther();
  release();
  await settle();
  assert.deepEqual(scrolls, []);
  assert.equal(x.el('live-loot-back').hidden, true);
  old.click();
  await settle();
  assert.deepEqual(scrolls, []);
  assert.match(x.el('running-title').value, /Andere Gruppe/);
});
test('leaving a loot owner scene removes the return action', async (t) => {
  const x = await setup(t);
  x.el('ledger-character-heading').scrollIntoView = () => {};
  x.el('ledger-character-heading').focus = () => {};
  x.el('live-party-reference').querySelector('.live-party-loot').click();
  await settle();
  assert.equal(x.el('live-loot-back').hidden, false);
  await x.focusOther();
  assert.equal(x.el('live-loot-back').hidden, true);
});

test('moment draft survives a cold renderer and database reopen without publishing an event', async (t) => {
  const x = await setup(t);
  x.fields('Wachhaus beobachten', '  Rasmus ist nur verdächtig.\r\nNoch nicht bestätigt.  ');
  x.el('live-moment-follow-up').value = 'quest';
  x.el('live-moment-title').dispatchEvent(new x.window.Event('input', { bubbles: true }));
  await x.ui.flushLive();
  const draft = x.store.live(x.w.token).scene.momentDraft;
  assert.equal(draft.summary, '  Rasmus ist nur verdächtig.\r\nNoch nicht bestätigt.  ');
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Wachhaus beobachten').length,
    0,
  );
  assert.equal(x.store.preparation(x.w.token).notes.length, 0);
  const fresh = new x.CampaignStore(path.join(x.root, 'store.sqlite'));
  try {
    const w = fresh.activate(x.w.campaign.id);
    assert.deepEqual(fresh.live(w.token).scene.momentDraft, draft);
  } finally {
    fresh.close();
  }
  x.ui.activateLive(x.w);
  await x.ui.openLive();
  assert.equal(x.el('live-moment-title').value, draft.title);
  assert.equal(x.el('live-moment-summary').value, draft.summary);
  assert.equal(x.el('live-moment-follow-up').value, 'quest');
  assert.equal(x.el('live-moment-panel').open, true);
  assert.match(x.el('live-moment-open').textContent, /Momententwurf/);
  x.submit();
  await settle();
  assert.equal(x.store.live(x.w.token).scene.momentDraft, undefined);
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === draft.title).length,
    1,
  );
  assert.equal(x.store.preparation(x.w.token).notes.length, 1);
});

test('moment draft readback recovers a lost save response and a real failure blocks leaving', async (t) => {
  const x = await setup(t);
  let lose = true;
  const write = x.window.campaign.keepLiveMomentDraft;
  x.window.campaign.keepLiveMomentDraft = async (...args) => {
    const result = await write(...args);
    if (lose) {
      lose = false;
      throw new Error('Antwort verloren');
    }
    return result;
  };
  x.fields('Erhalten', 'Rohtext');
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).scene.momentDraft.title, 'Erhalten');
  x.window.campaign.keepLiveMomentDraft = async () => ({
    ok: false,
    error: 'Datenträger gesperrt',
  });
  x.fields('Neuere Eingabe', 'Nicht verlieren');
  assert.equal(await x.ui.flushLive(), false);
  assert.equal(x.el('live-moment-title').value, 'Neuere Eingabe');
  assert.match(x.el('live-moment-draft-status').textContent, /nicht gesichert/);
  assert.equal(x.store.live(x.w.token).scene.momentDraft.title, 'Erhalten');
});

test('moment draft compare-and-swap preserves concurrent input and clears only the submitted version atomically', async (t) => {
  const x = await setup(t),
    draft = { category: 'world', title: 'Alt', summary: 'Erster Text', followUp: '' },
    newer = { ...draft, title: 'Neuer', summary: 'Andere Fassung' };
  x.store.keepLiveMomentDraft(x.w.token, x.scene.id, draft, null);
  x.store.keepLiveMomentDraft(x.w.token, x.scene.id, newer, draft);
  assert.throws(
    () =>
      x.store.keepLiveMomentDraft(x.w.token, x.scene.id, { ...draft, title: 'Veraltet' }, draft),
    /inzwischen/,
  );
  const v = x.store.live(x.w.token),
    cmd = x.command({
      kind: 'live-moment',
      sceneId: x.scene.id,
      expectedRevision: v.scene.revision,
      category: draft.category,
      title: draft.title,
      summary: draft.summary,
      draft,
    });
  x.store.executeLive(cmd);
  assert.deepEqual(x.store.live(x.w.token).scene.momentDraft, newer);
  x.store.executeLive(cmd);
  assert.equal(x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Alt').length, 1);
  cmd.commandId = randomUUID();
  cmd.action = { ...cmd.action, title: newer.title, summary: newer.summary, draft: newer };
  x.store.executeLive(cmd);
  assert.equal(x.store.live(x.w.token).scene.momentDraft, undefined);
});

test('moment draft entered while the confirmation reply is delayed is retained and secured', async (t) => {
  const x = await setup(t),
    release = x.defer('live-moment');
  x.fields('Bestätigt', 'Erstes Ereignis');
  x.submit();
  await settle();
  x.fields('Nächster Entwurf', 'Neuere Gesprächsnotiz');
  x.el('live-moment-title').dispatchEvent(new x.window.Event('input', { bubbles: true }));
  release();
  await settle();
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.el('live-moment-title').value, 'Nächster Entwurf');
  assert.equal(x.store.live(x.w.token).scene.momentDraft.title, 'Nächster Entwurf');
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Bestätigt').length,
    1,
  );
  assert.equal(
    x.store.chronicle(x.w.token).entries.filter((e) => e.title === 'Nächster Entwurf').length,
    0,
  );
});

test('moment draft follows its scene through independent campaign copy without changing the source', async (t) => {
  const x = await setup(t),
    draft = {
      category: 'narrative',
      title: 'Unfertige Spur',
      summary: '  Original\r\n  ',
      followUp: 'rumor',
    };
  x.store.keepLiveMomentDraft(x.w.token, x.scene.id, draft, null);
  const snapshot = path.join(x.root, 'moment-copy.sqlite');
  await x.store.campaignSnapshot(x.w.token, snapshot);
  const copy = new x.CampaignStore(path.join(x.root, 'copy-moment.sqlite'));
  try {
    const campaign = copy.acceptCampaignSnapshot(snapshot, 'Kopie', {}),
      w = copy.activate(campaign.id),
      scene = copy.live(w.token).scene;
    assert.notEqual(scene.id, x.scene.id);
    assert.deepEqual(scene.momentDraft, draft);
    copy.keepLiveMomentDraft(w.token, scene.id, null, draft);
    assert.deepEqual(x.store.live(x.w.token).scene.momentDraft, draft);
  } finally {
    copy.close();
  }
});

test('corrupt moment draft stays explicit and cannot be replaced while its scene remains readable', async (t) => {
  const x = await setup(t),
    draft = { category: 'world', title: 'Original', summary: 'Erhalten', followUp: '' };
  x.store.keepLiveMomentDraft(x.w.token, x.scene.id, draft, null);
  x.store.db
    .prepare("UPDATE live_moment_draft SET checksum='broken' WHERE campaign_id=? AND scene_id=?")
    .run(x.w.campaign.id, x.scene.id);
  const scene = x.store.live(x.w.token).scene;
  assert.match(scene.momentDraftError, /beschädigt/);
  assert.throws(
    () => x.store.keepLiveMomentDraft(x.w.token, x.scene.id, null, draft),
    /beschädigt/,
  );
  x.ui.activateLive(x.w);
  await x.ui.openLive();
  assert.equal(x.el('live-moment-title').disabled, true);
  assert.equal(x.el('live-moment-retry').disabled, false);
  assert.match(x.el('live-moment-draft-status').textContent, /beschädigt/);
});

test('the first prepared visit initializes a usable focused group and opens its adoption review', async (t) => {
  const x = await setup(t, false, false),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'First evening',
        scenes: [
          {
            id: visitId,
            title: 'Spuren am Mühlbach',
            notes: 'Futter ermöglicht einen friedlichen Weg.',
            locationId: null,
          },
        ],
      },
    },
  });
  assert.equal(x.store.live(x.w.token).scene, null);
  const opened = await x.ui.openPlannedVisitReview(planId, visitId);
  await settle();
  const live = x.store.live(x.w.token);
  assert.equal(opened, true, JSON.stringify(x.messages));
  assert.equal(x.el('scene-focus').value, live.focusId);
  assert.equal(x.el('scene-focus').options.length, 1);
  assert.equal(x.el('adoption-dialog').open, true);
  assert.match(x.el('adoption-content').textContent, /Spuren am Mühlbach/);
  assert.equal(x.commands.filter((c) => c.action.kind === 'initialize').length, 1);
  assert.equal(x.commands.filter((c) => c.action.kind === 'apply-visit').length, 0);
  x.el('adoption-confirm').click();
  await settle();
  const adopted = x.store.live(x.w.token);
  assert.equal(adopted.scene.adoption.visitId, visitId);
  assert.equal(adopted.scene.title, 'Spuren am Mühlbach');
  assert.equal(x.el('scene-focus').value, adopted.focusId);
  assert.deepEqual(adopted.scene.clock, live.scene.clock);
  assert.deepEqual(adopted.scene.members, live.scene.members);
  assert.equal(x.commands.filter((c) => c.action.kind === 'initialize').length, 1);
});

test('first visit review waits for the new scene draft read across real asynchronous boundaries', async (t) => {
  const x = await setup(t, false, false),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Opening',
        scenes: [{ id: visitId, title: 'Am Steg', notes: 'Fischerin suchen', locationId: null }],
      },
    },
  });
  const original = x.window.campaign.sceneCreationDraft;
  let release,
    reads = 0,
    finished = false;
  const held = new Promise((r) => (release = r));
  t.after(() => release());
  x.window.campaign.sceneCreationDraft = async (...args) => {
    reads++;
    await held;
    return original(...args);
  };
  const opening = x.ui.openPlannedVisitReview(planId, visitId).then((result) => {
    finished = true;
    return result;
  });
  await settle();
  assert.equal(reads, 1);
  assert.equal(
    finished,
    false,
    'loading an unrelated quick-entry draft must not discard the handoff',
  );
  release();
  assert.equal(await opening, true);
  assert.equal(x.el('adoption-dialog').open, true);
  assert.match(x.el('adoption-content').textContent, /Am Steg/);
});

test('adoption review describes unmaterialized encounter slots as planned figures without creating actors', async (t) => {
  const x = await setup(t, false, false),
    planId = randomUUID(),
    visitId = randomUUID(),
    encounterId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Guards',
        scenes: [{ id: visitId, title: 'Steg', notes: 'Verhandeln möglich', locationId: null }],
      },
    },
  });
  x.store.saveEncounterPlan({
    ...x.command(null),
    expectedRevision: null,
    plan: {
      id: encounterId,
      revision: 0,
      name: 'Wachen',
      notes: '',
      party: [],
      entries: [{ id: randomUUID(), creatureId: 'guard', count: 2, grouped: false }],
      sources: [],
      catalogHash: '',
    },
  });
  const attached = x.store.executeSession(
      x.command({
        kind: 'attach',
        planId,
        visitId,
        expectedVisitRevision: 0,
        encounterId,
        expectedEncounterRevision: 1,
      }),
    ),
    groupId = attached.visits[0].groupIds[0];
  assert.equal(x.store.groupView(x.w.token, groupId).actors.length, 0);
  assert.equal(await x.ui.openPlannedVisitReview(planId, visitId), true);
  assert.match(x.el('adoption-content').textContent, /2 geplante Figuren/);
  assert.equal(x.store.groupView(x.w.token, groupId).actors.length, 0, 'review stays read-only');
  x.el('adoption-confirm').click();
  await settle();
  const live = x.store.live(x.w.token);
  assert.equal(x.store.scenePreparation(x.w.token, live.scene.id).groups[0].actors.length, 2);
});

async function adoptRewardVisit(x) {
  const planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Beuteabend',
        scenes: [{ id: visitId, title: 'Weretiger', notes: 'Münzen bergen', locationId: null }],
      },
    },
  });
  assert.equal(await x.ui.openPlannedVisitReview(planId, visitId), true);
  x.el('adoption-confirm').click();
  await settle();
  assert.equal(x.store.live(x.w.token).scene.adoption.visitId, visitId);
  return { planId, visitId };
}
test('the live reward entry follows the adopted visit rather than the independently selected plan', async (t) => {
  const x = await setup(t);
  assert.equal(x.el('live-visit-reward')?.hidden, true);
  const target = await adoptRewardVisit(x);
  x.el('live-session-plan').value = randomUUID();
  const button = x.el('live-visit-reward');
  assert.ok(button, 'Direct visit reward entry is available');
  assert.equal(button.hidden, false);
  button.click();
  await settle();
  assert.deepEqual(x.rewardOpens, [[target.planId, target.visitId]]);
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'award-reward').length,
    0,
    'Opening must not grant a reward',
  );
});
test('a group change during flush cannot open the previous adopted visit reward', async (t) => {
  const x = await setup(t);
  await adoptRewardVisit(x);
  const button = x.el('live-visit-reward');
  assert.ok(button, 'Direct visit reward entry is available');
  const release = x.defer('scene-content');
  x.el('running-notes').value = 'Notiz vor Belohnung';
  x.el('running-notes').oninput();
  button.click();
  await settle();
  await x.focusOther();
  release();
  await settle();
  assert.deepEqual(x.rewardOpens, []);
  assert.equal(x.el('live-visit-reward').hidden, true);
});

test('a delayed reward navigation cannot follow the former adoption in the same scene', async (t) => {
  const x = await setup(t);
  await adoptRewardVisit(x);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  x.releases.push(release);
  x.rewardDelay = () => gate;
  x.el('live-visit-reward').click();
  await settle();
  const next = await adoptRewardVisit(x);
  release();
  await settle();
  assert.deepEqual(x.rewardOpens, []);
  x.rewardDelay = null;
  x.el('live-visit-reward').click();
  await settle();
  assert.deepEqual(x.rewardOpens, [[next.planId, next.visitId]]);
});

test('a confirmed scene switch returns the viewport to the new group context', async (t) => {
  const x = await setup(t),
    other = await x.focusOther();
  let shown = null;
  x.el('live-workspace').scrollIntoView = () => {
    shown = x.el('scene-focus').value;
  };
  x.el('scene-focus').value = x.scene.id;
  x.el('scene-focus').onchange();
  await settle();
  assert.equal(shown, x.scene.id);
  x.el('scene-focus').value = other;
  x.el('scene-focus').onchange();
  await settle();
  assert.equal(shown, other);
  assert.equal(x.el('running-title').value, 'Andere Gruppe');
});

test('switching a group from the visible combat keeps the matching combat in view', async (t) => {
  const x = await setup(t),
    other = await x.focusOther();
  let shown = null;
  Object.defineProperty(x.window, 'innerHeight', { value: 900, configurable: true });
  x.el('combat-panel').hidden = false;
  x.el('combat-panel').getBoundingClientRect = () => ({ top: 100, bottom: 1100 });
  x.el('combat-panel').scrollIntoView = () => {
    shown = x.el('scene-focus').value;
  };
  x.el('live-workspace').scrollIntoView = () =>
    assert.fail('must not send a combat task back to scene notes');
  x.el('scene-focus').value = x.scene.id;
  x.el('scene-focus').onchange();
  await settle();
  assert.equal(shown, x.scene.id);
  assert.notEqual(shown, other);
});

test('scene notes stay directly editable while empty read-aloud and historical groups follow the writing area', async (t) => {
  const x = await setup(t),
    notes = x.el('running-notes'),
    prose = x.el('running-read-aloud-details');
  assert.equal(notes.closest('details'), null);
  assert.equal(prose.open, false);
  assert.equal(x.el('live-play-heading').hidden, true);
  assert.equal(x.el('live-session-navigator').hidden, true);
  const writing = [...notes.parentElement.children];
  assert(writing.indexOf(notes) < writing.indexOf(prose));
  assert(writing.indexOf(prose) < writing.indexOf(x.el('live-archives')));
  notes.value = 'Ada wartet am Tor';
  notes.oninput();
  await x.ui.flushLive();
  await x.ui.openLive();
  assert.equal(notes.value, 'Ada wartet am Tor');
  assert.equal(prose.open, false);
});

test('read-aloud follows the focused scene without changing either group text or overriding a local fold', async (t) => {
  const x = await setup(t),
    prose = x.el('running-read-aloud-details'),
    read = x.el('running-read-aloud');
  prose.open = true;
  read.value = '  Drei blaue Blitze.\r\nDer Riegel knarrt.';
  read.oninput();
  await x.ui.flushLive();
  prose.open = false;
  await x.ui.openLive();
  assert.equal(prose.open, false);
  const other = await x.focusOther();
  assert.equal(read.value, '');
  assert.equal(prose.open, false);
  x.el('running-notes').value = 'Borin wartet auf das Zeichen';
  x.el('running-notes').oninput();
  x.el('group-list').querySelector('button').click();
  await settle();
  assert.equal(prose.open, true);
  assert.equal(read.value, '  Drei blaue Blitze.\r\nDer Riegel knarrt.');
  assert.equal(x.store.liveScene(x.w.token, other).notes, 'Borin wartet auf das Zeichen');
  prose.open = false;
  await x.ui.openLive();
  assert.equal(prose.open, false);
  assert.equal(x.store.liveScene(x.w.token, x.scene.id).readAloud, read.value);
});

test('one confirmed live load or text save publishes one scene context; profile inspection publishes none', async (t) => {
  const x = await setup(t);
  await settle();
  const reads = { preparation: 0, rules: 0 },
    preparation = x.window.campaign.scenePreparation,
    rules = x.window.campaign.sceneRules;
  x.window.campaign.scenePreparation = async (...args) => {
    reads.preparation++;
    return preparation(...args);
  };
  x.window.campaign.sceneRules = async (...args) => {
    reads.rules++;
    return rules(...args);
  };
  await x.ui.openLive();
  await settle();
  assert.deepEqual(
    reads,
    { preparation: 1, rules: 1 },
    'opening the scene publishes one confirmed context',
  );
  reads.preparation = reads.rules = 0;
  const text = '  Eine aktuelle Notiz\r\nbleibt erhalten';
  x.el('running-notes').value = text;
  x.el('running-notes').oninput();
  assert.equal(await x.ui.flushLive(), true);
  await settle();
  assert.deepEqual(
    reads,
    { preparation: 1, rules: 1 },
    'one confirmed scene write publishes one context',
  );
  assert.equal(x.store.live(x.w.token).scene.notes, text);
  reads.preparation = reads.rules = 0;
  x.el('roster-list').querySelectorAll('button')[1].click();
  await settle();
  assert.deepEqual(
    reads,
    { preparation: 0, rules: 0 },
    'inspecting a different character does not reload the unchanged scene',
  );
  assert.equal(x.el('character-name').value, 'Borin');
  assert.equal(x.el('running-notes').value, text);
});

test('focus and membership commands publish once; a local location draft waits for its confirmed write', async (t) => {
  const x = await setup(t),
    location = x.ui.newLocation(randomUUID(), 'Nordtor', 'poi', [randomUUID(), randomUUID()]);
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  const other = await x.focusOther();
  await settle();
  x.el('combat-creation').open = false;
  const reads = { preparation: 0, rules: 0 },
    preparation = x.window.campaign.scenePreparation,
    rules = x.window.campaign.sceneRules;
  x.window.campaign.scenePreparation = async (...args) => {
    reads.preparation++;
    return preparation(...args);
  };
  x.window.campaign.sceneRules = async (...args) => {
    reads.rules++;
    return rules(...args);
  };
  x.el('group-list').querySelector('button').click();
  await settle();
  assert.equal(x.store.live(x.w.token).focusId, x.scene.id);
  assert.deepEqual(reads, { preparation: 1, rules: 1 });
  reads.preparation = reads.rules = 0;
  x.el('character-toggle').click();
  await settle();
  assert.equal(x.store.live(x.w.token).roster.find((c) => c.id === x.heroes[0].id).active, false);
  assert.deepEqual(reads, { preparation: 1, rules: 1 });
  reads.preparation = reads.rules = 0;
  x.el('running-location').value = location.id;
  x.el('running-location').onchange();
  await settle();
  assert.match(x.el('running-context-summary').textContent, /Nordtor/);
  assert.equal(x.store.live(x.w.token).scene.locationId, null);
  assert.deepEqual(reads, { preparation: 0, rules: 0 });
  assert.equal(await x.ui.flushLive(), true);
  await settle();
  assert.equal(x.store.live(x.w.token).scene.locationId, location.id);
  assert.deepEqual(reads, { preparation: 1, rules: 1 });
  assert.notEqual(other, x.scene.id);
});

for (const newer of [null, 'Neuere eigene Fassung', 'Ada'])
  test(`a Party profile acknowledgement has one merge and preserves newer local intent: ${newer ?? 'no later input'}`, async (t) => {
    const x = await setup(t),
      old = x.store.live(x.w.token).roster.find((c) => c.id === x.heroes[0].id),
      release = x.defer('profile');
    const saving = x.ui.runPartyLive(x.w.token, {
      kind: 'profile',
      characterId: old.id,
      expectedRevision: old.profileRevision,
      profile: { ...old.profile, name: 'Party-Profil' },
    });
    await settle();
    assert.equal(
      x.store.live(x.w.token).roster.find((c) => c.id === old.id).profile.name,
      'Party-Profil',
    );
    if (newer !== null) {
      x.el('character-name').value = newer;
      x.el('character-name').oninput();
    }
    release();
    await saving;
    await settle();
    assert.equal(x.el('character-name').value, newer ?? 'Party-Profil');
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(
      x.store.live(x.w.token).roster.find((c) => c.id === old.id).profile.name,
      newer ?? 'Party-Profil',
    );
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'profile').length,
      newer === null ? 1 : 2,
    );
  });

for (const newer of [null, 'Entwurf nach Antwortverlust', 'Ada'])
  test(`Party profile receipt recovery uses the same submitted draft basis: ${newer ?? 'no later input'}`, async (t) => {
    const x = await setup(t),
      old = x.store.live(x.w.token).roster.find((c) => c.id === x.heroes[0].id),
      writer = x.window.campaign.executeLive;
    let lost = false;
    x.window.campaign.executeLive = async (command) => {
      const result = await writer(command);
      if (command.action.kind === 'profile' && !lost) {
        lost = true;
        throw Error('Profilantwort verloren');
      }
      return result;
    };
    x.window.campaign.liveStatus = async (command, token) => ({
      ok: true,
      value: x.store.liveStatus(command, token),
    });
    await assert.rejects(
      x.ui.runPartyLive(x.w.token, {
        kind: 'profile',
        characterId: old.id,
        expectedRevision: old.profileRevision,
        profile: { ...old.profile, name: 'Party-Profil' },
      }),
    );
    if (newer !== null) {
      x.el('character-name').value = newer;
      x.el('character-name').oninput();
    }
    x.el('live-reconcile').click();
    await settle();
    assert.equal(x.el('live-reconcile').hidden, true);
    assert.equal(x.el('character-name').value, newer ?? 'Party-Profil');
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(
      x.store.live(x.w.token).roster.find((c) => c.id === old.id).profile.name,
      newer ?? 'Party-Profil',
    );
    assert.equal(
      x.commands.filter((c) => c.action.kind === 'profile').length,
      newer === null ? 1 : 2,
    );
  });

test('discarding a profile recovery revokes its pending receipt answer', async (t) => {
  const x = await setup(t),
    old = x.store.live(x.w.token).roster.find((c) => c.id === x.heroes[0].id),
    writer = x.window.campaign.executeLive;
  x.window.campaign.executeLive = async (command) => {
    await writer(command);
    throw Error('Profilantwort verloren');
  };
  await assert.rejects(
    x.ui.runPartyLive(x.w.token, {
      kind: 'profile',
      characterId: old.id,
      expectedRevision: old.profileRevision,
      profile: { ...old.profile, name: 'Gespeichertes Profil' },
    }),
  );
  x.window.campaign.executeLive = writer;
  let release;
  x.window.campaign.liveStatus = (command, token) =>
    new Promise((resolve) => {
      release = () => resolve({ ok: true, value: x.store.liveStatus(command, token) });
    });
  x.releases.push(() => release?.());
  x.el('live-reconcile').click();
  await settle();
  x.el('live-refresh').click();
  await settle();
  assert.equal(x.el('live-reconcile').hidden, true);
  x.el('character-name').value = 'Neuer Entwurf nach Reload';
  x.el('character-name').oninput();
  x.messages.length = 0;
  release();
  await settle();
  assert.deepEqual(x.messages, []);
  assert.equal(x.el('character-name').value, 'Neuer Entwurf nach Reload');
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(
    x.store.live(x.w.token).roster.find((c) => c.id === old.id).profile.name,
    'Neuer Entwurf nach Reload',
  );
});

for (const rejected of [false, true])
  test(`unavailable preparation keeps the live scene usable: ${rejected ? 'transport rejection' : 'provider error'}`, async (t) => {
    const x = await setup(t),
      read = x.window.campaign.preparation;
    x.window.campaign.preparation = async () => {
      if (rejected) throw Error('Vorbereitung nicht erreichbar');
      return { ok: false, error: 'Vorbereitung nicht lesbar' };
    };
    await x.ui.openLive();
    await settle();
    assert.equal(x.el('live-workspace').hidden, false);
    assert.equal(x.el('running-editor').hidden, false);
    assert.equal(x.el('scene-focus').value, x.scene.id);
    assert.match(x.el('live-knowledge-result').textContent, /nicht (erreichbar|lesbar|verfügbar)/);
    const text = '  Trotz fehlender Vorbereitung\r\nweiterleiten';
    x.el('running-notes').value = text;
    x.el('running-notes').oninput();
    assert.equal(await x.ui.flushLive(), true);
    assert.equal(x.store.live(x.w.token).scene.notes, text);
    x.window.campaign.preparation = read;
  });

test('pending preparation does not delay the core scene or overwrite later text when it arrives', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.preparation,
    reply = await read(x.w.token);
  let release,
    opened = false;
  x.window.campaign.preparation = () =>
    new Promise((resolve) => {
      release = () => resolve(reply);
    });
  x.releases.push(() => release?.());
  const loading = x.ui.openLive().then(() => {
    opened = true;
  });
  await settle();
  assert.equal(opened, true, 'the required scene load finishes independently');
  const text = 'Neue Prosa während Vorbereitung lädt';
  x.el('running-notes').value = text;
  x.el('running-notes').oninput();
  assert.equal(await x.ui.flushLive(), true);
  release();
  await loading;
  await settle();
  assert.equal(x.el('running-notes').value, text);
  assert.equal(x.store.live(x.w.token).scene.notes, text);
});
test('material retry reads only preparation and preserves unsaved text, location and visit controls', async (t) => {
  const x = await setup(t),
    location = x.ui.newLocation(randomUUID(), 'Nordtor', 'poi', [randomUUID(), randomUUID()]);
  x.store.changePreparation({
    ...x.command(null),
    change: { kind: 'location', expectedRevision: null, document: location },
  });
  const original = x.store.live(x.w.token).scene;
  x.store.executeLive(
    x.command({
      kind: 'scene-content',
      sceneId: original.id,
      expectedRevision: original.revision,
      title: original.title,
      notes: '',
      locationId: location.id,
    }),
  );
  const read = x.window.campaign.preparation,
    core = x.window.campaign.live;
  let liveReads = 0,
    materialReads = 0;
  x.window.campaign.live = (...args) => {
    liveReads++;
    return core(...args);
  };
  x.window.campaign.preparation = async () => ({ ok: false, error: 'Vorbereitung nicht lesbar' });
  await x.ui.openLive();
  await settle();
  assert.equal(x.el('running-location').value, location.id);
  assert.equal(x.el('running-location').disabled, true);
  assert.equal(x.el('adoption-preview').disabled, true);
  assert.equal(x.el('running-player-npc-show').disabled, true);
  liveReads = 0;
  const text = '  Eigene neue Prosa\r\nbleibt offen';
  x.el('running-notes').value = text;
  x.el('running-notes').oninput();
  x.window.campaign.preparation = (...args) => {
    materialReads++;
    return read(...args);
  };
  x.el('live-sources-retry').click();
  await settle();
  assert.equal(liveReads, 0);
  assert.equal(materialReads, 1);
  assert.equal(x.el('running-notes').value, text);
  assert.equal(x.el('running-location').value, location.id);
  assert.equal(x.el('running-location').disabled, false);
  assert.equal(x.el('live-sources-state').hidden, true);
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).scene.locationId, location.id);
  assert.equal(x.store.live(x.w.token).scene.notes, text);
  assert.equal(x.el('adoption-preview').disabled, true);
});
for (const rejected of [false, true])
  test(`late material ${rejected ? 'failure' : 'success'} cannot cross a campaign activation`, async (t) => {
    const x = await setup(t),
      old = await x.window.campaign.preparation(x.w.token);
    let release;
    x.window.campaign.preparation = () =>
      new Promise((r) => {
        release = () => r(rejected ? { ok: false, error: 'Alte Kampagne kaputt' } : old);
      });
    x.releases.push(() => release?.());
    await x.ui.openLive();
    await settle();
    const cam = x.store.create('Andere Kampagne'),
      w = x.store.activate(cam.id),
      read = x.window.campaign.live;
    x.ui.activateLive(w);
    x.window.campaign.preparation = async () => ({ ok: true, value: x.store.preparation(w.token) });
    await x.ui.openLive();
    await settle();
    release();
    await settle();
    assert.equal(x.el('live-sources-state').hidden, true);
    assert.doesNotMatch(x.el('live-knowledge-result').textContent, /Alte Kampagne/);
    assert.equal(x.el('scene-focus').children.length, 0);
    assert.equal(x.commands.length, 0);
  });
test('newer material retry revokes the old read and late material never rebuilds scene contexts', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.preparation,
    reply = await read(x.w.token);
  let release,
    sceneReads = 0;
  x.window.campaign.preparation = () =>
    new Promise((r) => {
      release = () => r({ ok: false, error: 'Überholter Fehler' });
    });
  x.releases.push(() => release?.());
  const sceneRead = x.window.campaign.scenePreparation;
  x.window.campaign.scenePreparation = (...args) => {
    sceneReads++;
    return sceneRead(...args);
  };
  await x.ui.openLive();
  await settle();
  assert.equal(sceneReads, 1);
  x.window.campaign.preparation = async () => reply;
  x.el('live-sources-retry').onclick();
  await settle();
  assert.equal(sceneReads, 1);
  release();
  await settle();
  assert.equal(x.el('live-sources-state').hidden, true);
  assert.doesNotMatch(x.el('live-knowledge-result').textContent, /Überholter/);
});
test('required live failure remains a core failure even when preparation is healthy', async (t) => {
  const x = await setup(t);
  x.window.campaign.live = async () => ({ ok: false, error: 'Scene nicht lesbar' });
  await x.ui.openLive();
  await settle();
  assert.equal(x.el('live-workspace').hidden, true);
  assert.equal(x.el('live-sources-state').hidden, true);
  assert.ok(x.messages.some((m) => m.error && m.text === 'Scene nicht lesbar'));
});
test('planned visit opening waits for material and abandons its intent after newer text input', async (t) => {
  const x = await setup(t),
    planId = randomUUID(),
    visitId = randomUUID();
  x.store.changePreparation({
    ...x.command(null),
    change: {
      kind: 'plan',
      expectedRevision: null,
      plan: {
        version: 1,
        id: planId,
        revision: 1,
        name: 'Späterer Plan',
        scenes: [{ id: visitId, title: 'Nordtor', notes: 'Wachen', locationId: null }],
      },
    },
  });
  const reply = { ok: true, value: x.store.preparation(x.w.token) };
  let release,
    done = false,
    held = false;
  x.window.campaign.preparation = () => {
    if (held) return Promise.resolve(reply);
    held = true;
    return new Promise((r) => {
      release = () => r(reply);
    });
  };
  x.releases.push(() => release?.());
  const review = x.ui.openPlannedVisitReview(planId, visitId).then((r) => {
    done = true;
    return r;
  });
  await settle();
  assert.equal(done, false);
  assert.equal(x.el('running-editor').hidden, false);
  x.el('running-notes').value = 'Neuere Absicht';
  x.el('running-notes').oninput();
  release();
  assert.equal(await review, false);
  await settle();
  assert.notEqual(x.el('adoption-dialog').open, true);
  assert.equal(x.el('running-notes').value, 'Neuere Absicht');
  assert.equal(x.commands.length, 0);
});

test('a committed moment and the next moment remain usable while material refresh is pending', async (t) => {
  const x = await setup(t),
    read = x.window.campaign.preparation,
    reply = await read(x.w.token),
    pending = [];
  const release = () => {
    for (const resolve of pending.splice(0)) resolve(reply);
  };
  x.window.campaign.preparation = () => new Promise((r) => pending.push(r));
  x.releases.push(release);
  x.fields('Gesicherte Quest', 'Spur');
  x.el('live-moment-follow-up').value = 'quest';
  x.submit();
  await settle();
  assert.equal(x.el('live-moment-title').value, '');
  assert.match(x.el('live-moment-result').textContent, /gespeichert/);
  assert.match(x.el('live-sources-status').textContent, /geladen/);
  x.fields('Nächster Moment', 'Weiterleiten');
  x.submit();
  await settle();
  assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 2);
  assert.equal(x.el('live-moment-title').value, '');
  release();
  await settle();
  assert.equal(x.el('live-sources-state').hidden, true);
  assert.match(x.el('live-moment-result').textContent, /Kampagnenchronik gespeichert/);
});
test('the authoritative scene request is dispatched before optional material on the shared bridge', async (t) => {
  const x = await setup(t),
    calls = [],
    live = x.window.campaign.live,
    prep = x.window.campaign.preparation;
  x.window.campaign.live = (...args) => {
    calls.push('scene');
    return live(...args);
  };
  x.window.campaign.preparation = (...args) => {
    calls.push('material');
    return prep(...args);
  };
  await x.ui.openLive();
  await settle();
  assert.deepEqual(calls.slice(0, 2), ['scene', 'material']);
});

const literalRecap = {
  summary: '  Ergebnis\r\n[Quelle](https://example.invalid)  ',
  handoff: '  Am Salzsteg\r\n- Siv fragen  ',
};
for (const action of ['confirm', 'prepare'])
  test(
    'browser-normalized recap keeps original bytes through reactivation and ' + action,
    async (t) => {
      const x = await setup(t, true, true, JSON.stringify(literalRecap), true);
      assert.equal(x.el('live-session-summary').value, literalRecap.summary.replace(/\r/g, ''));
      x.ui.activateLive(x.w);
      await x.ui.openLive();
      assert.equal(await x.ui.flushLive(), true);
      assert.deepEqual(x.store.live(x.w.token).recapDraft, literalRecap);
      x.el('live-session-end').click();
      await settle();
      x.el(
        action === 'prepare' ? 'live-session-close-prepare' : 'live-session-close-confirm',
      ).click();
      await settle();
      const end = x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end');
      assert.equal(end.summary, literalRecap.summary);
      assert.equal(end.handoff, literalRecap.handoff);
      assert.deepEqual(x.store.live(x.w.token).recapDraft, { summary: '', handoff: '' });
      if (action === 'prepare') {
        x.el('handoff-visit-form').onsubmit({ preventDefault() {} });
        await settle();
        assert.equal(x.followUps[0][2].notes, literalRecap.handoff);
      }
    },
  );
test('browser recap edits and cancelled review preserve literal draft and do not publish', async (t) => {
  const x = await setup(t, true, true, JSON.stringify(literalRecap), true);
  x.el('live-session-end').click();
  await settle();
  const area = x.el('live-session-close-summary');
  area.value += '\nNeuer Hinweis';
  area.dispatchEvent(new x.window.Event('input'));
  await settle();
  x.el('live-session-close-cancel').click();
  assert.equal(await x.ui.flushLive(), true);
  assert.deepEqual(x.store.live(x.w.token).recapDraft, {
    summary: literalRecap.summary + '\r\nNeuer Hinweis',
    handoff: literalRecap.handoff,
  });
  assert.equal(x.store.chronicle(x.w.token).latestSessionMarker.sessionMarker, 'start');
});
test('browser marker acknowledgement preserves later literal recap and opening edits without changing submitted history', async (t) => {
  const x = await setup(t, true, true, JSON.stringify(literalRecap), true);
  x.el('live-session-end').click();
  await settle();
  const release = x.defer('session-marker');
  x.el('live-session-close-prepare').click();
  await settle();
  const area = x.el('live-session-close-handoff');
  area.value += '\nSpäterer Entwurf';
  area.dispatchEvent(new x.window.Event('input'));
  await settle();
  release();
  await settle();
  assert.equal(
    x.store.chronicle(x.w.token).entries.find((e) => e.sessionMarker === 'end').handoff,
    literalRecap.handoff,
  );
  assert.deepEqual(x.store.live(x.w.token).recapDraft, {
    summary: '',
    handoff: literalRecap.handoff + '\r\nSpäterer Entwurf',
  });
  assert.equal(x.el('live-session-draft-status').textContent, 'Rückblickentwurf gespeichert.');
  const notes = x.el('handoff-visit-notes');
  notes.value += '\nEigene Vorbereitung';
  notes.dispatchEvent(new x.window.Event('input'));
  notes.value = 'Bearbeitet: ' + notes.value;
  notes.dispatchEvent(new x.window.Event('input'));
  x.el('handoff-visit-form').onsubmit({ preventDefault() {} });
  await settle();
  assert.equal(
    x.followUps[0][2].notes,
    'Bearbeitet: ' + literalRecap.handoff + '\r\nEigene Vorbereitung',
  );
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
      .length,
    1,
  );
});

test('confirmed ending needs no second draft write and receipt recovery consumes the same submitted text', async (t) => {
  const x = await setup(t, true, true, JSON.stringify(literalRecap), true);
  let clears = 0;
  const keep = x.window.campaign.keepSessionRecapDraft;
  x.window.campaign.keepSessionRecapDraft = async (...args) => {
    if (!args[1].summary && !args[1].handoff) {
      clears++;
      return { ok: false, error: 'Kein zweiter Bereinigungsschritt erlaubt' };
    }
    return keep(...args);
  };
  x.window.campaign.liveStatus = async (command, token) => ({
    ok: true,
    value: x.store.liveStatus(command, token),
  });
  x.reply = async (result, command) => {
    if (command.action.kind === 'session-marker' && command.action.marker === 'end')
      throw Error('Abschlussantwort verloren');
    return result;
  };
  x.el('live-session-end').click();
  await settle();
  x.el('live-session-close-confirm').click();
  await settle();
  assert.equal(x.el('live-reconcile').hidden, false);
  assert.deepEqual(x.store.live(x.w.token).recapDraft, { summary: '', handoff: '' });
  assert.equal(clears, 0);
  x.el('live-reconcile').click();
  await settle();
  assert.equal(x.el('live-reconcile').hidden, true);
  assert.equal(x.el('live-session-close-summary').value, '');
  assert.equal(x.el('live-session-close-handoff').value, '');
  assert.equal(clears, 0);
  assert.equal(
    x.commands.filter((c) => c.action.kind === 'session-marker' && c.action.marker === 'end')
      .length,
    1,
  );
  assert.deepEqual(x.store.live(x.w.token).recapDraft, { summary: '', handoff: '' });
});
