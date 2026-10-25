import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/campaign/note-merge-ui.ts'],
  outfile: '.build/note-merge-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { NoteMergeUI } = createRequire(import.meta.url)('../../.build/note-merge-ui.cjs');
const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
};
function fixture(t) {
  const { document, window } = parseHTML('<html><body><main></main></body></html>'),
    old = globalThis.document;
  globalThis.document = document;
  t.after(() => {
    globalThis.document = old;
  });
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? '';
    },
    set(v) {
      values.set(this, v);
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
  };
  const map = new Map(),
    storage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    };
  const note = (id, title, gmNotes) => ({
      version: 1,
      id,
      revision: 1,
      kind: 'npc',
      title,
      readAloud: '',
      gmNotes,
      relations: [],
      creatureId: null,
      deleted: false,
    }),
    source = note('source', 'Ältere Nera', ' Alt\r\n'),
    target = note('target', 'Nera', ' Aktuell\r\n');
  const preview = {
      source,
      target,
      basis: 'a'.repeat(64),
      uses: [
        { kind: 'key', id: 'room', title: 'Wachstube' },
        { kind: 'visit', id: 'visit', title: 'Nachtwache' },
      ],
      blockers: [],
    },
    data = {
      notes: [
        { note: target, trashed: false },
        { note: source, trashed: true },
      ],
      plans: [],
      locations: [],
    };
  let owner = {
    token: 'old-token',
    campaignId: 'campaign',
    sourceId: source.id,
    notes: [
      { note: source, trashed: false },
      { note: target, trashed: false },
    ],
    current: () => true,
  };
  const writes = [],
    done = [],
    messages = [];
  const api = {
    noteMergePreview: async () => ({ ok: true, value: structuredClone(preview) }),
    changePreparation: async (c) => {
      writes.push(c);
      return { ok: true, value: data };
    },
    reconcilePreparation: async () => ({ ok: true, value: { outcome: 'applied', data } }),
  };
  const mount = () => {
    const button = document.createElement('button');
    document.body.append(button);
    const ui = new NoteMergeUI(button, document.querySelector('main'), {
      api,
      storage,
      prepare: async () => owner,
      done: async (...args) => {
        done.push(args);
      },
      tell: (...args) => messages.push(args),
    });
    ui.activate(owner.campaignId);
    return ui;
  };
  const input = (area, text) => {
    area.value = text;
    area.dispatchEvent(new window.Event('input'));
  };
  const ready = async (ui) => {
    await ui.open();
    ui.target.value = target.id;
    ui.target.onchange();
    await settle();
  };
  return {
    document,
    window,
    map,
    storage,
    preview,
    source,
    target,
    api,
    data,
    writes,
    done,
    messages,
    mount,
    input,
    ready,
    setOwner: (o) => (owner = o),
    getOwner: () => owner,
  };
}
test('an edited merge survives closing and remount, keeps exact raw text, and needs renewed explicit review', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await x.ready(u);
  x.input(u.privateText, '  Redaktion\r\nNoch unklar  ');
  u.close.click();
  u.dialog.remove();
  const fresh = x.mount();
  await fresh.open();
  assert.equal(fresh.privateText.value, '  Redaktion\r\nNoch unklar  ');
  assert.equal(fresh.reviewed.checked, false);
  assert.equal(fresh.confirm.disabled, true);
  assert.equal(x.writes.length, 0);
  fresh.reviewed.checked = true;
  fresh.reviewed.onchange();
  await fresh.submit();
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.gmNotes, '  Redaktion\r\nNoch unklar  ');
  assert.equal(x.done[0][0], x.target.id);
  assert.equal(x.map.has('note-merge:campaign'), false);
});
test('lost acknowledgement is saved before send, restored with the identical command and checked without resending', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await x.ready(u);
  x.api.changePreparation = async (c) => {
    assert.deepEqual(JSON.parse(x.map.get('note-merge:campaign')).command, c);
    x.writes.push(c);
    throw Error('Antwort verloren');
  };
  u.reviewed.checked = true;
  u.reviewed.onchange();
  await u.submit();
  assert(u.hasPending());
  assert(u.confirm.disabled);
  await u.submit();
  assert.equal(x.writes.length, 1);
  const sent = x.writes[0];
  u.dialog.remove();
  x.setOwner({ ...x.getOwner(), token: 'fresh-token' });
  const fresh = x.mount();
  await fresh.open();
  let checked;
  x.api.reconcilePreparation = async (c, token) => {
    checked = { c, token };
    return { ok: true, value: { outcome: 'applied', data: x.data } };
  };
  await fresh.checkPending();
  assert.deepEqual(checked, { c: sent, token: 'fresh-token' });
  assert.equal(x.writes.length, 1);
  assert.equal(x.done.length, 1);
  assert.equal(fresh.hasPending(), false);
});
for (const outcome of ['not-applied', 'conflict'])
  test(
    outcome + ' requires fresh originals and explicit confirmation before a new command',
    async (t) => {
      const x = fixture(t),
        u = x.mount();
      await x.ready(u);
      x.input(u.privateText, 'Mein erhaltener Text');
      x.api.changePreparation = async (c) => {
        x.writes.push(c);
        return { ok: false, error: 'Antwort ungeklärt' };
      };
      u.reviewed.checked = true;
      u.reviewed.onchange();
      await u.submit();
      const id = x.writes[0].commandId;
      x.api.reconcilePreparation = async () => ({ ok: true, value: { outcome, data: x.data } });
      await u.checkPending();
      assert.equal(u.privateText.value, 'Mein erhaltener Text');
      await u.submit();
      assert.equal(x.writes.length, 1);
      await u.refreshPreview();
      assert(u.confirm.disabled);
      u.reviewed.checked = true;
      u.reviewed.onchange();
      await u.submit();
      assert.equal(x.writes.length, 2);
      assert.notEqual(x.writes[1].commandId, id);
    },
  );
test('campaign activation revokes a late acknowledgement owner', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await x.ready(u);
  let release;
  x.api.changePreparation = (c) => {
    x.writes.push(c);
    return new Promise((r) => (release = () => r({ ok: true, value: x.data })));
  };
  u.reviewed.checked = true;
  u.reviewed.onchange();
  const sending = u.submit();
  await settle();
  u.activate('other');
  release();
  await sending;
  assert.equal(x.done.length, 0);
  assert(x.map.has('note-merge:campaign'));
  assert.equal(x.map.has('note-merge:other'), false);
});
test('unreadable original marker is kept verbatim until explicit recovery, never silently retried', async (t) => {
  const x = fixture(t),
    raw = '{"version":1,"command": broken  \r\n';
  x.map.set('note-merge:campaign', raw);
  const u = x.mount();
  assert(u.hasPending());
  await u.open();
  assert(u.dialog.open);
  assert.equal(x.document.querySelector('#note-merge-recovery-text').value, raw);
  assert(u.confirm.disabled);
  assert.equal(x.writes.length, 0);
  u.preserve.click();
  assert.equal(u.hasPending(), false);
  assert.equal(x.map.has('note-merge:campaign'), false);
  assert.equal([...x.map.values()][0], raw);
  assert.equal(x.writes.length, 0);
});
test('composition and persistence failure prevent sending while preserving the local draft', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await x.ready(u);
  u.privateText.dispatchEvent(new x.window.Event('compositionstart'));
  x.input(u.privateText, '正在输入');
  u.reviewed.checked = true;
  u.reviewed.onchange();
  await u.submit();
  assert.equal(x.writes.length, 0);
  u.privateText.dispatchEvent(new x.window.Event('compositionend'));
  assert.equal(u.reviewed.checked, false);
  u.reviewed.checked = true;
  u.reviewed.onchange();
  x.storage.setItem = () => {
    throw Error('Speicher voll');
  };
  await u.submit();
  assert.equal(x.writes.length, 0);
  assert.equal(u.privateText.value, '正在输入');
  assert(u.confirm.disabled);
});

test('a late merge preview cannot populate or persist another campaign', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await u.open();
  u.target.value = x.target.id;
  u.target.onchange = () => {};
  let release;
  x.api.noteMergePreview = () =>
    new Promise((r) => (release = () => r({ ok: true, value: x.preview })));
  const draft = JSON.parse(x.map.get('note-merge:campaign'));
  draft.targetId = x.target.id;
  x.map.set('note-merge:campaign', JSON.stringify(draft));
  u.activate('campaign');
  const opening = u.open();
  await settle();
  assert(release);
  u.activate('other');
  release();
  await opening;
  assert.equal(x.map.has('note-merge:other'), false);
  assert.equal(u.confirm.disabled, true);
  assert.equal(x.writes.length, 0);
});

test('a malformed pending-command marker cannot be treated as a clean resumable draft', (t) => {
  const x = fixture(t);
  x.map.set(
    'note-merge:campaign',
    JSON.stringify({
      version: 1,
      sourceId: 'source',
      targetId: 'target',
      readAloud: '',
      gmNotes: 'erhalten',
      edited: true,
      command: 0,
    }),
  );
  const u = x.mount();
  assert(u.hasPending());
  assert.equal(x.writes.length, 0);
  assert(x.map.get('note-merge:campaign').includes('erhalten'));
});

test('combined texts exceeding the writer limit remain editable and resumable without a pending command', async (t) => {
  const x = fixture(t);
  x.preview.source.gmNotes = 'a'.repeat(1_100_000);
  x.preview.target.gmNotes = 'b'.repeat(1_100_000);
  const u = x.mount();
  await x.ready(u);
  u.reviewed.checked = true;
  u.reviewed.onchange();
  assert(u.confirm.disabled);
  await u.submit();
  assert.equal(x.writes.length, 0);
  assert.equal(u.hasPending(), false);
  u.close.click();
  u.dialog.remove();
  const fresh = x.mount();
  await fresh.open();
  assert.equal(fresh.hasPending(), false);
  assert(fresh.privateText.value.length > 2_000_000);
  x.input(fresh.privateText, 'Gekürzt und geprüft');
  fresh.reviewed.checked = true;
  fresh.reviewed.onchange();
  await fresh.submit();
  assert.equal(x.writes.length, 1);
  assert.equal(x.writes[0].change.gmNotes, 'Gekürzt und geprüft');
});

test('failed local persistence keeps the editor open and blocks leaving until explicit discard or recovery', async (t) => {
  const x = fixture(t),
    u = x.mount();
  await x.ready(u);
  const save = x.storage.setItem;
  x.storage.setItem = () => {
    throw Error('Lokaler Speicher voll');
  };
  x.input(u.privateText, '  Noch nicht gesichert\r\n');
  assert(u.hasPending());
  u.close.click();
  assert(u.dialog.open);
  const cancel = new x.window.Event('cancel', { cancelable: true });
  u.dialog.dispatchEvent(cancel);
  assert(cancel.defaultPrevented);
  x.storage.setItem = save;
  await u.refreshPreview();
  assert.equal(u.hasPending(), false);
  assert.equal(JSON.parse(x.map.get('note-merge:campaign')).gmNotes, '  Noch nicht gesichert\r\n');
  x.storage.setItem = () => {
    throw Error('Voll');
  };
  x.input(u.privateText, 'Ausdrücklich zu verwerfen');
  assert(u.hasPending());
  u.discard.click();
  assert.equal(u.hasPending(), false);
  assert.equal(u.dialog.open, false);
  assert.equal(x.writes.length, 0);
});
