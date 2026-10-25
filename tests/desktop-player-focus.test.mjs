import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from './helpers/build.mjs';
import { parseHTML } from './helpers/dom.mjs';
const require = createRequire(import.meta.url);
for (const [source, out] of [
  ['src/app/storage/store.ts', 'player-focus-store'],
  ['src/app/player-ui.ts', 'player-focus-ui'],
])
  buildSync({
    entryPoints: [source],
    outfile: '.build/' + out + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const tick = () => new Promise((r) => setImmediate(r));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await tick();
  }
  assert(check(), 'Expected player state');
}
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'player-focus-')),
    { CampaignStore } = require('../.build/player-focus-store.cjs'),
    store = new CampaignStore(root + '/campaign.sqlite'),
    campaign = store.create('Zwei Gruppen'),
    w = store.activate(campaign.id),
    command = (action) => ({
      commandId: randomUUID(),
      token: w.token,
      campaignId: campaign.id,
      action,
    });
  const a = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Ada' } }),
    ).character,
    b = store.executeLive(
      command({ kind: 'create-character', profile: { name: 'Borin' } }),
    ).character;
  const primary = store.executeLive(
    command({ kind: 'initialize', expectedRosterRevision: 2 }),
  ).scene;
  for (const [i, c] of [a, b].entries())
    store.executeLive(
      command({
        kind: 'membership',
        characterId: c.id,
        expectedRevision: 0,
        expectedRosterRevision: 2 + i,
        active: true,
        targetSceneId: primary.id,
        expectedFocusRevision: 0,
      }),
    );
  const split = store.executeLive(
      command({
        kind: 'move',
        sceneId: primary.id,
        expectedRosterRevision: 4,
        expectedFocusRevision: 0,
        expectedClockRevision: 0,
        expectedSceneMembershipRevision: 2,
        memberIds: [b.id],
        target: { kind: 'new', title: 'Nachhut', expectedContentRevision: 0 },
      }),
    ),
    secondary = split.session.createdScene.id;
  for (const [id, text] of [
    [primary.id, 'Öffentliches Tor'],
    [secondary, 'Geheime Nachhut'],
  ])
    store.executeLive(
      command({
        kind: 'scene-content',
        sceneId: id,
        expectedRevision: 0,
        title: 'Interner Titel',
        readAloud: text,
        notes: 'GM-Privat',
        locationId: null,
      }),
    );
  const bytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTfcAAAAASUVORK5CYII=',
      'base64',
    ),
    sha256 = createHash('sha256').update(bytes).digest('hex'),
    artId = randomUUID();
  mkdirSync(root + '/player-images');
  writeFileSync(root + '/player-images/' + sha256 + '.png', bytes);
  store.registerPlayerAsset(w.token, {
    id: artId,
    kind: 'custom',
    subjectId: null,
    title: 'Freigegebene Art',
    sha256,
    bytes: bytes.length,
    extension: '.png',
  });
  const settings = {
    blank: false,
    mode: 'image',
    imageId: artId,
    title: 'Vorhut',
    labels: false,
    light: 'daylight',
    displayId: null,
    fullscreen: false,
  };
  const basis = () => {
    const v = store.playerView(w.token);
    return {
      expectedRevision: v.settings.revision,
      expectedFocusId: v.focusId,
      expectedFocusRevision: v.focusRevision,
      expectedFocusMembershipRevision: v.focusMembershipRevision,
      expectedFocusLocationId: v.focusLocationId,
    };
  };
  const request = (action) => ({ ...command(action), ...basis() });
  const focus = (id) => {
    const live = store.live(w.token);
    store.executeLive(
      command({ kind: 'focus', sceneId: id, expectedRevision: live.focusRevision }),
    );
  };
  const rows = () => store.db.prepare('SELECT * FROM player_record ORDER BY kind,id').all();
  return {
    root,
    store,
    campaign,
    w,
    a,
    b,
    artId,
    primary: primary.id,
    secondary,
    settings,
    basis,
    request,
    focus,
    rows,
    cleanup() {
      store.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
for (const kind of ['follow', 'image', 'observer', 'discover', 'forget', 'mask'])
  test('stale ' + kind + ' command cannot gain another focused group', () => {
    const x = fixture();
    try {
      const action = ['follow', 'image'].includes(kind)
        ? {
            kind: 'settings',
            settings: { ...x.settings, mode: kind, imageId: kind === 'image' ? x.artId : null },
          }
        : kind === 'observer'
          ? {
              kind,
              observer: {
                characterId: x.a.id,
                enabled: false,
                rangeMeters: 0,
                darkvisionMeters: 0,
                eyeHeightMeters: 1.7,
              },
            }
          : kind === 'mask'
            ? {
                kind,
                mapId: 'old-map',
                q: 0,
                r: 0,
                hidden: true,
                blocksSight: true,
                publicLabel: 'Geheim',
              }
            : {
                kind,
                characterIds: [x.a.id],
                mapId: 'old-map',
                q: 0,
                r: 0,
                locationId: null,
                publicLabel: 'Geheim',
              };
      const c = x.request(action),
        old = x.rows(),
        receipts = x.store.db.prepare('SELECT count(*) n FROM player_receipt').get().n;
      x.focus(x.secondary);
      assert.throws(() => x.store.executePlayer(c), /Fokussierte Gruppe geändert/);
      assert.deepEqual(x.rows(), old);
      assert.equal(x.store.db.prepare('SELECT count(*) n FROM player_receipt').get().n, receipts);
      assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    } finally {
      x.cleanup();
    }
  });
test('focus revision rejects A-B-A even when the visible group identity matches again', () => {
  const x = fixture();
  try {
    const c = x.request({ kind: 'settings', settings: x.settings });
    x.focus(x.secondary);
    x.focus(x.primary);
    assert.throws(() => x.store.executePlayer(c), /Fokussierte Gruppe geändert/);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  } finally {
    x.cleanup();
  }
});
test('missing focus authority fails closed rather than publishing for a legacy caller', () => {
  const x = fixture();
  try {
    const c = x.request({ kind: 'settings', settings: x.settings });
    delete c.expectedFocusId;
    delete c.expectedFocusRevision;
    assert.throws(() => x.store.executePlayer(c), /Fokussierte Gruppe geändert/);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  } finally {
    x.cleanup();
  }
});
test('receipt replay after a focus change never republishes or rebinds the prior intent', () => {
  const x = fixture();
  try {
    const c = x.request({ kind: 'settings', settings: x.settings }),
      v = x.store.executePlayer(c);
    assert.equal(v.settings.boundSceneId, x.primary);
    x.focus(x.secondary);
    const old = x.rows(),
      replay = x.store.executePlayer(c);
    assert.deepEqual(x.rows(), old);
    assert.equal(replay.frame.mode, 'blank');
    assert.equal(replay.settings.boundSceneId, x.primary);
  } finally {
    x.cleanup();
  }
});
test('an emergency blank ignores stale focus and display revisions', () => {
  const x = fixture();
  try {
    const emergency = x.request({ kind: 'blank' });
    x.store.executePlayer(x.request({ kind: 'settings', settings: x.settings }));
    x.focus(x.secondary);
    x.store.executePlayer(x.request({ kind: 'settings', settings: x.settings }));
    const v = x.store.executePlayer(emergency);
    assert.equal(v.settings.blank, true);
    assert.equal(v.frame.mode, 'blank');
  } finally {
    x.cleanup();
  }
});
async function uiFixture() {
  const x = fixture(),
    old = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLInputElement: globalThis.HTMLInputElement,
    },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, HTMLInputElement: window.HTMLInputElement });
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.__qaValue ?? this.options[0]?.value ?? '';
    },
    set(v) {
      this.__qaValue = v;
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
    waiting = [],
    writes = [],
    messages = [];
  let hold = false;
  window.campaign = {
    playerScreens: async () => ({ ok: true, value: [] }),
    playerView: async () => response(() => x.store.playerView(x.w.token)),
    playerWindow: async () => ({ ok: true, value: undefined }),
    executePlayer: async (c) => {
      writes.push(c);
      if (hold) {
        hold = false;
        return new Promise((resolve) =>
          waiting.push(() => resolve(response(() => x.store.executePlayer(c)))),
        );
      }
      return response(() => x.store.executePlayer(c));
    },
  };
  delete require.cache[require.resolve('../.build/player-focus-ui.cjs')];
  const ui = require('../.build/player-focus-ui.cjs');
  ui.initPlayerUI(
    (text, error) => messages.push({ text, error }),
    () => x.w,
    async () => true,
  );
  const el = (id) => document.getElementById(id);
  el('player-open-controls').onclick();
  await until(() => el('player-dialog').open);
  el('player-image').value = x.artId;
  return {
    ...x,
    ui,
    el,
    writes,
    messages,
    waiting,
    hold: () => {
      hold = true;
    },
    release: () => waiting.shift()(),
    cleanup() {
      ui.deactivatePlayer();
      Object.assign(globalThis, old);
      x.cleanup();
    },
  };
}
test('the controller captures the preview focus before an asynchronous publication', async () => {
  const x = await uiFixture();
  try {
    x.hold();
    x.el('player-show-image').onclick();
    await until(() => x.waiting.length === 1);
    assert.equal(x.writes[0].expectedFocusId, x.primary);
    assert.equal(x.writes[0].expectedFocusRevision, 0);
    x.el('player-close-controls').onclick();
    x.focus(x.secondary);
    x.release();
    await tick();
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    assert.equal(x.store.playerView(x.w.token).settings.blank, true);
  } finally {
    x.cleanup();
  }
});
test('stale-publication error is local and refresh preserves edits until explicit confirmation', async () => {
  const x = await uiFixture();
  try {
    assert.match(x.el('player-target').textContent, /Ada/);
    assert.doesNotMatch(x.el('player-target').textContent, /Borin/);
    x.el('player-title').value = '  Titelentwurf  ';
    x.focus(x.secondary);
    x.el('player-show-image').onclick();
    await until(() => !x.el('player-feedback').hidden);
    assert.match(x.el('player-feedback').textContent, /Fokussierte Gruppe geändert/);
    assert.equal(x.el('player-title').value, '  Titelentwurf  ');
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    x.el('player-refresh').onclick();
    await until(() => x.el('player-feedback').hidden);
    assert.equal(x.el('player-title').value, '  Titelentwurf  ');
    assert.match(x.el('player-target').textContent, /Borin/);
    assert.doesNotMatch(x.el('player-target').textContent, /Ada/);
    x.el('player-show-image').onclick();
    await until(() => x.store.currentPlayerFrame().mode === 'image');
    assert.equal(x.writes.at(-1).expectedFocusId, x.secondary);
    assert.equal(x.store.currentPlayerFrame().title, '  Titelentwurf  ');
    assert.equal(x.store.currentPlayerFrame().imageId, x.artId);
    assert.doesNotMatch(JSON.stringify(x.store.currentPlayerFrame()), /Geheime Nachhut/);
  } finally {
    x.cleanup();
  }
});

test('direct live cue keeps its origin focus across a held write', async () => {
  const x = await uiFixture();
  try {
    x.hold();
    const pending = x.ui.cuePlayer('follow', {
      focusId: x.primary,
      focusRevision: 0,
      focusMembershipRevision: x.store.playerView(x.w.token).focusMembershipRevision,
      focusLocationId: x.store.playerView(x.w.token).focusLocationId,
    });
    await until(() => x.waiting.length === 1);
    x.focus(x.secondary);
    x.release();
    assert.equal(await pending, false);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  } finally {
    x.cleanup();
  }
});
test('direct live cue rejects a changed group before its fresh read returns', async () => {
  const x = await uiFixture();
  try {
    let release;
    window.campaign.playerView = () =>
      new Promise((resolve) => {
        release = () => resolve({ ok: true, value: x.store.playerView(x.w.token) });
      });
    const pending = x.ui.cuePlayer('follow', {
      focusId: x.primary,
      focusRevision: 0,
      focusMembershipRevision: x.store.playerView(x.w.token).focusMembershipRevision,
      focusLocationId: x.store.playerView(x.w.token).focusLocationId,
    });
    await until(() => !!release);
    x.focus(x.secondary);
    release();
    assert.equal(await pending, false);
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  } finally {
    x.cleanup();
  }
});
test('current direct follow and emergency blank remain explicit usable actions', async () => {
  const x = await uiFixture();
  try {
    assert.equal(
      await x.ui.cuePlayer('follow', {
        focusId: x.primary,
        focusRevision: 0,
        focusMembershipRevision: x.store.playerView(x.w.token).focusMembershipRevision,
        focusLocationId: x.store.playerView(x.w.token).focusLocationId,
      }),
      true,
    );
    assert.equal(x.store.playerView(x.w.token).settings.mode, 'follow');
    assert.equal(x.store.playerView(x.w.token).settings.blank, false);
    x.focus(x.secondary);
    assert.equal(await x.ui.cuePlayer('blank', null), true);
    assert.equal(x.store.playerView(x.w.token).settings.blank, true);
  } finally {
    x.cleanup();
  }
});

function pickedArt(x, id) {
  return x.store.registerPlayerAsset(x.w.token, {
    id,
    kind: 'custom',
    subjectId: null,
    title: 'Handout',
    sha256: 'b'.repeat(64),
    extension: '.png',
    bytes: 1,
  });
}
const reviewedFocus = (x) => {
  const v = x.store.playerView(x.w.token);
  return {
    focusId: v.focusId,
    focusRevision: v.focusRevision,
    focusMembershipRevision: v.focusMembershipRevision,
    focusLocationId: v.focusLocationId,
  };
};
test('a live handout publishes exactly the single newly picked asset', async () => {
  const x = await uiFixture();
  try {
    const id = randomUUID();
    window.campaign.pickPlayerArt = async () => ({ ok: true, value: pickedArt(x, id) });
    assert.equal(await x.ui.cuePlayerImage('custom', null, reviewedFocus(x)), true);
    assert.equal(x.store.currentPlayerFrame().mode, 'image');
    assert.equal(x.store.currentPlayerFrame().imageId, id);
    assert.equal(x.writes.length, 1);
    assert.equal(
      x.writes[0].expectedFocusMembershipRevision,
      x.store.playerView(x.w.token).focusMembershipRevision,
    );
  } finally {
    x.cleanup();
  }
});
test('concurrent matching asset additions do not arbitrarily publish one handout', async () => {
  const x = await uiFixture();
  try {
    const first = randomUUID(),
      second = randomUUID();
    window.campaign.pickPlayerArt = async () => {
      pickedArt(x, first);
      return { ok: true, value: pickedArt(x, second) };
    };
    assert.equal(await x.ui.cuePlayerImage('custom', null, reviewedFocus(x)), false);
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    assert.ok(x.store.playerView(x.w.token).assets.some((a) => a.id === first));
    assert.ok(x.store.playerView(x.w.token).assets.some((a) => a.id === second));
  } finally {
    x.cleanup();
  }
});
test('cancelling a handout picker has no display effect', async () => {
  const x = await uiFixture();
  try {
    const before = x.rows();
    window.campaign.pickPlayerArt = async () => ({ ok: true, value: null });
    assert.equal(await x.ui.cuePlayerImage('custom', null, reviewedFocus(x)), false);
    assert.deepEqual(x.rows(), before);
    assert.equal(x.writes.length, 0);
  } finally {
    x.cleanup();
  }
});
test('a focus switch during the handout picker retains art without publishing it', async () => {
  const x = await uiFixture();
  try {
    let release;
    const id = randomUUID();
    window.campaign.pickPlayerArt = () =>
      new Promise((resolve) => {
        release = () => resolve({ ok: true, value: pickedArt(x, id) });
      });
    const pending = x.ui.cuePlayerImage('custom', null, reviewedFocus(x));
    await until(() => !!release);
    x.focus(x.secondary);
    release();
    assert.equal(await pending, false);
    assert.equal(x.writes.length, 0);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    assert.ok(x.store.playerView(x.w.token).assets.some((a) => a.id === id));
  } finally {
    x.cleanup();
  }
});
for (const fault of ['failed', 'pending'])
  test('direct blank bypasses a ' + fault + ' preview read', async () => {
    const x = await uiFixture();
    try {
      x.store.executePlayer(x.request({ kind: 'settings', settings: x.settings }));
      let reads = 0;
      window.campaign.playerView = async () => {
        reads++;
        return fault === 'failed'
          ? { ok: false, error: 'Player read unavailable' }
          : new Promise(() => {});
      };
      let done = false,
        result;
      void x.ui.cuePlayer('blank', null).then((v) => {
        result = v;
        done = true;
      });
      await until(() => done);
      assert.equal(result, true);
      assert.equal(reads, 0);
      assert.equal(x.store.currentPlayerFrame().mode, 'blank');
      assert.equal(x.writes.at(-1).action.kind, 'blank');
    } finally {
      x.cleanup();
    }
  });
test('direct blank also works before any controls have been loaded', async () => {
  const x = await uiFixture();
  try {
    x.store.executePlayer(x.request({ kind: 'settings', settings: x.settings }));
    x.ui.deactivatePlayer();
    window.campaign.playerView = async () => {
      throw Error('Must not read');
    };
    assert.equal(await x.ui.cuePlayer('blank', null), true);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
  } finally {
    x.cleanup();
  }
});
test('a delayed older show cannot undo a confirmed direct blank', async () => {
  const x = await uiFixture();
  try {
    x.hold();
    const old = x.ui.cuePlayer('follow', {
      focusId: x.primary,
      focusRevision: 0,
      focusMembershipRevision: x.basis().expectedFocusMembershipRevision,
      focusLocationId: x.basis().expectedFocusLocationId,
    });
    await until(() => x.waiting.length === 1);
    window.campaign.playerView = async () => ({ ok: false, error: 'Preview read failed' });
    assert.equal(await x.ui.cuePlayer('blank', null), true);
    x.release();
    assert.equal(await old, false);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    assert.deepEqual(
      x.writes.map((c) => c.action.kind),
      ['settings', 'blank'],
    );
  } finally {
    x.cleanup();
  }
});

test('live handout never publishes when its fresh view belongs to another group', async () => {
  const x = await uiFixture();
  try {
    const origin = {
      focusId: x.primary,
      focusRevision: 0,
      focusMembershipRevision: x.basis().expectedFocusMembershipRevision,
      focusLocationId: x.basis().expectedFocusLocationId,
    };
    x.focus(x.secondary);
    let picks = 0;
    window.campaign.pickPlayerArt = async () => {
      picks++;
      throw Error('Must not pick');
    };
    assert.equal(await x.ui.cuePlayerImage('custom', null, origin), false);
    assert.equal(picks, 0);
    assert.equal(x.writes.length, 0);
  } finally {
    x.cleanup();
  }
});

test('automatic hex search cannot adopt a changed focus without explicit review', async () => {
  const x = await uiFixture();
  try {
    const original = x.el('player-target').textContent;
    x.focus(x.secondary);
    x.el('player-map-search').value = 'Tor';
    x.el('player-map-search').oninput();
    await until(() => !x.el('player-feedback').hidden);
    assert.match(x.el('player-feedback').textContent, /Fokussierte Gruppe geändert/);
    assert.equal(x.el('player-target').textContent, original);
    assert.equal(x.writes.length, 0);
    x.el('player-show-image').onclick();
    await until(() => x.writes.length === 1);
    await tick();
    assert.equal(x.writes[0].expectedFocusId, x.primary);
    assert.equal(x.store.currentPlayerFrame().mode, 'blank');
    x.el('player-refresh').onclick();
    await until(() => x.el('player-target').textContent.includes('Borin'));
    assert.doesNotMatch(x.el('player-target').textContent, /Ada/);
  } finally {
    x.cleanup();
  }
});

for (const kind of ['follow', 'image'])
  for (const fault of ['failed', 'pending'])
    test(`confirmed ${kind} cue succeeds without a ${fault} redundant preview read`, async () => {
      const x = await uiFixture();
      try {
        const read = window.campaign.playerView;
        let reads = 0,
          opened = 0;
        window.campaign.playerView = async (...args) =>
          ++reads === 1
            ? read(...args)
            : fault === 'failed'
              ? { ok: false, error: 'Later preview unavailable' }
              : new Promise(() => {});
        window.campaign.playerWindow = async () => {
          opened++;
          return { ok: true, value: undefined };
        };
        if (kind === 'image')
          window.campaign.pickPlayerArt = async () => ({
            ok: true,
            value: pickedArt(x, randomUUID()),
          });
        let done = false,
          result;
        const focus = reviewedFocus(x);
        void (
          kind === 'image'
            ? x.ui.cuePlayerImage('custom', null, focus)
            : x.ui.cuePlayer('follow', focus)
        ).then((v) => {
          result = v;
          done = true;
        });
        await until(() => done);
        assert.equal(result, true);
        assert.equal(reads, 1);
        assert.equal(opened, 1);
        assert.equal(x.writes.length, 1);
        assert.equal(x.store.playerView(x.w.token).settings.blank, false);
        assert.ok(x.messages.some((m) => !m.error && /Spieleranzeige/.test(m.text)));
      } finally {
        x.cleanup();
      }
    });

for (const kind of ['follow', 'image'])
  test(`confirmed ${kind} control uses its write response and preserves later edits`, async () => {
    const x = await uiFixture();
    try {
      let reads = 0,
        opened = 0;
      window.campaign.playerView = async () => {
        reads++;
        return { ok: false, error: 'Redundant read unavailable' };
      };
      window.campaign.playerWindow = async () => {
        opened++;
        return { ok: true, value: undefined };
      };
      x.hold();
      x.el(kind === 'image' ? 'player-show-image' : 'player-show-follow').onclick();
      await until(() => x.waiting.length === 1);
      x.el('player-title').value = '  Neuer privater Entwurf  ';
      x.release();
      await until(() =>
        x.messages.some((m) => !m.error && m.text === 'Spieleranzeige aktualisiert.'),
      );
      assert.equal(reads, 0);
      assert.equal(opened, 1);
      assert.equal(x.writes.length, 1);
      assert.equal(x.el('player-title').value, '  Neuer privater Entwurf  ');
      assert.equal(x.store.playerView(x.w.token).settings.blank, false);
      assert.ok(!x.messages.some((m) => m.error));
    } finally {
      x.cleanup();
    }
  });
test('a rejected image cue does not open a window or announce success', async () => {
  const x = await uiFixture();
  try {
    window.campaign.pickPlayerArt = async () => ({ ok: true, value: pickedArt(x, randomUUID()) });
    let opened = 0;
    window.campaign.playerWindow = async () => {
      opened++;
      return { ok: true, value: undefined };
    };
    window.campaign.executePlayer = async () => ({ ok: false, error: 'Publication rejected' });
    assert.equal(await x.ui.cuePlayerImage('custom', null, reviewedFocus(x)), false);
    assert.equal(opened, 0);
    assert.equal(x.store.playerView(x.w.token).settings.blank, true);
    assert.ok(x.messages.some((m) => m.error && m.text === 'Publication rejected'));
  } finally {
    x.cleanup();
  }
});
