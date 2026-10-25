import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from './helpers/dom.mjs';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/passive-map-canvas.ts'],
  outfile: '.build/passive-map-canvas.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { PassiveMapCanvas } = createRequire(import.meta.url)('../.build/passive-map-canvas.cjs');
class Matrix {
  constructor(a = 1, d = 1, e = 0, f = 0) {
    Object.assign(this, { a, d, e, f });
  }
  inverse() {
    return new Matrix(1 / this.a, 1 / this.d, -this.e / this.a, -this.f / this.d);
  }
}
class Point {
  constructor(x, y) {
    Object.assign(this, { x, y });
  }
  matrixTransform(m) {
    return new Point(this.x * m.a + m.e, this.y * m.d + m.f);
  }
}
function fixture(pan) {
  const dom = { window: parseHTML('<html><body><svg id="scene"></svg></body></html>').window };
  dom.window.MouseEvent = class extends dom.window.Event {
    constructor(type, init = {}) {
      super(type, init);
      Object.assign(this, init);
    }
  };
  const root = dom.window.document.querySelector('svg'),
    changes = [];
  global.DOMPoint = Point;
  let captured = null;
  root.getScreenCTM = () => new Matrix(1, 1);
  root.setPointerCapture = (id) => (captured = id);
  root.hasPointerCapture = (id) => captured === id;
  root.releasePointerCapture = (id) => {
    if (id === captured) captured = null;
  };
  const canvas = new PassiveMapCanvas(root, {
    initial: { x: -100, y: -50, width: 1000, height: 500 },
    pan,
    changed: (b, why) => changes.push({ b, why }),
  });
  const pointer = (type, x, y, button = 1) => {
    const e = new dom.window.MouseEvent(type, {
      clientX: x,
      clientY: y,
      button,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    root.dispatchEvent(e);
  };
  return { dom, root, canvas, changes, pointer };
}

test('one passive scene handles square/hex hits, anchored zoom, middle pan and stable redraw/layout', () => {
  const { dom, root, canvas, changes, pointer } = fixture(),
    model = { hex: 'A', square: 'B' },
    before = JSON.stringify(model);
  let chosen = '';
  const draw = (scene) => {
    for (const tag of ['rect', 'polygon']) {
      const item = dom.window.document.createElementNS(root.namespaceURI, tag);
      item.addEventListener('click', () => (chosen = tag));
      scene.append(item);
    }
  };
  canvas.context('map-a', canvas.view);
  canvas.render(draw);
  root
    .querySelector('polygon')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(chosen, 'polygon');
  const anchor = { x: 250, y: 150 },
    prior = canvas.view,
    ratio = (anchor.x - prior.x) / prior.width;
  canvas.zoom(0.5, anchor);
  assert.equal((anchor.x - canvas.view.x) / canvas.view.width, ratio);
  const zoomed = canvas.view;
  canvas.render(draw);
  assert.deepEqual(canvas.view, zoomed);
  pointer('pointerdown', 10, 20);
  pointer('pointermove', 40, 60);
  pointer('pointerup', 40, 60);
  assert.equal(canvas.view.x, zoomed.x - 30);
  assert.equal(canvas.view.y, zoomed.y - 40);
  assert.equal(changes.filter((c) => c.why === 'pan').length, 1);
  const generated = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  root.dispatchEvent(generated);
  assert.equal(
    generated.defaultPrevented,
    true,
    'pan completion is suppressed at the passive surface',
  );
  pointer('pointerdown', 0, 0, 0);
  const nextPress = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  root.dispatchEvent(nextPress);
  assert.equal(
    nextPress.defaultPrevented,
    false,
    'the next real pointer press is not a suppressed drag click',
  );
  root.querySelector('rect').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(chosen, 'rect');
  const box = root.getAttribute('viewBox');
  root.style.width = '300px';
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  canvas.render(draw);
  assert.equal(root.getAttribute('viewBox'), box);
  assert.equal(JSON.stringify(model), before);
  assert.equal(canvas.context('map-a', { x: 0, y: 0, width: 10, height: 10 }), false);
  assert.equal(root.getAttribute('viewBox'), box);
  canvas.reset();
  assert.deepEqual(canvas.view, prior);
});

test('failed partial rendering disables stale hits, keeps camera/model and retries one fresh scene', () => {
  const { dom, root, canvas, pointer, changes } = fixture();
  let attempt = 0,
    hits = 0,
    broken = false;
  const draw = (scene) => {
    attempt++;
    const item = dom.window.document.createElementNS(root.namespaceURI, 'rect');
    item.addEventListener('click', () => hits++);
    scene.append(item);
    if (broken) throw new Error('Gezielter Zeichenfehler');
  };
  canvas.render(draw);
  const old = root.firstChild,
    box = canvas.view;
  broken = true;
  canvas.render(draw);
  assert.equal(root.dataset.canvasState, 'unavailable');
  assert.equal(
    root.childNodes.length,
    0,
    'failed scenes retain no hidden stale or partial geometry',
  );
  assert.equal(old.isConnected, false);
  const stale = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  root.dispatchEvent(stale);
  assert.equal(stale.defaultPrevented, true);
  assert.equal(hits, 0);
  canvas.render(draw);
  assert.equal(attempt, 2, 'no automatic retry loop');
  assert.deepEqual(canvas.view, box);
  broken = false;
  dom.window.document.querySelector('.map-canvas-state button').click();
  assert.equal(attempt, 3);
  assert.notEqual(root.firstChild, old);
  assert.equal(root.dataset.canvasState, 'loaded');
  assert.equal(root.style.visibility, '');
  root.querySelector('rect').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(hits, 1);
  pointer('pointerdown', 0, 0);
  pointer('pointermove', 10, 0);
  pointer('pointerup', 10, 0);
  assert.equal(changes.length, 1, 'retry must not duplicate pointer handlers');
  canvas.render(() => {}, 'Keine Karte.');
  assert.equal(root.querySelector('[data-map-scene]').childNodes.length, 0);
  assert.equal(root.dataset.canvasState, 'empty');
  assert.equal(dom.window.document.querySelector('.map-canvas-state').hidden, false);
  assert.equal(dom.window.document.querySelector('.map-canvas-state button').hidden, true);
});

test('camera history groups an entire pointer drag and restores independent cached viewport contexts', () => {
  const { root, canvas, pointer } = fixture(),
    initial = canvas.view;
  canvas.context('square', initial);
  canvas.zoom(0.5);
  const square = canvas.view;
  pointer('pointerdown', 0, 0);
  pointer('pointermove', 10, 0);
  pointer('pointermove', 20, 0);
  pointer('pointermove', 30, 0);
  pointer('pointerup', 30, 0);
  const dragged = canvas.view;
  assert.notDeepEqual(dragged, square);
  canvas.previous();
  assert.deepEqual(canvas.view, square);
  canvas.previous();
  assert.deepEqual(canvas.view, initial);
  canvas.next();
  assert.deepEqual(canvas.view, square);
  canvas.next();
  assert.deepEqual(canvas.view, dragged);
  canvas.context('hex', { x: 500, y: 500, width: 200, height: 200 });
  canvas.pan(50, 20);
  const hex = canvas.view;
  assert.equal(canvas.context('square', initial), true);
  assert.equal(canvas.contextRestored, true);
  assert.deepEqual(canvas.view, dragged);
  canvas.previous();
  assert.deepEqual(canvas.view, square);
  canvas.context('hex', initial);
  assert.deepEqual(canvas.view, hex);
  canvas.reset();
  assert.deepEqual(canvas.view, { x: 500, y: 500, width: 200, height: 200 });
  assert.equal(root.getAttribute('viewBox'), '500 500 200 200');
});
test('only a complete current scene is published and passive hits return its DOM elements', () => {
  const { dom, root, canvas } = fixture();
  let hit = null;
  dom.window.document.elementFromPoint = () => hit;
  canvas.render((scene) => {
    const rect = dom.window.document.createElementNS(root.namespaceURI, 'rect');
    rect.id = 'old';
    scene.append(rect);
    assert.equal(root.querySelector('#old'), null);
  });
  hit = root.querySelector('#old');
  assert.equal(canvas.hit(0, 0), hit);
  const old = hit;
  canvas.render((scene) => {
    assert.equal(root.querySelector('#old'), old);
    const marker = dom.window.document.createElementNS(root.namespaceURI, 'circle');
    scene.append(marker);
    assert.equal(marker.isConnected, false);
  });
  assert.equal(old.isConnected, false);
  assert.equal(canvas.hit(0, 0), null);
  hit = root.querySelector('circle');
  assert.equal(canvas.hit(0, 0), hit);
  assert.equal(root.children.length, 1);
  assert.equal(root.firstChild.dataset.mapScene, 'true');
  canvas.render(() => {
    throw Error('fail');
  });
  assert.equal(canvas.hit(0, 0), null);
});

for (const action of ['pan', 'zoom', 'reset', 'drag'])
  test(`wheel zoom history starts a new gesture after ${action}`, (t) => {
    const { dom, root, canvas, pointer } = fixture(),
      initial = canvas.view,
      now = Date.now;
    let time = 1000;
    Date.now = () => time;
    t.after(() => (Date.now = now));
    const wheel = () => {
      root.dispatchEvent(
        new dom.window.MouseEvent('wheel', {
          deltaY: -1,
          clientX: 150,
          clientY: 100,
          bubbles: true,
          cancelable: true,
        }),
      );
      time += 50;
    };
    wheel();
    wheel();
    const firstZoom = canvas.view;
    if (action === 'pan') canvas.pan(30, 20);
    else if (action === 'zoom') canvas.zoom(0.8);
    else if (action === 'reset') canvas.reset();
    else {
      pointer('pointerdown', 0, 0);
      pointer('pointermove', 30, 20);
      pointer('pointerup', 30, 20);
    }
    const intervening = canvas.view;
    wheel();
    wheel();
    assert.notDeepEqual(canvas.view, intervening);
    canvas.previous();
    assert.deepEqual(
      canvas.view,
      intervening,
      'previous view must undo only the latest wheel gesture',
    );
    canvas.previous();
    assert.deepEqual(
      canvas.view,
      firstZoom,
      'the separate camera action retains its own history step',
    );
    canvas.previous();
    assert.deepEqual(canvas.view, initial, 'the first wheel burst remains one step');
    canvas.next();
    assert.deepEqual(canvas.view, firstZoom);
  });

test('leaving before an uncaptured pan starts releases the camera, while captured dragging continues outside', () => {
  const { dom, root, canvas, pointer } = fixture((e) => e.button === 0 || e.button === 1),
    initial = canvas.view;
  pointer('pointerdown', 1, 100, 0);
  assert.equal(canvas.panning, true);
  assert.equal(root.hasPointerCapture(1), false);
  pointer('pointerleave', -1, 100, 0);
  assert.equal(canvas.panning, false);
  assert.deepEqual(canvas.view, initial);
  // No pointerup arrives at the canvas for this uncaptured outside release.
  pointer('pointermove', 100, 100, 0);
  assert.deepEqual(canvas.view, initial, 'hovering back must not pan without a pressed button');
  root.dispatchEvent(
    new dom.window.MouseEvent('wheel', {
      deltaY: -1,
      clientX: 150,
      clientY: 100,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.ok(canvas.view.width < initial.width);
  canvas.previous();
  assert.deepEqual(canvas.view, initial);
  pointer('pointerdown', 1, 100, 1);
  assert.equal(root.hasPointerCapture(1), true);
  pointer('pointerleave', -1, 100, 1);
  assert.equal(canvas.panning, true, 'captured drags still cross the canvas boundary');
  pointer('pointermove', -10, 100, 1);
  pointer('pointerup', -10, 100, 1);
  assert.equal(canvas.panning, false);
  assert.equal(canvas.view.x, initial.x + 11);
  canvas.previous();
  assert.deepEqual(canvas.view, initial);
});

test('relative Atlas camera transforms the existing scene and native hit nodes, with a stationary HUD', () => {
  const { window } = parseHTML('<html><body><svg id="map"></svg></body></html>'),
    root = window.document.querySelector('svg');
  const canvas = new PassiveMapCanvas(root, {
    relative: true,
    initial: { x: 100, y: 200, width: 400, height: 200 },
  });
  let builds = 0;
  const draw = (scene) => {
    builds++;
    scene.innerHTML = '<rect data-object="a"/><g data-canvas-hud="true"><text>Scale</text></g>';
  };
  canvas.render(draw);
  const scene = root.firstChild,
    object = root.querySelector('rect');
  canvas.pan(30, -10);
  assert.equal(root.firstChild, scene);
  assert.equal(root.querySelector('rect'), object);
  assert.equal(builds, 1);
  assert.equal(scene.getAttribute('transform'), 'translate(-30 10)');
  assert.equal(
    root.querySelector('[data-canvas-hud]').getAttribute('transform'),
    'translate(30 -10)',
  );
  assert.equal(root.getAttribute('viewBox'), '0 0 400 200');
  window.document.elementFromPoint = () => object;
  assert.equal(canvas.hit(0, 0), object);
  canvas.zoom(0.5);
  assert.equal(builds, 1);
  canvas.render(draw);
  assert.equal(builds, 2);
  assert.notEqual(root.firstChild, scene);
  assert.equal(root.firstChild.getAttribute('transform'), 'translate(0 0)');
});

// The workbench retains controls, but its former map is no longer a renderer.
test('retired SVG host neither rebuilds geometry nor exposes its previous hits', () => {
  const { dom, root, canvas } = fixture();
  let builds = 0;
  const draw = (scene) => {
    builds++;
    scene.innerHTML = '<path/>';
  };
  canvas.render(draw);
  const old = root.querySelector('path');
  dom.window.document.elementFromPoint = () => old;
  assert.equal(canvas.hit(0, 0), old);
  root.dataset.sharedAtlas = 'true';
  canvas.render(draw);
  canvas.pan(20, 0);
  canvas.render(draw);
  assert.equal(builds, 1);
  assert.equal(root.children.length, 0);
  assert.equal(canvas.hit(0, 0), null);
});
