import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { atlasFixture } from './helpers/atlas-workbench.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/drawing-ui';export {newElement} from './src/app/drawing-model';export {CampaignAtlasWorkbench} from './src/app/campaign-atlas-ui';export {AtlasPaint} from './src/app/atlas-paint';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/drawing-draft-lifecycle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const require = createRequire(import.meta.url),
  file = require.resolve('../.build/drawing-draft-lifecycle.cjs');
async function fixture(t) {
  const { window, document } = parseHTML(readFileSync('src/app/index.html', 'utf8')),
    previous = {
      window: global.window,
      document: global.document,
      Event: global.Event,
      CustomEvent: global.CustomEvent,
    };
  Object.assign(global, { window, document, Event: window.Event, CustomEvent: window.CustomEvent });
  t.after(() => Object.assign(global, previous));
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.getAttribute('data-value') ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      this.setAttribute('data-value', v);
    },
  });
  delete require.cache[file];
  const drawing = require(file),
    errors = [];
  let owner = {
      token: 'original',
      campaign: { id: 'campaign' },
      floors: [{ id: 'ground', scopeId: 'local' }],
      rooms: [],
    },
    selected = null,
    prepare = async () => true;
  window.campaign = new Proxy(
    {},
    {
      get() {
        throw Error('Drafts must not write or load data');
      },
    },
  );
  drawing.initDrawing(
    (s, error) => {
      if (error) errors.push(s);
    },
    () => owner,
    () => selected,
    () => prepare(),
    async () => {},
    () => {},
  );
  await drawing.activateDrawing(owner, false);
  document.querySelector('#floors').value = JSON.stringify(['local', 'ground']);
  document.querySelector('#drawing-tool').value = 'room-cave';
  document.querySelector('#drawing-brush').value = '1';
  document.querySelector('#drawing-snap').checked = false;
  const ui = Object.assign(atlasFixture(drawing.CampaignAtlasWorkbench), {
    scopeId: 'local',
    brushQueue: Promise.resolve(),
    frame: () => ({ x: 0, y: 0, angle: 0 }),
    render() {},
    error: (e) => errors.push(e),
  });
  return {
    ...drawing,
    ui,
    document,
    window,
    errors,
    owner: () => owner,
    select(room) {
      selected = room;
      owner.rooms = [room];
      owner.selectedId = room.id;
    },
    hold() {
      let release;
      const task = new Promise((r) => (release = r));
      prepare = () => task;
      return () => release(true);
    },
    switchOwner: async () => {
      owner = { ...owner, token: 'next' };
      await drawing.activateDrawing(owner, false);
    },
  };
}
const emptyDrawing = () => ({
  coverage: 'selected',
  elements: [],
  styles: [],
  volumes: [],
  features: [],
  hiddenRooms: [],
  hiddenFloors: [],
});
test('a loaded path remains selectable from its exact record when unrelated room extras cannot be read', async (t) => {
  const f = await fixture(t),
    source = {
      ...f.newElement('path', 'local', 'ground', null, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      name: 'Zugang',
      notes: '  Erhaltene Notiz\r\n',
    };
  f.document.getElementById('drawing-tool').value = 'select';
  f.window.campaign = { drawingMap: async () => ({ ok: true, value: emptyDrawing() }) };
  await f.reloadDrawing();
  let extraReads = 0;
  f.window.campaign = {
    drawingElement: async () => ({ ok: true, value: source }),
    drawingMap: async () => {
      extraReads++;
      return { ok: false, error: 'Raumstil nicht lesbar' };
    },
  };
  await f.selectElement(source.id);
  assert.equal(extraReads, 0);
  assert.equal(f.selectedDrawingElementId(), source.id);
  assert.deepEqual(f.atlasDrawingDraft().element, source);
  assert.equal(f.document.getElementById('drawing-element-notes').value, source.notes);
  assert.equal(f.document.getElementById('drawing-element-points').value, '0, 0\n10, 0');
});
test('first selection initializes the drawing basis and feature selections still refresh their runtime facts', async (t) => {
  const f = await fixture(t),
    path = f.newElement('path', 'local', 'ground', null, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]),
    feature = {
      ...f.newElement('feature', 'local', 'ground', null, [{ x: 1, y: 1 }]),
      maxCharges: 3,
    };
  let source = path,
    reads = 0;
  f.window.campaign = {
    drawingElement: async () => ({ ok: true, value: source }),
    drawingMap: async () => {
      reads++;
      return {
        ok: true,
        value: {
          ...emptyDrawing(),
          features:
            source === feature ? [{ id: feature.id, charges: 2, resetStartedMs: null }] : [],
        },
      };
    },
  };
  await f.selectElement(path.id);
  assert.equal(reads, 1);
  assert.equal(f.selectedDrawingElementId(), path.id);
  source = feature;
  await f.selectElement(feature.id);
  assert.equal(reads, 2);
  assert.match(f.document.getElementById('drawing-feature-status').textContent, /2\/3 Charges/);
  f.window.campaign.drawingMap = async () => ({ ok: false, error: 'Featurestand nicht lesbar' });
  await assert.rejects(f.selectElement(feature.id), /Featurestand/);
  assert.equal(f.selectedDrawingElementId(), null);
  assert.equal(f.document.getElementById('drawing-element-form').hasAttribute('hidden'), true);
});
test('a delayed feature supplement cannot restore an element after a campaign switch', async (t) => {
  const f = await fixture(t),
    feature = f.newElement('feature', 'local', 'ground', null, [{ x: 1, y: 1 }]);
  let release;
  f.window.campaign = {
    drawingElement: async () => ({ ok: true, value: feature }),
    drawingMap: () => new Promise((r) => (release = r)),
  };
  const task = f.selectElement(feature.id);
  await new Promise((r) => setImmediate(r));
  await f.switchOwner();
  release({ ok: true, value: { ...emptyDrawing(), features: [{ id: feature.id, charges: 1 }] } });
  await task;
  assert.equal(f.selectedDrawingElementId(), null);
  assert.equal(f.document.getElementById('drawing-element-form').hasAttribute('hidden'), true);
});
for (const change of ['cancel', 'tool', 'owner'])
  test('queued brush points cannot recreate a draft after ' + change, async (t) => {
    const f = await fixture(t),
      release = f.hold();
    f.ui.queueBrush({ x: -5, y: -5 });
    f.ui.queueBrush({ x: 0, y: 0 });
    f.ui.queueBrush({ x: 5, y: 5 });
    await new Promise((r) => setImmediate(r));
    if (change === 'cancel') f.document.querySelector('#drawing-cancel').click();
    if (change === 'tool') {
      const tool = f.document.querySelector('#drawing-tool');
      tool.value = 'room-polygon';
      tool.dispatchEvent(new f.window.Event('change'));
    }
    if (change === 'owner') await f.switchOwner();
    release();
    await f.ui.brushQueue;
    assert.deepEqual(
      f.atlasDrawingDraft().path,
      [],
      'Late preparation or queued points must not revive a revoked draft',
    );
    assert.equal(f.atlasDrawingDraft().polygons, null);
    assert.deepEqual(f.errors, []);
    await f.atlasDrawingPoint({ x: 20, y: 30 });
    assert.equal(
      f.atlasDrawingDraft().path.length,
      1,
      'Fresh input remains usable after cancellation',
    );
  });
test('an active brush retains ordered points and builds its real preview as numeric polygons', async (t) => {
  const f = await fixture(t);
  f.ui.queueBrush({ x: -3, y: 1 });
  f.ui.queueBrush({ x: 2, y: 1 });
  await f.ui.brushQueue;
  assert.deepEqual(f.atlasDrawingDraft().path, [
    { x: -3, y: 1 },
    { x: 2, y: 1 },
  ]);
  assert(f.atlasDrawingDraft().polygons.length);
  // Publish an empty detail layer without changing the open draft.
  f.window.campaign = {
    drawingMap: async () => ({
      ok: true,
      value: { elements: [], styles: [], features: [], hiddenRooms: [], hiddenFloors: [] },
    }),
  };
  await f.reloadDrawing();
  const scene = new f.AtlasPaint('group');
  f.drawingOverlay(scene);
  const area = scene.children.find((n) => n.style.fill === '#4f9da2');
  assert(area);
  assert.equal(area.kind, 'polygons');
  assert.deepEqual(area.geometry.polygons, f.atlasDrawingDraft().polygons);
  assert.equal(area.geometry.path, undefined);
});

const doorRoom = {
  id: 'wall-room',
  scopeId: 'local',
  floorId: 'ground',
  revision: 3,
  name: 'Wache',
  number: '1',
  polygons: [
    {
      outer: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      holes: [],
    },
  ],
};
function doorWrites(f) {
  const writes = [],
    view = { elements: [], styles: [], features: [], hiddenRooms: [], hiddenFloors: [] };
  f.document.getElementById('drawing-tool').value = 'door';
  f.window.campaign = {
    atlasDrawingCommit: async (c) => {
      writes.push(c);
      return { ok: true, value: { workspace: f.owner(), view, atlasRevision: writes.length } };
    },
    drawingMap: async () => ({ ok: true, value: view }),
  };
  return writes;
}
test('two direct door clicks create independent commands and wall anchors without a draft or repeated tool selection', async (t) => {
  const f = await fixture(t),
    writes = doorWrites(f),
    resolve = async () => ({ room: doorRoom, maxDistance: 0.5 });
  // Grid snapping must not move a clicked wall onto a different parallel wall.
  f.document.getElementById('drawing-snap').checked = true;
  f.document.getElementById('drawing-grid').value = '1.524';
  await f.atlasDrawingPoint({ x: 10.1, y: 4 }, undefined, resolve);
  await f.atlasDrawingPoint({ x: 6, y: 0.1 }, undefined, resolve);
  assert.equal(writes.length, 2);
  assert.notEqual(writes[0].commandId, writes[1].commandId);
  for (const c of writes) {
    assert.deepEqual(c.action.expectedRoom, { id: 'wall-room', revision: 3 });
    assert.equal(c.action.expectedRevision, null);
    assert.equal(c.action.element.roomId, 'wall-room');
  }
  assert.deepEqual(writes[0].action.element.points, [{ x: 10, y: 4 }]);
  assert.deepEqual(writes[1].action.element.points, [{ x: 6, y: 0 }]);
  assert.equal(f.document.getElementById('drawing-tool').value, 'door');
  assert.deepEqual(f.atlasDrawingDraft().path, []);
  assert.equal(await f.flushDrawing(), true);
  f.syncDrawingControls();
  assert.equal(f.document.getElementById('drawing-finish').hasAttribute('hidden'), true);
  assert.equal(f.document.getElementById('drawing-cancel').hasAttribute('hidden'), true);
  assert.equal(f.document.getElementById('drawing-snap').closest('label').hidden, true);
  f.document.getElementById('drawing-cancel').click();
  assert.equal(f.document.getElementById('drawing-tool').value, 'select');
  f.syncDrawingControls();
  assert.equal(f.document.getElementById('drawing-snap').closest('label').hidden, false);
});
for (const cancel of ['tool', 'owner'])
  test('a pending direct door read cannot write after ' + cancel + ' changes', async (t) => {
    const f = await fixture(t),
      writes = doorWrites(f);
    let release;
    const blocked = new Promise((r) => (release = r));
    const task = f.atlasDrawingPoint({ x: 10, y: 4 }, undefined, () => blocked);
    await new Promise((r) => setImmediate(r));
    if (cancel === 'owner') await f.switchOwner();
    else {
      const tool = f.document.getElementById('drawing-tool');
      tool.value = 'select';
      tool.dispatchEvent(new f.window.Event('change'));
    }
    release({ room: doorRoom, maxDistance: 0.5 });
    await task;
    assert.equal(writes.length, 0);
    assert.deepEqual(f.atlasDrawingDraft().path, []);
  });
test('door placement refuses another floor and distant points, and remains usable after failure', async (t) => {
  const f = await fixture(t),
    writes = doorWrites(f);
  await assert.rejects(
    f.atlasDrawingPoint({ x: 10, y: 4 }, undefined, async () => ({
      room: { ...doorRoom, floorId: 'upper' },
      maxDistance: 0.5,
    })),
    /Geschoss/,
  );
  await assert.rejects(
    f.atlasDrawingPoint({ x: 5, y: 5 }, undefined, async () => ({
      room: doorRoom,
      maxDistance: 0.5,
    })),
    /Raumwand/,
  );
  await f.atlasDrawingPoint({ x: 10, y: 4 }, undefined, async () => ({
    room: doorRoom,
    maxDistance: 0.5,
  }));
  assert.equal(writes.length, 1);
});

function rectangleWrites(f) {
  const writes = [],
    view = { elements: [], styles: [], features: [], hiddenRooms: [], hiddenFloors: [] };
  f.document.getElementById('drawing-tool').value = 'room-rectangle';
  f.document.getElementById('drawing-room-name').value = 'Torhalle';
  f.window.campaign = {
    atlasDrawingCommit: async (c) => {
      writes.push(c);
      return { ok: true, value: { workspace: f.owner(), view, atlasRevision: writes.length } };
    },
    drawingMap: async () => ({ ok: true, value: view }),
  };
  return writes;
}
test('Atlas rectangle drag uses the point-tool name, grid and single confirmed writer', async (t) => {
  const f = await fixture(t),
    writes = rectangleWrites(f);
  f.document.getElementById('drawing-snap').checked = true;
  f.document.getElementById('drawing-grid').value = '1.524';
  await f.atlasDrawingRectangle({ x: 1.1, y: 2.2 }, { x: 8.8, y: 10.1 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].action.kind, 'create-room');
  assert.equal(writes[0].action.name, 'Torhalle');
  assert.deepEqual(writes[0].action.polygons[0].outer, [
    { x: 1.524, y: 1.524 },
    { x: 9.144, y: 1.524 },
    { x: 9.144, y: 10.668 },
    { x: 1.524, y: 10.668 },
  ]);
  assert.deepEqual(f.atlasDrawingDraft().path, []);
  assert.equal(f.document.getElementById('drawing-tool').value, 'select');
});
test('Atlas rectangle append keeps the selected identity and existing contours instead of creating a room', async (t) => {
  const f = await fixture(t),
    writes = rectangleWrites(f),
    room = structuredClone(doorRoom);
  f.select(room);
  f.document.getElementById('drawing-append').checked = true;
  await f.atlasDrawingRectangle({ x: 10, y: 0 }, { x: 14, y: 10 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].action.kind, 'shape');
  assert.equal(writes[0].action.roomId, room.id);
  assert.equal(writes[0].action.expectedRevision, room.revision);
  assert.deepEqual(writes[0].action.polygons[0], room.polygons[0]);
  assert.equal(writes[0].action.polygons.length, 2);
  assert.deepEqual(room, doorRoom);
});
for (const mode of ['cancel', 'tool', 'owner', 'floor'])
  test('prepared Atlas rectangle is revoked by ' + mode, async (t) => {
    const f = await fixture(t),
      writes = rectangleWrites(f),
      release = f.hold(),
      task = f.atlasDrawingRectangle({ x: 0, y: 0 }, { x: 10, y: 10 });
    await new Promise((r) => setImmediate(r));
    if (mode === 'cancel') f.document.getElementById('drawing-cancel').click();
    if (mode === 'tool') {
      const tool = f.document.getElementById('drawing-tool');
      tool.value = 'room-polygon';
      tool.dispatchEvent(new f.window.Event('change'));
    }
    if (mode === 'owner') await f.switchOwner();
    if (mode === 'floor')
      f.document.getElementById('floors').value = JSON.stringify(['local', 'upper']);
    release();
    await task;
    assert.equal(writes.length, 0);
    assert.deepEqual(f.atlasDrawingDraft().path, []);
  });
test('a collapsed snapped rectangle writes nothing and leaves the next drag usable', async (t) => {
  const f = await fixture(t),
    writes = rectangleWrites(f);
  f.document.getElementById('drawing-snap').checked = true;
  f.document.getElementById('drawing-grid').value = '1.524';
  await assert.rejects(f.atlasDrawingRectangle({ x: 0, y: 0 }, { x: 0.1, y: 10 }), /Fläche/);
  assert.equal(writes.length, 0);
  assert.deepEqual(f.atlasDrawingDraft().path, []);
  await f.atlasDrawingRectangle({ x: 0, y: 0 }, { x: 10, y: 10 });
  assert.equal(writes.length, 1);
});

test('an unsuccessful rectangle commit clears only its adapter draft and remains retryable', async (t) => {
  const f = await fixture(t),
    writes = rectangleWrites(f),
    commit = f.window.campaign.atlasDrawingCommit;
  f.window.campaign.atlasDrawingCommit = async () => ({
    ok: false,
    error: 'Konturstand geändert.',
  });
  await assert.rejects(f.atlasDrawingRectangle({ x: 0, y: 0 }, { x: 10, y: 10 }), /Konturstand/);
  assert.deepEqual(f.atlasDrawingDraft().path, []);
  assert.equal(writes.length, 0);
  assert.equal(f.document.getElementById('drawing-room-name').value, 'Torhalle');
  f.window.campaign.atlasDrawingCommit = commit;
  await f.atlasDrawingRectangle({ x: 0, y: 0 }, { x: 10, y: 10 });
  assert.equal(writes.length, 1);
});
