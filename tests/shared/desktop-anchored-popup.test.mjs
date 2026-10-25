import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
buildSync({
  entryPoints: ['src/app/shared/anchored-popup.ts'],
  outfile: '.build/anchored-popup.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { bindAnchoredPopup } = createRequire(import.meta.url)('../../.build/anchored-popup.cjs');
function setup() {
  const { window, document } = parseHTML(
      '<button id="trigger">Owner</button><div id="popup" popover><input value="own draft"></div>',
    ),
    trigger = document.getElementById('trigger'),
    popup = document.getElementById('popup');
  let open = false,
    focus = 0,
    source;
  window.innerWidth = 1000;
  window.innerHeight = 800;
  trigger.focus = () => focus++;
  trigger.getBoundingClientRect = () => ({
    left: 700,
    right: 800,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  Object.defineProperty(popup, 'scrollHeight', { value: 250 });
  popup.getBoundingClientRect = () => ({
    width: Math.min(300, window.innerWidth - 16),
    height: Math.min(252, parseFloat(popup.style.maxHeight) || 252),
  });
  popup.matches = () => open;
  const event = (name, state) => {
    const e = new window.Event(name);
    e.newState = state;
    popup.dispatchEvent(e);
  };
  popup.showPopover = (o) => {
    source = o?.source;
    event('beforetoggle', 'open');
    open = true;
    event('toggle', 'open');
  };
  popup.hidePopover = () => {
    event('beforetoggle', 'closed');
    open = false;
    event('toggle', 'closed');
  };
  const host = bindAnchoredPopup(trigger, popup, 300);
  return {
    window,
    document,
    trigger,
    popup,
    host,
    get open() {
      return open;
    },
    get focus() {
      return focus;
    },
    get source() {
      return source;
    },
  };
}
test('shared host binds invoker, trailing geometry and accessible toggle without changing owner content', () => {
  const x = setup(),
    content = x.popup.innerHTML;
  assert.equal(x.host.toggle(), true);
  assert.equal(x.source, x.trigger);
  assert.equal(x.popup.style.left, '500px');
  assert.equal(x.popup.style.top, '68px');
  assert.equal(x.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(x.trigger.getAttribute('aria-controls'), 'popup');
  assert.equal(x.focus, 1);
  assert.equal(x.host.open(), true);
  assert.equal(x.focus, 1);
  assert.equal(x.host.toggle(), false);
  assert.equal(x.trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(x.popup.innerHTML, content);
});
test('the topbar popup remains bounded on viewport resize', () => {
  const x = setup();
  x.host.open();
  x.window.innerWidth = 260;
  x.trigger.getBoundingClientRect = () => ({
    left: 100,
    right: 200,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  x.window.dispatchEvent(new x.window.Event('resize'));
  assert.equal(x.popup.style.left, '8px');
  x.host.close();
});
test('a low anchor places the popup above with a bounded height and closes when its anchor scrolls away', () => {
  const x = setup();
  x.trigger.getBoundingClientRect = () => ({
    left: 100,
    right: 200,
    top: 750,
    bottom: 790,
    width: 100,
    height: 40,
  });
  x.host.open();
  assert.equal(x.popup.style.top, '490px');
  assert.equal(x.popup.style.left, '8px');
  assert.equal(x.popup.style.maxHeight, '734px');
  x.trigger.getBoundingClientRect = () => ({
    left: 100,
    right: 200,
    top: -60,
    bottom: -20,
    width: 100,
    height: 40,
  });
  x.window.dispatchEvent(new x.window.Event('scroll'));
  assert.equal(x.open, false);
  assert.equal(x.trigger.getAttribute('aria-expanded'), 'false');
});
test('disabled or removed triggers cannot open a new popup', () => {
  const x = setup();
  x.trigger.disabled = true;
  assert.equal(x.host.open(), false);
  x.trigger.disabled = false;
  x.trigger.remove();
  assert.equal(x.host.toggle(), false);
  assert.equal(x.open, false);
});
test('native auto dismissal and programmatic feature opening share accessible host state', () => {
  const x = setup();
  x.popup.showPopover();
  assert.equal(x.focus, 1);
  assert.equal(x.trigger.getAttribute('aria-expanded'), 'true');
  x.popup.hidePopover();
  assert.equal(x.trigger.getAttribute('aria-expanded'), 'false');
  x.window.dispatchEvent(new x.window.Event('resize'));
  assert.equal(x.open, false);
});
for (const [name, bounds] of Object.entries({
  left: { left: -120, right: -20, top: 20, bottom: 60, width: 100, height: 40 },
  right: { left: 1000, right: 1100, top: 20, bottom: 60, width: 100, height: 40 },
  flat: { left: 700, right: 800, top: 20, bottom: 20, width: 100, height: 0 },
}))
  test('host dismisses ' + name + ' invisible anchor without losing owner draft', () => {
    const x = setup();
    x.host.open();
    const content = x.popup.innerHTML;
    x.trigger.getBoundingClientRect = () => bounds;
    x.window.dispatchEvent(new x.window.Event('scroll'));
    assert.equal(x.open, false);
    assert.equal(x.trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(x.popup.innerHTML, content);
  });
test('a partly visible anchor still keeps a bounded popup reachable', () => {
  const x = setup();
  x.trigger.getBoundingClientRect = () => ({
    left: -40,
    right: 60,
    top: 20,
    bottom: 60,
    width: 100,
    height: 40,
  });
  x.host.open();
  assert.equal(x.open, true);
  assert.equal(x.popup.style.left, '8px');
  x.host.close();
});

for (const [name, bounds] of Object.entries({
  offscreen: { left: 1000, right: 1100, top: 20, bottom: 60, width: 100, height: 40 },
  flat: { left: 700, right: 800, top: 20, bottom: 20, width: 100, height: 0 },
}))
  test('programmatic opening rejects ' + name + ' anchor before stealing focus', () => {
    const x = setup();
    x.trigger.getBoundingClientRect = () => bounds;
    assert.equal(x.host.open(), false);
    assert.equal(x.open, false);
    assert.equal(x.focus, 0);
    assert.equal(x.trigger.getAttribute('aria-expanded'), 'false');
  });
