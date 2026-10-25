import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  stdin: {
    contents:
      "export * from './src/app/atlas/atlas-brush-size';export * from './src/app/atlas/landscape-tool-settings';export * from './src/app/atlas/atlas-units';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-brush-size.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  BrushSizes,
  BrushSizeControl,
  LandscapeToolSettings,
  HEIGHT_PRESETS,
  initAtlasUnits,
  setAtlasUnits,
  atlasFieldValue,
} = createRequire(import.meta.url)('../../.build/atlas-brush-size.cjs');

test('all brush families retain a CSS-pixel radius across zoom, and fixed mode retains world geometry', () => {
  for (const key of [
    'height',
    'smooth',
    'color',
    'freshwater',
    'property',
    'reset',
    'territory',
    'vegetation',
    'vegetation-clear',
    'vegetation-thin',
    'vegetation-dense',
    'room-cave',
    'room-erase',
    'scatter',
  ]) {
    const m = new BrushSizes();
    for (const scale of [0.002, 1, 1000]) {
      const s = m.size(key, scale);
      assert.equal(s.world / scale, 48);
    }
    m.set(key, 1000, 75);
    const before = m.size(key, 1000).world;
    m.setMode('world');
    assert.equal(m.size(key, 1000).world, before);
    assert.equal(m.size(key, 2).world, before);
    m.setMode('screen');
    assert.equal(m.size(key, 2).world, before);
    assert.equal(m.size(key, 1).world, before / 2);
  }
});
test('mode, per-tool sizes, presets and invalid preferences remain independent of campaign storage', () => {
  const m = new BrushSizes();
  m.set('height', 5, 80);
  m.set('smooth', 2, 20);
  m.setMode('world');
  m.preset('height', 5, 65);
  assert.equal(m.size('height', 1).world, 325);
  assert.equal(m.size('smooth', 1).world, 40);
  const restored = new BrushSizes(m.serialize());
  assert.equal(restored.mode, 'world');
  assert.equal(restored.size('height', 2).world, 325);
  for (const invalid of [
    'bad',
    'null',
    '{"version":1,"sizes":{"height":null,"smooth":{"screen":-1}}}',
  ]) {
    assert.equal(new BrushSizes(invalid).size('height', 1).world, 48);
  }
});
test('actual controls keep slider, typed units, locked drafts and preset parameters in agreement', (t) => {
  const { document, window } = parseHTML(
    '<html><body><main><label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label></main></body></html>',
  );
  const old = { document: global.document, Event: global.Event };
  global.document = document;
  global.Event = window.Event;
  t.after(() => Object.assign(global, old));
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() {
      return this.getAttribute('data-value') ?? this.querySelector('option')?.value ?? '';
    },
    set(v) {
      this.setAttribute('data-value', v);
    },
  });
  const panel = document.querySelector('main'),
    f = (id) => document.getElementById(id),
    settings = new LandscapeToolSettings(panel, () => {});
  initAtlasUnits(document);
  const control = new BrushSizeControl(f('land-radius'), () => {});
  t.after(() => control.dispose());
  settings.show('height');
  control.sync('dom-height', 10, false);
  assert.equal(Number(atlasFieldValue(f('land-radius'))), 480);
  assert.equal(
    f('land-height-direction').nextElementSibling.querySelector('input').id,
    'land-height-strength-slider',
  );
  assert.equal(f('land-height-strength').closest('label').nextElementSibling, control.root);
  f('land-height-strength-slider').value = '3';
  f('land-height-strength-slider').dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(settings.height().strength, 1000);
  for (const [i, p] of HEIGHT_PRESETS.entries()) {
    f('land-height-target-enabled').checked = true;
    f('land-height-preset').value = String(i);
    f('land-height-preset').dispatchEvent(new Event('input', { bubbles: true }));
    f('land-height-preset').dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(settings.height(), {
      mode: p.direction,
      strength: p.strength,
      feather: p.feather,
      roughness: p.roughness,
    });
    assert.equal(Number(atlasFieldValue(f('land-radius'))), p.radius * 10);
  }
  f('land-radius-fixed').checked = true;
  f('land-radius-fixed').dispatchEvent(new Event('change'));
  assert.equal(Number(atlasFieldValue(f('land-radius'))), 200);
  setAtlasUnits('metric');
  control.sync('dom-height', 2, false);
  assert.equal(f('land-radius-value').value, '200');
  f('land-radius-value').value = '123';
  f('land-radius-value').dispatchEvent(new Event('change'));
  assert.equal(Number(atlasFieldValue(f('land-radius'))), 123);
  assert.equal(f('land-height-preset').value, '');
  setAtlasUnits('dnd');
  control.sync('dom-height', 2, false);
  assert(Math.abs(Number(f('land-radius-value').value) * 0.3048 - 123) < 0.002);
  assert.equal(Number(atlasFieldValue(f('land-radius'))), 123);
  control.sync('dom-height', 2, true);
  f('land-radius-value').value = '20';
  f('land-radius-value').dispatchEvent(new Event('change'));
  control.sync('dom-height', 99, true);
  assert.equal(Number(atlasFieldValue(f('land-radius'))), 123);
  assert(f('land-radius-value').disabled);
  control.sync('dom-height', 2, false);
  assert(!f('land-radius-value').disabled);
});

test('Shift wheel sizes the active brush in either mode, normalizes devices and preserves locked drafts', (t) => {
  const { document, window } = parseHTML(
    '<html><body><label>Radius<input id="wheel-radius"></label></body></html>',
  );
  const old = { document: global.document, Event: global.Event, localStorage: global.localStorage };
  let saved,
    changes = 0,
    manual = 0;
  Object.assign(global, {
    document,
    Event: window.Event,
    localStorage: { setItem: (_key, value) => (saved = value) },
  });
  t.after(() => Object.assign(global, old));
  const field = document.getElementById('wheel-radius'),
    control = new BrushSizeControl(field, () => changes++);
  t.after(() => control.dispose());
  initAtlasUnits(document);
  setAtlasUnits('metric');
  control.sync('wheel-height', 10, false);
  const fixed = document.getElementById('wheel-radius-fixed');
  fixed.checked = false;
  fixed.dispatchEvent(new Event('change'));
  field.addEventListener('brush-size-change', () => manual++);
  const wheel = (deltaY, deltaMode = 0, shiftKey = true, deltaX = 0) => {
    const event = Object.assign(new Event('wheel', { cancelable: true }), {
      deltaY,
      deltaX,
      deltaMode,
      shiftKey,
    });
    const handled = control.wheel(event, 800);
    assert.equal(event.defaultPrevented, handled);
    return handled;
  };
  control.preset(48);
  assert.equal(wheel(-80, 0, false), false);
  assert.equal(Number(atlasFieldValue(field)), 480);
  for (const [delta, mode] of [
    [-80, 0],
    [-5, 1],
    [-0.1, 2],
  ]) {
    control.preset(48);
    wheel(delta, mode);
    assert(Math.abs(Number(atlasFieldValue(field)) - 480 * Math.exp(0.16)) < 1e-9);
  }
  control.preset(48);
  wheel(0, 0, true, -80);
  assert.equal(
    new BrushSizes(saved).size('wheel-height', 10).world,
    Number(atlasFieldValue(field)),
  );
  wheel(80);
  assert(Math.abs(Number(atlasFieldValue(field)) - 480) < 1e-9);
  control.preset(199);
  wheel(-800);
  assert.equal(Number(atlasFieldValue(field)), 2000);
  control.preset(4);
  wheel(800);
  assert.equal(Number(atlasFieldValue(field)), 40);
  control.preset(48);
  fixed.checked = true;
  fixed.dispatchEvent(new Event('change'));
  setAtlasUnits('dnd');
  wheel(-80);
  const world = Number(atlasFieldValue(field));
  assert(Math.abs(world - 480 * Math.exp(0.16)) < 1e-9);
  control.sync('wheel-height', 20, false);
  assert.equal(Number(atlasFieldValue(field)), world);
  control.sync('wheel-other', 20, false);
  wheel(-80);
  control.sync('wheel-height', 20, false);
  assert.equal(Number(atlasFieldValue(field)), world);
  control.sync('wheel-height', 20, true);
  const counts = [changes, manual];
  wheel(-80);
  assert.equal(Number(atlasFieldValue(field)), world);
  assert.deepEqual([changes, manual], counts);
  control.sync('wheel-height', 20, false);
  wheel(80);
  assert(Math.abs(Number(atlasFieldValue(field)) - 480) < 1e-9);
  assert(manual > 0);
});

test('camera synchronization retains caption nodes while real unit changes update their text', (t) => {
  const { document, window } = parseHTML(
    '<html><body><label>Radius<input id="stable-radius" value="500"></label></body></html>',
  );
  const old = { document: global.document, Event: global.Event };
  global.document = document;
  global.Event = window.Event;
  t.after(() => Object.assign(global, old));
  initAtlasUnits(document);
  setAtlasUnits('metric');
  const control = new BrushSizeControl(document.getElementById('stable-radius'), () => {});
  t.after(() => control.dispose());
  control.sync('stable-caption', 10, false);
  const caption = control.root.firstChild,
    unit = caption.querySelector('small'),
    text = caption.firstChild;
  for (const scale of [10, 20, 2, 5000, 5000]) {
    control.sync('stable-caption', scale, false);
    assert.equal(control.root.firstChild, caption);
    assert.equal(caption.firstChild, text);
    assert.equal(caption.querySelector('small'), unit);
  }
  const fixed = document.getElementById('stable-radius-fixed');
  fixed.checked = true;
  fixed.dispatchEvent(new Event('change'));
  assert.equal(unit.textContent, 'm');
  setAtlasUnits('dnd');
  control.sync('stable-caption', 5000, false);
  assert.equal(unit.textContent, 'ft');
  assert.equal(caption.querySelector('small'), unit);
  fixed.checked = false;
  fixed.dispatchEvent(new Event('change'));
  assert.equal(unit.textContent, 'px');
});
