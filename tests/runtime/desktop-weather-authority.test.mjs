import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/weather-authority-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
buildSync({
  entryPoints: ['src/app/runtime/world-ui.ts'],
  outfile: '.build/weather-authority-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  { CampaignStore } = require('../../.build/weather-authority-store.cjs'),
  tick = () => new Promise((r) => setImmediate(r));
async function until(fn) {
  for (let n = 0; n < 100 && !fn(); n++) await tick();
  assert.ok(fn());
}
async function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'weather-authority-')),
    store = new CampaignStore(path.join(root, 'store.sqlite')),
    cam = store.create('Wetter'),
    w = store.activate(cam.id),
    command = (action) => ({ commandId: randomUUID(), campaignId: cam.id, token: w.token, action }),
    scene = store.executeLive(command({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  const saved = {
      window: globalThis.window,
      document: globalThis.document,
      Event: globalThis.Event,
    },
    { window, document } = parseHTML(readFileSync('src/app/workspace/index.html', 'utf8'));
  Object.assign(globalThis, { window, document, Event: window.Event });
  let holdBefore = false,
    releaseBefore = null;
  const writes = [],
    messages = [],
    response = (fn) => {
      try {
        return { ok: true, value: fn() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    };
  window.campaign = {
    world: async (token) => response(() => store.world(token)),
    preparation: async (token) => response(() => store.preparation(token)),
    live: async (token) => response(() => store.live(token)),
    sceneWorld: async (token, id) => response(() => store.sceneWorld(token, id)),
    executeWorld: async (c) => {
      writes.push(structuredClone(c));
      return response(() => store.executeWorld(c));
    },
    reconcileWorld: async (c, token) => response(() => store.reconcileWorld(c, token)),
  };
  delete require.cache[require.resolve('../../.build/weather-authority-ui.cjs')];
  const ui = require('../../.build/weather-authority-ui.cjs');
  ui.initWorld(
    (text, error) => messages.push({ text, error }),
    async () => {
      if (holdBefore) {
        holdBefore = false;
        await new Promise((r) => {
          releaseBefore = r;
        });
      }
      return true;
    },
    async () => {},
    async () => {},
  );
  for (const select of document.querySelectorAll('select')) {
    Object.defineProperty(select, 'value', {
      value: select.id === 'weather-override-kind' ? 'clear' : '',
      writable: true,
    });
    Object.defineProperty(select, 'selectedOptions', {
      get: () => [...select.querySelectorAll('option')].filter((o) => o.value === select.value),
    });
  }
  ui.activateWorld(w);
  await ui.renderLiveWorld(w.token, scene.id);
  t.after(async () => {
    await tick();
    Object.assign(globalThis, saved);
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const input = (text) => {
      const e = document.getElementById('weather-override-notes');
      e.value = text;
      e.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    submit = () =>
      document
        .getElementById('weather-override-form')
        .onsubmit(new window.Event('submit', { cancelable: true }));
  const external = () =>
    store.executeWorld(
      command({
        kind: 'weather-override',
        sceneId: scene.id,
        expectedClockRevision: 0,
        expectedOverrideRevision: store.sceneWorld(w.token, scene.id).weatherOverrideRevision,
        weather: {
          kind: 'fog',
          label: 'Später bestätigt',
          intensity: 0.8,
          windKmh: 2,
          effects: {
            visibilityMeters: 100,
            travelFactor: 1,
            temperatureC: 15,
            ambience: [],
            perception: 'GM',
            combatNote: 'Später',
          },
          source: 'GM',
        },
      }),
    );
  return {
    store,
    cam,
    w,
    scene,
    command,
    window,
    document,
    ui,
    writes,
    messages,
    input,
    submit,
    external,
    holdBefore: () => {
      holdBefore = true;
    },
    hasBefore: () => !!releaseBefore,
    releaseBefore: () => releaseBefore(),
  };
}
test('weather refresh does not adopt a newer override as the basis of an open input', async (t) => {
  const x = await fixture(t);
  x.input('Offene eigene Eingabe');
  x.external();
  await x.ui.renderLiveWorld(x.w.token, x.scene.id);
  x.submit();
  await until(() => x.writes.length === 1);
  await until(() => x.messages.some((m) => m.error));
  assert.equal(x.writes[0].action.expectedOverrideRevision, null);
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Offene eigene Eingabe');
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).weather.label, 'Später bestätigt');
});
test('weather Context change during the pre-write barrier prevents the old command', async (t) => {
  const x = await fixture(t);
  x.input('Alte Kampagne');
  x.holdBefore();
  x.submit();
  await until(x.hasBefore);
  const other = x.store.create('Andere Kampagne'),
    w = x.store.activate(other.id),
    scene = x.store.executeLive({
      commandId: randomUUID(),
      campaignId: other.id,
      token: w.token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene;
  x.ui.activateWorld(w);
  await x.ui.renderLiveWorld(w.token, scene.id);
  x.releaseBefore();
  await tick();
  await tick();
  assert.equal(x.writes.length, 0);
  assert.ok(!x.messages.some((m) => m.text.includes('bestätigt')));
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Alte Kampagne');
});

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
test('late weather acknowledgement cannot announce or populate another Campaign', async (t) => {
  const x = await fixture(t),
    d = deferred(),
    execute = x.window.campaign.executeWorld;
  let committed;
  x.window.campaign.executeWorld = async (command) => {
    committed = await execute(command);
    return d.promise;
  };
  x.input('Alte eigene Änderung');
  x.submit();
  await until(() => !!committed);
  const other = x.store.create('B'),
    w = x.store.activate(other.id),
    scene = x.store.executeLive({
      commandId: randomUUID(),
      campaignId: other.id,
      token: w.token,
      action: { kind: 'initialize', expectedRosterRevision: 0 },
    }).scene;
  x.ui.activateWorld(w);
  await x.ui.renderLiveWorld(w.token, scene.id);
  const summary = x.document.getElementById('live-world-summary').textContent;
  d.resolve(committed);
  await tick();
  await tick();
  assert.equal(x.document.getElementById('live-world-summary').textContent, summary);
  assert.ok(
    !x.messages.some(
      (m) => m.text.includes('bestätigt') || m.text === 'Wetter für diese Gruppe gespeichert.',
    ),
  );
});
test('own weather acknowledgement advances only the basis of later retained input', async (t) => {
  const x = await fixture(t),
    d = deferred(),
    execute = x.window.campaign.executeWorld;
  let committed;
  x.window.campaign.executeWorld = async (command) => {
    const response = await execute(command);
    if (!committed) {
      committed = response;
      return d.promise;
    }
    return response;
  };
  x.input('Erste Eingabe');
  x.submit();
  await until(() => !!committed);
  x.input('Spätere Eingabe');
  d.resolve(committed);
  await until(() => x.messages.some((m) => m.text === 'Wetter für diese Gruppe gespeichert.'));
  x.submit();
  await until(() => x.writes.length === 2);
  assert.equal(x.writes[1].action.expectedOverrideRevision, 1);
  assert.equal(x.writes[1].action.weather.effects.combatNote, 'Spätere Eingabe');
  await tick();
});
test('a newer read stays visible while an older own weather acknowledgement returns', async (t) => {
  const x = await fixture(t),
    d = deferred(),
    execute = x.window.campaign.executeWorld;
  let committed;
  x.window.campaign.executeWorld = async (command) => {
    committed = await execute(command);
    return d.promise;
  };
  x.input('Eigene Eingabe');
  x.submit();
  await until(() => !!committed);
  x.external();
  await x.ui.renderLiveWorld(x.w.token, x.scene.id);
  assert.ok(
    x.document.getElementById('live-world-summary').textContent.includes('Später bestätigt'),
  );
  d.resolve(committed);
  await tick();
  await tick();
  assert.ok(
    x.document.getElementById('live-world-summary').textContent.includes('Später bestätigt'),
  );
});
test('explicit draft discard loads the latest weather basis and permits a new input', async (t) => {
  const x = await fixture(t);
  x.input('Alter Entwurf');
  x.external();
  await x.ui.renderLiveWorld(x.w.token, x.scene.id);
  x.document.getElementById('weather-discard-input').click();
  await until(() => x.messages.some((m) => m.text.includes('Wettereingabe verworfen')));
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Später');
  x.input('Neue Eingabe');
  x.submit();
  await until(() => x.writes.length === 1);
  assert.equal(x.writes[0].action.expectedOverrideRevision, 1);
  await tick();
});
test('a late weather read cannot roll back a newer own acknowledgement', async (t) => {
  const x = await fixture(t),
    d = deferred(),
    read = x.window.campaign.sceneWorld;
  let captured;
  x.window.campaign.sceneWorld = async (...args) => {
    captured = await read(...args);
    return d.promise;
  };
  const refresh = x.ui.renderLiveWorld(x.w.token, x.scene.id);
  await until(() => !!captured);
  x.input('Eigene neue Änderung');
  x.submit();
  await until(() => x.messages.some((m) => m.text === 'Wetter für diese Gruppe gespeichert.'));
  d.resolve(captured);
  await refresh;
  assert.ok(
    x.document.getElementById('live-weather-effects').textContent.includes('Eigene neue Änderung'),
  );
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Eigene neue Änderung');
});

test('weather receipt reconciliation advances own basis without losing later input or replaying the command', async (t) => {
  const x = await fixture(t),
    execute = x.window.campaign.executeWorld;
  let lost = true;
  x.window.campaign.executeWorld = async (c) => {
    const result = await execute(c);
    if (lost) {
      lost = false;
      throw new Error('Antwort verloren');
    }
    return result;
  };
  x.input('Gespeicherte Eingabe');
  x.submit();
  await until(() => x.messages.some((m) => m.error && m.text === 'Antwort verloren'));
  x.input('Spätere Eingabe');
  assert.equal(await x.ui.reconcileWorldWrite(), true);
  assert.equal(x.writes.length, 1);
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Spätere Eingabe');
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).weatherOverrideRevision, 1);
  x.submit();
  await until(() => x.writes.length === 2);
  assert.equal(x.writes[1].action.expectedOverrideRevision, 1);
  await until(() => x.messages.some((m) => m.text === 'Wetter für diese Gruppe gespeichert.'));
  assert.equal(
    x.store.sceneWorld(x.w.token, x.scene.id).weather.effects.combatNote,
    'Spätere Eingabe',
  );
});
test('weather reconciliation of an unapplied command preserves the original input basis', async (t) => {
  const x = await fixture(t),
    execute = x.window.campaign.executeWorld;
  let lost = true;
  x.window.campaign.executeWorld = async (c) => {
    if (lost) {
      lost = false;
      throw new Error('Vor Speicherung getrennt');
    }
    return execute(c);
  };
  x.input('Unbestätigte Eingabe');
  x.submit();
  await until(() => x.messages.some((m) => m.error));
  assert.equal(await x.ui.reconcileWorldWrite(), true);
  assert.equal(x.writes.length, 0);
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Unbestätigte Eingabe');
  x.submit();
  await until(() => x.writes.length === 1);
  assert.equal(x.writes[0].action.expectedOverrideRevision, null);
  await until(() => x.messages.some((m) => m.text === 'Wetter für diese Gruppe gespeichert.'));
});

test('releasing weather preserves an open override input and advances only its own confirmed basis', async (t) => {
  const x = await fixture(t);
  x.external();
  await x.ui.renderLiveWorld(x.w.token, x.scene.id);
  x.input('Noch offene Eingabe');
  x.document.getElementById('weather-release').click();
  await until(() => x.messages.some((m) => m.text === 'Wetter für diese Gruppe gespeichert.'));
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Noch offene Eingabe');
  assert.equal(x.store.sceneWorld(x.w.token, x.scene.id).weatherOverrideRevision, 2);
  x.submit();
  await until(() => x.writes.length === 2);
  assert.equal(x.writes[1].action.expectedOverrideRevision, 2);
  await until(() => x.store.sceneWorld(x.w.token, x.scene.id).weatherOverrideRevision === 3);
});
test('late explicit discard cannot replace a newer read or erase its open input', async (t) => {
  const x = await fixture(t),
    d = deferred(),
    read = x.window.campaign.sceneWorld;
  let captured;
  x.input('Erhaltene Eingabe');
  x.window.campaign.sceneWorld = async (...args) => {
    captured = await read(...args);
    return d.promise;
  };
  x.document.getElementById('weather-discard-input').click();
  await until(() => !!captured);
  x.external();
  x.window.campaign.sceneWorld = read;
  await x.ui.renderLiveWorld(x.w.token, x.scene.id);
  d.resolve(captured);
  await until(() => x.messages.some((m) => m.error));
  assert.equal(x.document.getElementById('weather-override-notes').value, 'Erhaltene Eingabe');
  assert.ok(
    x.document.getElementById('live-world-summary').textContent.includes('Später bestätigt'),
  );
});
