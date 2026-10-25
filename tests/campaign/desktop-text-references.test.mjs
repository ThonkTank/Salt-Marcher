import { preparationInstance } from '../helpers/preparation.mjs';
import { aliasSourceImport } from '../helpers/source.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/campaign/text-references'; export * from './src/app/campaign/text-reference-picker';export {LocationNotebook} from './src/app/campaign/location-notebook-ui';",
    resolveDir: process.cwd(),
    sourcefile: 'reference-review.ts',
    loader: 'ts',
  },
  outfile: '.build/text-reference-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const api = createRequire(import.meta.url)('../../.build/text-reference-review.cjs');
const link = '[Wache](dungeon-ref:note/old)',
  ref = { kind: 'note', id: 'old' };
for (const [name, raw] of [
  ['inline code', '`' + link + '`'],
  ['long code span', '``literal ` ' + link + '``'],
  ['backtick fence', '```md\r\n' + link + '\r\n```'],
  ['tilde fence', '~~~\n' + link + '\n~~~'],
  ['unclosed fence', '```\n' + link],
  ['indented code', '    ' + link],
  ['escaped literal', '\\' + link],
  ['image', '!' + link],
])
  test(`${name} stays literal in declared reference parsing`, () => {
    assert.deepEqual(api.textReferences(raw), []);
    // These consumers delegate to that same parser; exercise the empty-match path once.
    if (name === 'inline code') {
      assert.equal(api.plainReferenceText(raw), raw);
      assert.equal(
        api.remapTextReferences(raw, () => 'copied'),
        raw,
      );
      assert.deepEqual(api.documentReferences({ version: 1, readAloud: raw, gmNotes: raw }), []);
    }
  });
test('live targets remap while aliases, escapes, CRLF and external author links remain exact', () => {
  const raw = '\\\\' + link + '\r\n[[Vault note]] [external](https://example.org)';
  const found = api.textReferences(raw);
  assert.equal(found.length, 1);
  assert.equal(found[0].start, 2);
  assert.equal(
    api.remapTextReferences(raw, () => 'new id'),
    '\\\\[Wache](dungeon-ref:note/new%20id)\r\n[[Vault note]] [external](https://example.org)',
  );
  assert.equal(api.textReferences(api.referenceMarkdown(ref, '\\[Alias]'))[0].label, '\\[Alias]');
});
test('unmatched inline code does not consume a later paragraph', () => {
  assert.equal(api.textReferences('`unclosed\n\n' + link).length, 1);
});
const tick = () => new Promise((r) => setImmediate(r));
async function settle() {
  for (let i = 0; i < 8; i++) await tick();
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const ok = (value) => ({ ok: true, value });
function fixture(t, start = true) {
  const { window, document } = parseHTML('<html><body></body></html>'),
    saved = Object.fromEntries(['window', 'document', 'Option'].map((k) => [k, globalThis[k]]));
  Object.assign(globalThis, {
    window,
    document,
    Option: function (text, value) {
      const n = document.createElement('option');
      n.textContent = text;
      n.value = value;
      return n;
    },
  });
  window.HTMLSelectElement.prototype.add = function (n) {
    this.append(n);
  };
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.getAttribute('data-value') ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      this.setAttribute('data-value', v);
    },
  });
  window.HTMLElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLElement.prototype.focus = () => {};
  let current = true,
    calls = 0;
  const content = (id = 'old', revision = 1) => ({
    ref: { kind: 'note', id },
    revision,
    title: id === 'old' ? 'Wache' : 'Tor',
    label: 'NSC',
    note: { readAloud: '', gmNotes: '' },
  });
  window.campaign = {
    searchDesk: async () => ok({ entries: [content(), content('other')], next: null }),
    deskContent: async (_, r) => {
      calls++;
      return ok(content(r.id));
    },
  };
  const result = start
    ? api.chooseTextReference('token', '', () => current)
    : Promise.resolve(null);
  t.after(() => {
    for (const d of document.querySelectorAll('dialog')) d.close();
    Object.assign(globalThis, saved);
  });
  return {
    window,
    document,
    result,
    content,
    el: (id) => document.getElementById(id),
    cancel: () => document.querySelector('dialog > div button').onclick(),
    invalidate: () => {
      current = false;
    },
    get calls() {
      return calls;
    },
  };
}
async function selected(t) {
  const x = fixture(t);
  await settle();
  x.el('text-reference-results').querySelector('button').onclick();
  await settle();
  return x;
}
test('a changed target during pending insertion never inserts the older choice', async (t) => {
  const x = await selected(t),
    held = deferred();
  x.window.campaign.deskContent = (_, r) =>
    r.id === 'old' ? held.promise : Promise.resolve(ok(x.content(r.id)));
  x.el('text-reference-insert').onclick();
  x.el('text-reference-results').querySelectorAll('button')[1].onclick();
  await settle();
  held.resolve(ok(x.content()));
  await settle();
  assert.equal(x.el('text-reference-picker')?.open, true);
  x.cancel();
  assert.equal(await x.result, null);
});
test('an alias typed during the source read is retained', async (t) => {
  const x = fixture(t),
    held = deferred();
  await settle();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-results').querySelector('button').onclick();
  x.el('text-reference-alias').value = 'Eigenes Wort';
  x.el('text-reference-alias').oninput();
  held.resolve(ok(x.content()));
  await settle();
  assert.equal(x.el('text-reference-alias').value, 'Eigenes Wort');
  x.cancel();
  await x.result;
});
test('pending insertion cannot silently approve a newer alias', async (t) => {
  const x = await selected(t),
    held = deferred();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-insert').onclick();
  x.el('text-reference-alias').value = 'Neue Auswahl';
  x.el('text-reference-alias').oninput();
  held.resolve(ok(x.content()));
  await settle();
  assert.equal(x.el('text-reference-picker')?.open, true);
  x.cancel();
  assert.equal(await x.result, null);
});
test('a changed campaign invalidates the picker before accepting its late source', async (t) => {
  const x = await selected(t),
    held = deferred();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-insert').onclick();
  x.invalidate();
  held.resolve(ok(x.content()));
  await settle();
  assert.equal(await x.result, null);
  assert.equal(x.el('text-reference-picker'), null);
});
test('a repeated click while verification is pending issues only one read', async (t) => {
  const x = await selected(t),
    held = deferred();
  let reads = 0;
  x.window.campaign.deskContent = () => {
    reads++;
    return held.promise;
  };
  const b = x.el('text-reference-insert');
  b.onclick();
  b.onclick();
  assert.equal(reads, 1);
  held.resolve(ok(x.content()));
  assert.equal(await x.result, link);
});
test('a mismatching response identity cannot certify the selected target', async (t) => {
  const x = await selected(t);
  x.window.campaign.deskContent = async () => ok(x.content('other'));
  x.el('text-reference-insert').onclick();
  await settle();
  assert.equal(x.el('text-reference-picker')?.open, true);
  x.cancel();
  await x.result;
});
test('cancel preserves an empty result even when the verification later fails', async (t) => {
  const x = await selected(t),
    held = deferred();
  x.window.campaign.deskContent = () => held.promise;
  x.el('text-reference-insert').onclick();
  x.cancel();
  held.resolve({ ok: false, error: 'Späte Quelle' });
  await settle();
  assert.equal(await x.result, null);
  assert.equal(x.el('text-reference-picker'), null);
});

// Probe the actual preparation event consumer; only Flush/picker/timer ports are replaced.
const prepSource = readFileSync('src/app/campaign/preparation.ts', 'utf8');
buildSync({
  stdin: {
    contents: aliasSourceImport(
      prepSource,
      './text-reference-picker',
      'chooseTextReference',
      'realChooseTextReference',
    )
      .replace(
        '  const { document, get }',
        '  let chooseTextReference = realChooseTextReference;\n  const { document, get }',
      )
      .replace(
        '    editorSession,\n    showDayPreparation,',
        `    __referenceProbe: {set(w,n){context=w;selectedNote=n.id;noteDraft=n;blocked=false;editorSession.generation++;tell=text=>globalThis.__referenceMessages.push(text);},ports(p){flushPreparation=p.flush;chooseTextReference=p.pick;schedule=()=>{};},draft(){return noteDraft;},reload(){noteEditorGeneration++;},location(w,row){context=w;editorSession.generation++;selectedLocation=row.document.id;locationDraft=row;renderLocationSections();},locationDraft(){return locationDraft;}},
    editorSession,
    showDayPreparation,`,
      ),
    resolveDir: path.resolve('src/app/campaign'),
    sourcefile: 'preparation-reference-review.ts',
    loader: 'ts',
  },
  outfile: '.build/preparation-reference-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url);
function prepFixture(t) {
  const x = fixture(t, false),
    saved = globalThis.__referenceMessages;
  globalThis.__referenceMessages = [];
  t.after(() => {
    globalThis.__referenceMessages = saved;
  });
  x.document.body.innerHTML = readFileSync('src/app/workspace/index.html', 'utf8')
    .replace(/^[\s\S]*?<body[^>]*>/, '')
    .replace(/<\/body>[\s\S]*$/, '');
  x.window.campaign.onAudioTransfer = () => {};
  delete require.cache[require.resolve('../../.build/preparation-reference-review.cjs')];
  const module = preparationInstance(
      require('../../.build/preparation-reference-review.cjs'),
      x.document,
      x.window,
    ),
    ui = module.__referenceProbe,
    w = { token: 'token', campaign: { id: 'campaign' } },
    note = { id: 'note', gmNotes: 'A\r\nB', revision: 1 };
  module.initPreparation(
    () => {},
    async () => {},
  );
  ui.set(w, note);
  const area = x.el('note-gm');
  area.disabled = false;
  area.value = 'A\nB';
  area.selectionStart = 2;
  area.selectionEnd = 3;
  area.setSelectionRange = (from, to) => {
    area.selectionStart = from;
    area.selectionEnd = to;
  };
  ui.ports({ flush: async () => true, pick: async () => link });
  return {
    ...x,
    ui,
    w,
    note,
    area,
    messages: globalThis.__referenceMessages,
    click: () => x.el('note-text-reference').onclick(),
  };
}
test('new input during flush cannot receive a link at the old selection', async (t) => {
  const x = prepFixture(t),
    held = deferred();
  let picks = 0;
  x.ui.ports({
    flush: () => held.promise,
    pick: async () => {
      picks++;
      return link;
    },
  });
  x.click();
  x.ui.draft().gmNotes = 'Neuer Text';
  x.area.value = 'Neuer Text';
  held.resolve(true);
  await settle();
  assert.equal(picks, 0);
  assert.equal(x.ui.draft().gmNotes, 'Neuer Text');
});
test('same token and note ID after reactivation do not reuse an older insertion', async (t) => {
  const x = prepFixture(t),
    held = deferred();
  x.ui.ports({ flush: async () => true, pick: () => held.promise });
  x.click();
  await settle();
  x.ui.set({ ...x.w }, { ...x.note });
  held.resolve(link);
  await settle();
  assert.equal(x.ui.draft().gmNotes, 'A\r\nB');
});
test('a late picker failure does not report into a different preparation owner', async (t) => {
  const x = prepFixture(t),
    held = deferred();
  x.ui.ports({
    flush: async () => true,
    pick: () =>
      held.promise.then(() => {
        throw new Error('Alte Quelle');
      }),
  });
  x.click();
  await settle();
  x.ui.set({ token: 'other', campaign: { id: 'other' } }, { id: 'other', gmNotes: 'Anders' });
  held.resolve();
  await settle();
  assert.deepEqual(x.messages, []);
});
test('the current editor inserts at its original normalized CRLF selection', async (t) => {
  const x = prepFixture(t);
  x.click();
  await settle();
  assert.equal(x.ui.draft().gmNotes, 'A\r\n' + link);
  assert.equal(x.area.selectionStart, 2 + link.length);
});

test('derived 200-link limits do not truncate source remap beyond the displayed page', () => {
  const raw = Array.from({ length: 240 }, (_, i) =>
    api.referenceMarkdown({ kind: 'note', id: 'id-' + i }, 'Alias ' + i),
  ).join('\r\n');
  assert.equal(api.textReferences(raw).length, 200);
  assert.equal(api.documentReferences({ version: 1, readAloud: '', gmNotes: raw }).length, 201);
  const copy = api.remapTextReferences(raw, (r) => 'copy-' + r.id);
  assert.equal(api.textReferences(copy, 1000).length, 240);
  assert.match(copy, /copy-id-239/);
});
test('a closed fence restores live interpretation after its delimiter', () => {
  assert.deepEqual(
    api.textReferences('````\n' + link + '\n```\n' + link + '\n````\n' + link).map((r) => r.ref),
    [ref],
  );
});

test('an editor reload with unchanged token, ID and prose still invalidates the old selection', async (t) => {
  const x = prepFixture(t),
    held = deferred();
  x.ui.ports({ flush: async () => true, pick: () => held.promise });
  x.click();
  await settle();
  x.ui.reload();
  held.resolve(link);
  await settle();
  assert.equal(x.ui.draft().gmNotes, 'A\r\nB');
});

function locationFixture(t) {
  const x = prepFixture(t),
    row = {
      revision: 1,
      trashed: false,
      document: {
        id: 'location',
        name: 'Tor',
        sections: [{ id: 'section', title: 'Text', markdown: 'A\r\nB' }],
        detailMaps: [],
        keyLinks: [],
      },
    };
  x.ui.location(x.w, row);
  const field = x.el('location-section-0');
  field.value = 'A\nB';
  field.selectionStart = 2;
  field.selectionEnd = 3;
  field.setSelectionRange = () => {};
  return {
    ...x,
    row,
    field,
    insert: () =>
      [...x.document.querySelectorAll('#location-sections button')]
        .find((b) => b.textContent === 'Textverweis einfügen…')
        .onclick(),
  };
}
test('location section input during flush cannot reuse the earlier selection', async (t) => {
  const x = locationFixture(t),
    held = deferred();
  let picks = 0;
  x.ui.ports({
    flush: () => held.promise,
    pick: async () => {
      picks++;
      return link;
    },
  });
  x.insert();
  x.ui.locationDraft().document.sections[0].markdown = 'Neuer Abschnitt';
  held.resolve(true);
  await settle();
  assert.equal(picks, 0);
  assert.equal(x.ui.locationDraft().document.sections[0].markdown, 'Neuer Abschnitt');
});
test('a detached section reference control cannot insert after the sections were rerendered', async (t) => {
  const x = locationFixture(t),
    held = deferred();
  x.ui.ports({ flush: async () => true, pick: () => held.promise });
  x.insert();
  await settle();
  x.ui.location(x.w, structuredClone(x.row));
  held.resolve(link);
  await settle();
  assert.equal(x.ui.locationDraft().document.sections[0].markdown, 'A\r\nB');
});
async function notebookFixture(t) {
  const x = fixture(t, false),
    w = { token: 'token', campaign: { id: 'campaign' } },
    raw = link + '\r\n[[Vault note]]',
    actions = [],
    messages = [],
    query = x.document.querySelector.bind(x.document);
  x.document.querySelector = (selector) => (selector === 'dialog:modal' ? null : query(selector));
  x.window.campaign = {
    live: async () =>
      ok({
        focusId: 'scene',
        focusRevision: 1,
        scene: { id: 'scene', title: 'Gruppe', locationId: 'location' },
      }),
    deskContent: async (_, r) =>
      ok({
        ref: r,
        revision: 1,
        title: r.id,
        label: 'Ort',
        location: { sections: [{ id: 'section', title: 'Text', markdown: raw }], detailMaps: [] },
      }),
    locationMaterials: async (_, q) =>
      ok({
        items: q.locationId
          ? []
          : [
              { id: 'location', title: 'Tor', detail: 'Ort' },
              { id: 'other-location', title: 'Hafen', detail: 'Ort' },
            ],
        next: null,
        locationRevision: q.locationId ? 1 : null,
      }),
  };
  const n = new api.LocationNotebook(
    () => w,
    async () => true,
    (text) => messages.push(text),
    async (action) => {
      actions.push(action);
    },
  );
  await n.open('location');
  return {
    ...x,
    n,
    w,
    raw,
    actions,
    messages,
    button: () =>
      [...x.document.querySelectorAll('#location-notebook button')].find((b) =>
        b.textContent.startsWith('Nur diesen Abschnitt'),
      ),
  };
}
test('the location read-aloud handoff retains declared and external author bytes', async (t) => {
  const x = await notebookFixture(t);
  x.button().onclick();
  await settle();
  assert.equal(x.actions[0]?.text, x.raw);
});
test('an old location section button cannot approve a different currently selected location', async (t) => {
  const x = await notebookFixture(t),
    b = x.button();
  await x.n.select('other-location');
  b.onclick();
  await settle();
  assert.deepEqual(x.actions, []);
});

test('directory choices and persistent notebook controls can be used again after navigation and close', async (t) => {
  const x = await notebookFixture(t),
    buttons = [...x.document.querySelectorAll('.location-directory-row')];
  for (const [index, id] of ['other-location', 'location', 'other-location'].entries()) {
    const b = buttons.find((b) => b.dataset.locationId === id);
    assert.equal(b.disabled, false);
    b.onclick();
    await settle();
    assert.equal(x.n.content.ref.id, id);
    if (index === 0) assert.match(x.el('location-notebook-document').textContent, /other-location/);
  }
  const close = [...x.document.querySelectorAll('#location-notebook button')].find(
    (b) => b.textContent === 'Schließen',
  );
  close.onclick();
  await settle();
  await x.n.open('location');
  assert.equal(close.disabled, false);
  close.onclick();
  await settle();
  assert.equal(x.el('location-notebook').open, false);
});

test('a pending scene lookup does not hide location prose, links or related material', async (t) => {
  const x = await notebookFixture(t),
    held = deferred(),
    reads = [];
  x.window.campaign.live = () => held.promise;
  const materials = x.window.campaign.locationMaterials;
  x.window.campaign.locationMaterials = async (token, q) => {
    reads.push(q);
    return materials(token, q);
  };
  const opened = x.n.select('location');
  await settle();
  const prose = x.document.querySelector('.location-notebook-prose');
  assert.ok(prose, 'healthy source must be readable before optional scene response');
  assert.equal(prose.textContent, 'Wache\r\n[[Vault note]]');
  assert.equal(prose.querySelector('.text-reference-inline').disabled, false);
  assert.ok(
    reads.some((q) => q.locationId === 'location'),
    'material lookup must not wait for scene',
  );
  assert.equal(x.button(), undefined);
  held.resolve(
    ok({ focusId: 'scene', focusRevision: 7, scene: { id: 'scene', title: 'Späte Gruppe' } }),
  );
  await opened;
  await settle();
  assert.ok(x.button());
  assert.match(x.button().textContent, /Späte Gruppe/);
  x.n.close();
});
test('an unavailable scene leaves authored references readable and only disables scene handoff until explicit refresh', async (t) => {
  const x = await notebookFixture(t);
  x.window.campaign.live = async () => ({ ok: false, error: 'Gruppenuhr nicht verfügbar' });
  await x.n.select('location');
  await settle();
  assert.equal(
    x.document.querySelector('.location-notebook-prose')?.textContent,
    'Wache\r\n[[Vault note]]',
  );
  assert.equal(x.document.querySelectorAll('.text-reference-inline').length, 1);
  assert.equal(x.button(), undefined);
  assert.match(x.el('location-notebook-document').textContent, /Gruppenuhr nicht verfügbar/);
  x.window.campaign.live = async () =>
    ok({ focusId: 'scene', focusRevision: 2, scene: { id: 'scene', title: 'Erholte Gruppe' } });
  await x.n.select('location');
  await settle();
  assert.ok(x.button());
  assert.doesNotMatch(x.el('location-notebook-document').textContent, /Gruppenuhr nicht verfügbar/);
  x.button().onclick();
  await settle();
  assert.equal(x.actions[0]?.text, x.raw);
});
for (const failed of [false, true])
  test(`a late ${failed ? 'failed' : 'successful'} scene lookup cannot alter a newer location`, async (t) => {
    const x = await notebookFixture(t),
      held = deferred(),
      live = x.window.campaign.live;
    let first = true;
    x.window.campaign.live = (...args) => {
      if (first) {
        first = false;
        return held.promise;
      }
      return live(...args);
    };
    const old = x.n.select('location');
    await settle();
    await x.n.select('other-location');
    await settle();
    const content = x.el('location-notebook-document').textContent;
    held.resolve(
      failed
        ? { ok: false, error: 'Veraltete Gruppe' }
        : ok({
            focusId: 'old-scene',
            focusRevision: 1,
            scene: { id: 'old-scene', title: 'Veraltete Gruppe' },
          }),
    );
    await old;
    await settle();
    assert.equal(x.el('location-notebook-document').textContent, content);
    assert.deepEqual(x.messages, []);
    x.n.close();
  });
