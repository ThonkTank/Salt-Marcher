import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';

buildSync({
  entryPoints: ['src/app/atlas/atlas-canvas.ts'],
  outfile: '.build/atlas-canvas-gesture.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { AtlasCanvas } = createRequire(import.meta.url)('../../.build/atlas-canvas-gesture.cjs');

test('selection clicks leave terrain focus untouched; real drags own exactly one navigation gesture', (t) => {
  const { document, window } = parseHTML('<main><canvas id="map"></canvas></main>');
  const root = document.querySelector('canvas'),
    calls = [];
  const saved = new Map();
  for (const [key, value] of Object.entries({
    DOMPoint: class {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
      matrixTransform() {
        return this;
      }
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  })) {
    saved.set(key, global[key]);
    global[key] = value;
  }
  const methods = new Map();
  for (const [key, value] of Object.entries({
    apply() {},
    acquireContext() {},
    screenMatrix() {
      return { inverse: () => ({}) };
    },
    screenStart() {
      return { x: 10, y: 10 };
    },
  })) {
    methods.set(key, AtlasCanvas.prototype[key]);
    AtlasCanvas.prototype[key] = value;
  }
  const ready = Object.getOwnPropertyDescriptor(AtlasCanvas.prototype, 'ready');
  Object.defineProperty(AtlasCanvas.prototype, 'ready', { configurable: true, get: () => true });
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
    for (const [key, value] of methods) AtlasCanvas.prototype[key] = value;
    Object.defineProperty(AtlasCanvas.prototype, 'ready', ready);
  });
  let captured = false;
  root.focus = () => {};
  root.setPointerCapture = () => {
    captured = true;
  };
  root.hasPointerCapture = () => captured;
  root.releasePointerCapture = () => {
    captured = false;
  };
  const camera = new AtlasCanvas(root, {
    initial: { x: 0, y: 0, width: 100, height: 100 },
    pan: () => true,
    presentation: () => ({
      navigationPoint: (e) => ({ x: e.clientX, y: e.clientY }),
      navigationGesture: (active) => calls.push(active),
    }),
  });
  camera.set = () => {};
  let clicks = 0;
  root.addEventListener('click', () => clicks++);
  const emit = (name, x = 10, y = 10) => {
    const event = new window.Event(name, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: y });
    root.dispatchEvent(event);
  };
  emit('pointerdown');
  emit('pointerup');
  emit('click');
  assert.deepEqual(calls, [], 'a click cannot trigger terrain refocusing before selection');
  assert.equal(clicks, 1);
  emit('pointerdown');
  emit('pointermove', 11, 11);
  emit('pointerup', 11, 11);
  emit('click', 11, 11);
  assert.deepEqual(calls, [], 'sub-threshold motion remains a selection click');
  assert.equal(clicks, 2);
  emit('pointerdown');
  emit('pointermove', 20, 20);
  emit('pointermove', 30, 30);
  emit('pointerup', 30, 30);
  emit('click', 30, 30);
  assert.deepEqual(calls, [true, false]);
  assert.equal(clicks, 2, 'drag completion consumes its synthetic click');
});
