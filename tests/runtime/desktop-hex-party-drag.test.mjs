import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/runtime/hex-party-drag.ts'],
  outfile: '.build/hex-party-drag.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { installHexPartyDrag } = createRequire(import.meta.url)('../../.build/hex-party-drag.cjs');
function fixture() {
  const { window, document } = parseHTML(
      '<html><body><svg><g><circle data-party-token="group" cx="0" cy="0" /></g></svg></body></html>',
    ),
    root = document.querySelector('svg'),
    token = document.querySelector('circle'),
    drops = [],
    messages = [];
  let key = 'campaign:scene:map:1',
    captured = false,
    allowed = true;
  root.setPointerCapture = () => (captured = true);
  root.hasPointerCapture = () => captured;
  root.releasePointerCapture = () => (captured = false);
  root.focus = () => {};
  const drag = installHexPartyDrag(root, {
    key: () => key,
    begin: () => allowed,
    target: (x, y) => (x >= 0 && x < 100 ? { hex: { q: Math.round(x / 10), r: 0 }, x, y } : null),
    drop: async (h, k) => drops.push({ h, k }),
    status: (s) => messages.push(s),
  });
  const event = (type, fields = {}, node = root) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      ...fields,
    });
    node.dispatchEvent(e);
  };
  return {
    root,
    token,
    drag,
    drops,
    messages,
    event,
    start: () => event('pointerdown', {}, token),
    stale: () => (key = 'other'),
    disable: () => (allowed = false),
  };
}
test('drag preview is transient and only release sends one snapped placement with the captured owner', async () => {
  const x = fixture();
  x.start();
  x.event('pointermove', { clientX: 20 });
  assert.equal(x.drops.length, 0);
  assert.equal(x.token.getAttribute('data-placement-draft'), 'valid');
  assert.equal(x.token.getAttribute('transform'), 'translate(20 0)');
  x.event('pointerup', { clientX: 20 });
  assert.deepEqual(x.drops, [{ h: { q: 2, r: 0 }, k: 'campaign:scene:map:1' }]);
  assert.equal(x.token.hasAttribute('transform'), false);
  assert.equal(x.drag.active, false);
  x.event('pointerup', { clientX: 20 });
  assert.equal(x.drops.length, 1);
});
test('Escape, invalid drop, pointer cancellation and owner change restore the committed token without placing', () => {
  for (const action of [
    (x) => x.event('keydown', { key: 'Escape' }),
    (x) => x.event('pointerup', { clientX: 150 }),
    (x) => x.event('pointercancel'),
    (x) => {
      x.stale();
      x.event('pointerup', { clientX: 20 });
    },
  ]) {
    const x = fixture();
    x.start();
    x.event('pointermove', { clientX: 20 });
    action(x);
    assert.equal(x.drops.length, 0);
    assert.equal(x.token.hasAttribute('transform'), false);
    assert.equal(x.drag.active, false);
  }
});
test('a click, unavailable context, alternate camera gesture and non-primary pointer do not place the group', () => {
  for (const fields of [{}, { altKey: true }, { button: 1 }, { isPrimary: false }]) {
    const x = fixture();
    x.event('pointerdown', fields, x.token);
    x.event('pointerup');
    assert.equal(x.drops.length, 0);
  }
  const x = fixture();
  x.disable();
  x.start();
  assert.equal(x.drag.active, false);
  assert.equal(x.drops.length, 0);
});
