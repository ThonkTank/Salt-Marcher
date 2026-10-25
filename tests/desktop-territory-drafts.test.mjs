import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';
buildSync({
  stdin: {
    contents:
      "export {TerritoryWorkbench} from './src/app/atlas-territories-ui';export {defaultTerritoryLayers} from './src/app/atlas-territories';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/territory-drafts.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { TerritoryWorkbench, defaultTerritoryLayers } = createRequire(import.meta.url)(
  '../.build/territory-drafts.cjs',
);
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};
async function fixture() {
  const { document, window } = parseHTML(
    '<html><body><select id="land-tool"><option value="territory">Region</option></select><canvas></canvas></body></html>',
  );
  const old = {
    document: global.document,
    window: global.window,
    Option: global.Option,
  };
  const values = new WeakMap();
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return values.get(this) ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      values.set(this, v);
    },
  });
  Object.assign(global, {
    document,
    window,
    Option: function (name, value) {
      const o = document.createElement('option');
      o.textContent = name;
      o.value = value;
      return o;
    },
  });
  const state = {
    layers: defaultTerritoryLayers(),
    territories: [
      {
        id: 'west',
        revision: 1,
        name: 'Westmark',
        layerId: 'politics',
        parentId: null,
        typeId: 'kingdom',
        rank: 5,
        color: '#556633',
        opacity: 0.15,
        border: 'solid',
        polygons: [],
      },
    ],
  };
  let revision = 1,
    read = async () => ({ ok: true, value: structuredClone(state) }),
    fail = false;
  const writes = [],
    errors = [];
  window.campaign = { atlasTerritories: () => read() };
  const work = new TerritoryWorkbench(document.querySelector('canvas'), {
    data: () => ({ revision }),
    enabled: () => true,
    point: () => ({ x: 0, y: 0 }),
    box: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    current: () => true,
    redraw() {},
    focus() {},
    error: (e) => errors.push(e.message),
    write: async (action) => {
      writes.push(action);
      if (fail) throw Error('Antwort fehlt');
      if (action.kind === 'territory-put') {
        state.territories = [{ ...structuredClone(action.territory), revision: ++revision }];
      }
      if (action.kind === 'territory-layer') {
        state.layers = state.layers.map((l) =>
          l.id === action.layer.id ? { ...structuredClone(action.layer), revision: ++revision } : l,
        );
      }
      return true;
    },
  });
  document.body.append(work.panel);
  work.sync('campaign');
  await settle();
  const field = (id) => document.getElementById('territory-' + id),
    edit = (id, value) => {
      field(id).value = value;
      field(id).dispatchEvent(new window.Event('input', { bubbles: true }));
    };
  field('region').value = 'west';
  field('region').onchange();
  return {
    work,
    state,
    writes,
    errors,
    field,
    edit,
    async click(id) {
      field(id).click();
      await settle();
    },
    setRead(fn) {
      read = fn;
    },
    fail() {
      fail = true;
    },
    restore() {
      Object.assign(global, old);
    },
  };
}
test('independent region and layer property drafts survive saving the other form in either order', async () => {
  const f = await fixture();
  try {
    f.edit('name', 'Westmark Nord');
    f.edit('layer-name', 'Reiche');
    await f.click('layer-save');
    assert.equal(f.state.layers.find((l) => l.id === 'politics').name, 'Reiche');
    assert.equal(f.state.territories[0].name, 'Westmark');
    assert.equal(f.field('name').value, 'Westmark Nord');
    assert(f.work.hasDraft());
    assert.equal(f.field('cancel').hidden, false);
    await f.click('save');
    assert.equal(f.state.territories[0].name, 'Westmark Nord');
    assert.equal(f.work.hasDraft(), false);
    f.edit('name', 'Westmark Süd');
    f.edit('types', 'absichtlich unvollständig');
    await f.click('save');
    assert.equal(f.field('types').value, 'absichtlich unvollständig');
    assert.equal(f.state.territories[0].name, 'Westmark Süd');
    assert(f.work.hasDraft());
    await f.click('layer-save');
    assert.match(f.errors.at(-1), /Name = Rang/);
    assert.equal(f.field('types').value, 'absichtlich unvollständig');
    await f.click('cancel');
    assert.equal(f.work.hasDraft(), false);
    assert.notEqual(f.field('types').value, 'absichtlich unvollständig');
  } finally {
    f.restore();
  }
});
test('edits typed during a read survive canonical refresh and keep selection pinned', async () => {
  const f = await fixture();
  try {
    let resolve;
    f.setRead(() => new Promise((r) => (resolve = r)));
    const loading = f.work.load();
    f.edit('name', 'Noch offen');
    f.edit('layer-order', '7');
    resolve({ ok: true, value: structuredClone(f.state) });
    await loading;
    assert.equal(f.field('name').value, 'Noch offen');
    assert.equal(f.field('layer-order').value, '7');
    f.field('region').value = '';
    f.field('region').onchange();
    assert.equal(f.field('region').value, 'west');
    await f.click('label-auto');
    await f.click('new');
    await f.click('layer-new');
    assert.equal(f.writes.length, 0);
    assert.equal(f.field('name').value, 'Noch offen');
  } finally {
    f.restore();
  }
});
test('an unresolved write cannot be replaced by saving the other form', async () => {
  const f = await fixture();
  try {
    f.edit('name', 'Offene Antwort');
    f.edit('layer-name', 'Offene Ebene');
    f.fail();
    await f.click('save');
    assert.equal(f.writes.length, 1);
    assert.equal(f.field('retry').hidden, false);
    await f.click('layer-save');
    assert.equal(f.writes.length, 1);
    assert.match(f.errors.at(-1), /Schreibentwurf/);
    assert.equal(f.field('name').value, 'Offene Antwort');
    assert.equal(f.field('layer-name').value, 'Offene Ebene');
  } finally {
    f.restore();
  }
});
