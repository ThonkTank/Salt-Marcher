import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from '../helpers/dom.mjs';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/campaign/session-origin-ui.ts'],
  outfile: '.build/session-origin-ui.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { renderSessionOrigin } = createRequire(import.meta.url)(
  '../../.build/session-origin-ui.cjs',
);
test('saved origin explains original reward separately from authored reward using text-safe rendering', () => {
  const { document } = parseHTML('<html><body><main></main></body></html>');
  global.document = document;
  const run = {
    id: 'run-one',
    seed: '179974',
    profileRevision: 1,
    budget: 3480,
    targets: { version: 'saltmarcher-targets-v1', fraction: '0.6' },
    proposals: [{ reward: { poolXp: 11, items: [] } }],
    origin: {
      locations: [],
      notes: [],
      encounters: [
        {
          runId: 'source',
          seed: 'scene-seed',
          catalogHash: 'catalog-hash',
          preset: { name: '<img src=x>', revision: 2, hash: 'config-hash' },
        },
      ],
      rewards: [{ poolXp: 0, items: [{ quantity: 2, name: 'Originalfund', valueGold: '3' }] }],
    },
  };
  const root = document.querySelector('main');
  renderSessionOrigin(root, run);
  assert.match(root.textContent, /Originalfund/);
  assert.match(root.textContent, /bearbeitet/);
  assert.match(root.textContent, /catalog-hash/);
  assert.match(root.textContent, /config-hash/);
  assert.match(root.textContent, /Neuer|neuen Seed/);
  assert.equal(root.querySelector('img'), null);
  root.replaceChildren();
  renderSessionOrigin(root, { ...run, origin: undefined });
  assert.match(root.textContent, /keinen vollständigen/);
  assert.match(root.textContent, /bleiben verfügbar/);
});
