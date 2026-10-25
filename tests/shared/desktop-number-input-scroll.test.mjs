import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';

buildSync({
  entryPoints: ['src/app/shared/number-input-scroll.ts'],
  outfile: '.build/number-input-scroll-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { initNumberInputScroll } = createRequire(import.meta.url)(
  '../../.build/number-input-scroll-test.cjs',
);

test('scroll over an edited number releases native stepping without cancelling page scroll or changing the draft', () => {
  const { window, document } = parseHTML(
    '<input type="number" value="0"><input type="text"><div></div>',
  );
  const number = document.querySelector('input'),
    text = document.querySelector('input[type=text]');
  let active = number,
    blurred = 0;
  Object.defineProperty(document, 'activeElement', { get: () => active });
  number.blur = () => {
    blurred++;
    active = null;
  };
  initNumberInputScroll(document);
  const wheel = new window.Event('wheel', { bubbles: true, cancelable: true });
  number.dispatchEvent(wheel);
  assert.equal(blurred, 1);
  assert.equal(number.value, '0');
  assert.equal(wheel.defaultPrevented, false);
  active = text;
  number.dispatchEvent(new window.Event('wheel', { bubbles: true }));
  text.dispatchEvent(new window.Event('wheel', { bubbles: true }));
  document.querySelector('div').dispatchEvent(new window.Event('wheel', { bubbles: true }));
  assert.equal(active, text);
  assert.equal(blurred, 1);
});

test('typing and keyboard stepping retain number focus; another wheel target does not blur it', () => {
  const { window, document } = parseHTML('<input type="number" value="6"><div></div>');
  const number = document.querySelector('input');
  let blurred = 0;
  Object.defineProperty(document, 'activeElement', { get: () => number });
  number.blur = () => blurred++;
  initNumberInputScroll(document);
  number.dispatchEvent(new window.Event('keydown', { bubbles: true, cancelable: true }));
  number.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('div').dispatchEvent(new window.Event('wheel', { bubbles: true }));
  assert.equal(blurred, 0);
  assert.equal(number.value, '6');
});
