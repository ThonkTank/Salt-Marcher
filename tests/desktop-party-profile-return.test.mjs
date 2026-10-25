import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { build, buildSync } from 'esbuild';
import { parseHTML } from './helpers/dom.mjs';
const base = '.build/party-profile-return',
  require = createRequire(import.meta.url),
  tick = () => new Promise((r) => setImmediate(r));
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: base + '/store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
await build({
  entryPoints: ['src/app/party-topbar-ui.ts'],
  outfile: base + '/ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'live-boundary',
      setup(b) {
        b.onResolve({ filter: /^\.\/live$/ }, (args) =>
          args.importer.endsWith('/party-topbar-ui.ts')
            ? { path: 'live', namespace: 'profile-test' }
            : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: 'profile-test' }, () => ({
          loader: 'js',
          contents:
            'export const runPartyLive=(token,action)=>window.commitLive(token,action);export const runPartyProgress=()=>{throw Error("Unexpected progress write")};export const openPartyMove=()=>{throw Error("Unexpected move")};',
        }));
      },
    },
  ],
});
const { CampaignStore } = require('../' + base + '/store.cjs');
async function fixture(t) {
  const dir = mkdtempSync('/tmp/profile-return-'),
    store = new CampaignStore(dir + '/workbench.sqlite'),
    campaign = store.create('Profilübergang'),
    workspace = store.activate(campaign.id);
  const command = (action) => ({
    commandId: randomUUID(),
    campaignId: campaign.id,
    token: workspace.token,
    action,
  });
  const ids = Array.from(
    { length: 45 },
    (_, i) =>
      store.executeLive(
        command({
          kind: 'create-character',
          profile: { name: i === 0 ? 'Borin' : i < 3 ? 'Ada' : 'Reserve ' + i },
        }),
      ).character.id,
  );
  const previous = { window: globalThis.window, document: globalThis.document },
    { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8'));
  Object.assign(globalThis, { window, document });
  let focused;
  const proto = window.HTMLElement.prototype,
    methods = ['scrollIntoView', 'focus'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(proto, key),
    ]);
  proto.scrollIntoView = () => {};
  proto.focus = function () {
    if (!this.disabled) focused = this;
  };
  const get = (id) => document.getElementById('party-' + id);
  Object.defineProperty(get('level'), 'value', { value: '', writable: true });
  window.innerWidth = 1000;
  window.innerHeight = 800;
  window.localStorage = { getItem: () => null, setItem() {} };
  get('shortcut').getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  let open = false,
    fail = false,
    hold = false,
    release;
  const toggle = (state) => {
    const event = new window.Event('beforetoggle');
    event.newState = state;
    get('popover').dispatchEvent(event);
    open = state === 'open';
  };
  get('popover').matches = () => open;
  get('popover').showPopover = () => toggle('open');
  get('popover').hidePopover = () => toggle('closed');
  window.campaign = {
    live: async (token) => ({ ok: true, value: store.live(token) }),
    progress: async (token) => ({ ok: true, value: store.progress(token) }),
  };
  window.commitLive = async (token, action) => {
    assert.equal(token, workspace.token);
    if (fail) throw Error('Kontrollierter Schreibfehler');
    const ack = store.executeLive(command(action));
    if (hold) await new Promise((r) => (release = r));
    return ack;
  };
  delete require.cache[require.resolve('../' + base + '/ui.cjs')];
  const ui = require('../' + base + '/ui.cjs');
  ui.initPartyTopbar(() => {});
  ui.activatePartyTopbar(workspace);
  t.after(() => {
    ui.activatePartyTopbar(null);
    for (const [key, descriptor] of methods) {
      if (descriptor) Object.defineProperty(proto, key, descriptor);
      else delete proto[key];
    }
    Object.assign(globalThis, previous);
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  get('shortcut').onclick();
  await tick();
  get('roster-panel').open = true;
  const search = (value) => {
      get('search').value = value;
      get('search').oninput();
    },
    rows = () => [...get('roster').querySelectorAll('.party-card')];
  const save = async () => {
    get('profile-form').onsubmit({ preventDefault() {} });
    await tick();
  };
  const edit = (id) =>
    rows()
      .find((r) => r.dataset.characterId === id)
      .querySelectorAll('button')
      .forEach((b) => {
        if (b.textContent === 'Profil bearbeiten') b.onclick();
      });
  return {
    get,
    store,
    workspace,
    campaign,
    command,
    ids,
    ui,
    search,
    rows,
    save,
    edit,
    focused: () => focused,
    fail: () => (fail = true),
    hold: () => (hold = true),
    release: () => release(),
  };
}
test('confirmed creation reveals the exact new homonym beyond the first page and old search without inventing optional values', async (t) => {
  const f = await fixture(t);
  f.search('Borin');
  f.get('create').onclick();
  f.get('name').value = 'Ada';
  await f.save();
  const roster = f.store.live(f.workspace.token).roster,
    c = roster.find((c) => !f.ids.includes(c.id));
  assert(c);
  assert.equal(roster.length, 46);
  assert.equal(f.get('search').value, c.id);
  assert.deepEqual(
    f.rows().map((r) => r.dataset.characterId),
    [c.id],
  );
  assert.equal(f.get('editor').hidden, true);
  assert.equal(f.focused()?.id, 'party-search');
  assert.deepEqual(c.profile, { name: 'Ada' });
  const p = f.store.progress(f.workspace.token).characters.find((p) => p.characterId === c.id);
  assert.equal(p.xp, null);
  assert.equal(p.health, null);
});
test('renaming a filtered homonym returns to the same identity and retains its other profile fields', async (t) => {
  const f = await fixture(t),
    id = f.ids[1];
  f.search('Ada');
  f.edit(id);
  f.get('name').value = 'Ada neu';
  f.get('field-playerName').value = 'Lea Ω';
  f.get('field-languages').value = 'Common, Elvish';
  await f.save();
  assert.equal(f.get('search').value, id);
  assert.deepEqual(
    f.rows().map((r) => r.dataset.characterId),
    [id],
  );
  assert.equal(f.focused()?.id, 'party-search');
  const c = f.store.live(f.workspace.token).roster.find((c) => c.id === id);
  assert.deepEqual(c.profile, {
    name: 'Ada neu',
    playerName: 'Lea Ω',
    languages: ['Common', 'Elvish'],
  });
  assert.equal(
    f.store.live(f.workspace.token).roster.find((c) => c.id === f.ids[2]).profile.name,
    'Ada',
  );
});
for (const kind of ['failed', 'stale'])
  test(
    kind + ' profile save keeps the raw form and original search without a false identity handoff',
    async (t) => {
      const f = await fixture(t),
        id = f.ids[1];
      f.search('Ada');
      f.edit(id);
      f.get('name').value = 'Nicht bestätigt';
      if (kind === 'failed') f.fail();
      else
        f.store.executeLive(
          f.command({
            kind: 'profile',
            characterId: id,
            expectedRevision: 1,
            profile: { name: 'Anderer bestätigter Stand' },
          }),
        );
      await f.save();
      assert.equal(f.get('search').value, 'Ada');
      assert.equal(f.get('editor').hidden, false);
      assert.equal(f.get('name').value, 'Nicht bestätigt');
      assert.match(f.get('editor-status').textContent, /Schreibfehler|inzwischen geändert/);
    },
  );
test('a late confirmed profile answer cannot select an old character in a replacement campaign', async (t) => {
  const f = await fixture(t);
  f.search('Borin');
  f.get('create').onclick();
  f.get('name').value = 'Alte Kampagne';
  f.hold();
  await f.save();
  const other = f.store.create('Andere Kampagne'),
    w = f.store.activate(other.id);
  f.ui.activatePartyTopbar(w);
  f.release();
  await tick();
  assert.equal(f.get('search').value, '');
  assert.equal(f.rows().length, 0);
  assert.equal(f.get('editor').hidden, true);
});

test('a confirmed write cannot move focus into a replacement Party window', async (t) => {
  const f = await fixture(t);
  f.search('Borin');
  f.get('create').onclick();
  f.get('name').value = 'Noch bestätigt';
  f.hold();
  await f.save();
  f.get('popover').hidePopover();
  f.get('shortcut').onclick();
  await tick();
  const prior = f.focused()?.id;
  f.release();
  await tick();
  assert.equal(f.focused()?.id, prior);
});
