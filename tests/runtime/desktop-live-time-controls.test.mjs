import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export {LiveTimeControls} from './src/app/runtime/live-time-controls'; export {EditorSession} from './src/app/shared/editor-session'; export {createEditorSurface} from './src/app/shared/editor-surface';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/live-time-controls.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  LiveTimeControls,
  EditorSession,
  createEditorSurface,
} = require('../../.build/live-time-controls.cjs');
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(document) {
  const root = document.createElement('section');
  root.innerHTML =
    '<input id="time-amount"><input id="time-unit"><input id="time-reason"><button id="time-advance"></button><p id="time-preview"></p><p id="live-clock"></p>';
  document.body.append(root);
  const { get } = createEditorSurface([root]);
  const session = new EditorSession(),
    requests = [],
    accepted = [];
  let context = { workspace: { token: 'workspace' }, scene: { id: 'one' } };
  const controls = new LiveTimeControls({
    get,
    session,
    context: () => context,
    blocked: () => false,
    accepted: (from) => accepted.push(from),
    api: {
      previewTime: (token, request) =>
        new Promise((resolve) => requests.push({ token, request, resolve })),
    },
  });
  controls.contextChanged();
  return {
    controls,
    session,
    requests,
    accepted,
    get,
    scene(id) {
      context = { ...context, scene: { id } };
      controls.contextChanged();
    },
  };
}
const result = (from = '0') => ({
  ok: true,
  value: {
    from,
    to: '600000',
    calendar: {
      daySeconds: 86400,
      startYear: 1,
      months: [{ name: 'Winter', days: 30 }],
      weekdays: [],
    },
  },
});
test('time controls isolate duplicate IDs, preserve literal scene drafts and revoke detached previews', async () => {
  const { document } = parseHTML('<html><body></body></html>');
  const a = fixture(document),
    b = fixture(document);
  a.get('time-amount').value = ' 17 ';
  a.get('time-reason').value = '  Rast\r\n';
  a.controls.render();
  b.controls.render();
  assert.equal(a.session.reading, 1);
  assert.equal(b.session.reading, 1);
  a.session.deactivate();
  a.session.generation++;
  a.controls.render();
  a.requests[0].resolve(result('1000'));
  await tick();
  assert.equal(a.controls.preview, null);
  assert.equal(a.session.reading, 1, 'old read completion must not release the new read');
  assert.deepEqual(a.accepted, []);
  b.requests[0].resolve(result('2000'));
  a.requests[1].resolve(result('3000'));
  await tick();
  assert.deepEqual(a.accepted, ['3000']);
  assert.deepEqual(b.accepted, ['2000']);
  assert.equal(a.session.reading, 0);
  a.scene('two');
  assert.equal(a.get('time-amount').value, '10');
  a.controls.render();
  a.scene('one');
  a.controls.render();
  assert.equal(a.get('time-amount').value, ' 17 ');
  assert.equal(a.get('time-reason').value, '  Rast\r\n');
  a.requests[2].resolve({ ok: false, error: 'old scene failure' });
  await tick();
  assert.doesNotMatch(a.get('time-preview').textContent, /old scene failure/);
  a.requests[3].resolve(result('4000'));
  await tick();
  assert.deepEqual(a.accepted, ['3000', '4000']);
  assert.equal(b.get('time-amount').value, '10');
});
