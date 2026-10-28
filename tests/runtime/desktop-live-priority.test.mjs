import { readWorkspaceMarkup } from '../../tools/desktop-markup.mjs';
import { afterFixture, freshFixtureModule } from '../helpers/fixture-lifecycle.mjs';
import { liveInstance } from '../helpers/priority-live.mjs';
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
      "export {newLocation} from './src/features/location/location-schema';export {createLiveKnowledgeUI} from './src/app/runtime/live-knowledge-ui';export * from './src/app/runtime/live';export {createCombat} from './src/app/runtime/combat';export {initSessionPacket,setSessionPacketSurface} from './src/app/campaign/session-packet-ui';",
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
  const { window, document } = parseHTML(readWorkspaceMarkup()),
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
  if (resume && !document.getElementById('live-continue').hidden) {
    document.getElementById('live-continue').click();
    await settle();
  }
  assert.equal(
    document.getElementById('running-notes').disabled,
    false,
    JSON.stringify(x.messages),
  );
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
  assert.equal(moments.length, 1, JSON.stringify({ commands: x.commands, messages: x.messages }));
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
  const creation = x.commands.find((c) => c.action.kind === 'create-character');
  assert.equal(x.commands.filter((c) => c.action.kind === 'create-character').length, 1);
  const receipt = x.store.liveStatus(creation, x.w.token);
  assert.equal(receipt.outcome, 'applied');
  assert.equal(receipt.receipt.character.id, roster[0].id);
  const checks = [];
  x.window.campaign.liveStatus = async (command, token) => {
    checks.push(command);
    return { ok: true, value: x.store.liveStatus(command, token) };
  };
  x.window.campaign.executeLive = original;
  x.el('live-reconcile').click();
  await settle();
  assert.equal(checks.length, 1);
  assert.equal(checks[0].action.kind, 'membership');
  assert.equal(x.store.liveStatus(checks[0], x.w.token).outcome, 'not-applied');
  assert.equal(x.commands.filter((c) => c.action.kind === 'create-character').length, 1);
  x.el('character-toggle').click();
  await settle();
  const joined = x.store.live(x.w.token).roster.filter((c) => c.profile.name === 'Bleibt erhalten');
  assert.equal(joined.length, 1);
  assert.equal(joined[0].id, roster[0].id);
  assert.equal(joined[0].active, true);
  assert.equal(joined[0].sceneId, x.store.live(x.w.token).scene.id);
  assert.equal(x.commands.filter((c) => c.action.kind === 'create-character').length, 1);
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

const literalRecap = {
  summary: '  Ergebnis\r\n[Quelle](https://example.invalid)  ',
  handoff: '  Am Salzsteg\r\n- Siv fragen  ',
};

test('a late profile confirmation cannot replace the next group or its later scene input', async (t) => {
  const x = await setup(t),
    character = x.store.live(x.w.token).roster.find((c) => c.id === x.heroes[0].id),
    release = x.defer('profile');
  const saving = x.ui.runPartyLive(x.w.token, {
    kind: 'profile',
    characterId: character.id,
    expectedRevision: character.profileRevision,
    profile: { ...character.profile, name: 'Bestätigte frühere Figur' },
  });
  await settle();
  const next = await x.focusOther();
  const input = x.el('running-notes');
  input.value = '  Neuere Gruppe\r\nEigene Eingabe  ';
  input.oninput();
  release();
  await saving;
  await settle();
  assert.equal(x.el('running-notes'), input);
  assert.equal(input.value, '  Neuere Gruppe\r\nEigene Eingabe  ');
  assert.equal(x.store.live(x.w.token).scene.id, next);
  assert.equal(await x.ui.flushLive(), true);
  assert.equal(x.store.live(x.w.token).scene.notes, input.value);
  assert.equal(x.commands.filter((c) => c.action.kind === 'profile').length, 1);
});

for (const change of ['group', 'location', 'reactivation'])
  test(`old knowledge controls cannot apply text or open a source after ${change} changes`, async (t) => {
    const x = await setup(t),
      id = randomUUID();
    x.store.changePreparation({
      ...x.command(null),
      change: {
        kind: 'note',
        expectedRevision: null,
        note: {
          version: 1,
          id,
          revision: 1,
          title: 'Frühere Quelle',
          kind: 'quest',
          readAloud: '  Alte Quelle\r\n',
          gmNotes: 'Privater Text',
          relations: [],
          creatureId: null,
          deleted: false,
        },
      },
    });
    await x.ui.openLive();
    await settle();
    const controls = [...x.el('live-knowledge-results').querySelectorAll('button')],
      oldUse = controls.find((b) => b.textContent === 'Als Vorlesetext einsetzen'),
      oldOpen = controls.find((b) => b.textContent === 'Verwalten / abschließen');
    assert.ok(oldUse);
    assert.ok(oldOpen);
    if (change === 'group') await x.focusOther();
    else if (change === 'reactivation') {
      x.ui.activateLive(x.w);
      await x.ui.openLive();
    } else {
      const locationId = randomUUID(),
        scene = x.store.live(x.w.token).scene;
      x.store.changePreparation({
        ...x.command(null),
        change: {
          kind: 'location',
          expectedRevision: null,
          document: x.ui.newLocation(locationId, 'Anderer Ort', 'poi', [
            randomUUID(),
            randomUUID(),
          ]),
        },
      });
      x.store.executeLive(
        x.command({
          kind: 'scene-content',
          sceneId: scene.id,
          expectedRevision: scene.revision,
          title: scene.title,
          notes: scene.notes,
          readAloud: scene.readAloud,
          locationId,
        }),
      );
      await x.ui.openLive();
    }
    await settle();
    x.el('running-read-aloud').value = '  Neuer Entwurf\r\n';
    x.el('running-read-aloud').oninput();
    const writes = x.commands.length;
    oldUse.onclick();
    oldOpen.onclick();
    await settle();
    assert.equal(x.el('running-read-aloud').value, '  Neuer Entwurf\r\n');
    assert.deepEqual(x.noteOpens, []);
    assert.equal(x.commands.length, writes);
  });
for (const change of ['new input', 'closed packet'])
  test(`a live packet approval cannot overwrite ${change} while its real scene flush is pending`, async (t) => {
    const x = await setup(t),
      target = await adoptRewardVisit(x),
      detail = x.store.session(x.w.token, target.planId).visits[0];
    x.store.executeSession(
      x.command({
        kind: 'visit',
        planId: target.planId,
        expectedRevision: detail.revision,
        detail: { ...detail, readAloud: '  Mappenwortlaut\r\n' },
      }),
    );
    x.el('live-session-plan').value = target.planId;
    x.el('live-session-plan').dispatchEvent(new x.window.Event('change'));
    x.el('live-session-packet').click();
    await settle();
    const oldUse = x.el('session-packet-content').querySelector('.packet-use-read-aloud'),
      oldCapture = x.el('session-packet-content').querySelector('.packet-block-action');
    assert.ok(oldUse);
    assert.ok(oldCapture);
    x.fields('Eigener Moment', 'Eigene Zusammenfassung');
    const release = x.defer('scene-content');
    x.el('running-notes').value = 'Noch offene Szenennotiz';
    x.el('running-notes').oninput();
    oldUse.click();
    await settle();
    if (change === 'new input') {
      x.el('running-read-aloud').value = '  Neuere eigene Eingabe\r\n';
      x.el('running-read-aloud').oninput();
    } else x.el('session-packet-close').click();
    const expected = x.el('running-read-aloud').value;
    release();
    await settle();
    assert.equal(x.el('running-read-aloud').value, expected);
    x.el('session-packet-close').click();
    oldCapture.onclick();
    await settle();
    assert.equal(x.el('live-moment-title').value, 'Eigener Moment');
    assert.equal(x.el('live-moment-summary').value, 'Eigene Zusammenfassung');
    assert.equal(x.commands.filter((c) => c.action.kind === 'live-moment').length, 0);
  });

for (const action of ['portrait', 'source'])
  test(`an accepted knowledge ${action} keeps its context lease through its own flush and render`, async (t) => {
    const x = await setup(t),
      id = randomUUID(),
      calls = [];
    let data = x.store.live(x.w.token),
      editor;
    const act = async (target, current) => {
      calls.push(target);
      assert.equal(current(), true);
      assert.equal(await x.ui.flushLive(), true);
      data = x.store.live(x.w.token);
      editor.renderLiveKnowledge();
      assert.equal(
        current(),
        true,
        'its own same-context render must not cancel an accepted handoff',
      );
      return true;
    };
    editor = x.ui.createLiveKnowledgeUI({
      context: x.w,
      get data() {
        return data;
      },
      sources: {
        notes: [
          {
            trashed: false,
            note: {
              id,
              revision: 1,
              title: 'Aktuelle Quelle',
              kind: action === 'portrait' ? 'npc' : 'quest',
              readAloud: '',
              gmNotes: 'privat',
            },
          },
        ],
        locations: [],
      },
      get: x.el,
      document: x.document,
      value: (id) => x.el(id).value,
      window: x.window,
      liveSourcesProblem: '',
      preparedNoteIds: new Set(),
      useKnowledgeReadAloud() {},
      showLiveNpc: act,
      openKnowledgeNote: act,
    });
    editor.renderLiveKnowledge();
    const button = [...x.el('live-knowledge-results').querySelectorAll('button')].find(
      (b) =>
        b.textContent === (action === 'portrait' ? 'Porträt zeigen' : 'Verwalten / abschließen'),
    );
    assert.ok(button);
    x.el('running-notes').value = '  Eigener Text vor der Aktion\r\n';
    x.el('running-notes').oninput();
    button.click();
    await settle();
    assert.deepEqual(calls, [id]);
    assert.equal(data.scene.notes, '  Eigener Text vor der Aktion\r\n');
    button.onclick();
    await settle();
    assert.deepEqual(calls, [id], 'the replaced control cannot start another handoff');
    editor.reset();
  });
