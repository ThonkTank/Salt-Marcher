// Explicit restoration adapter: only fixture construction is replaced. Product,
// native UI actions and independent storage assertions remain the archived code.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, copyFileSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const seed = process.env.E2E_REFERENCE_FIXTURE;
assert(seed, 'Reference restoration requires an explicit frozen fixture directory');
globalThis.__restoreE2E02Reference = (profile) => {
  const report = JSON.parse(readFileSync(path.join(seed, 'result.json'), 'utf8'));
  const bytes = readFileSync(path.join(seed, 'seed.sqlite'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.seedDatabaseHash);
  copyFileSync(path.join(seed, 'seed.sqlite'), path.join(profile, 'workbench.sqlite'));
  cpSync(path.join(seed, 'seed-player-images'), path.join(profile, 'player-images'), {
    recursive: true,
  });
  return structuredClone(report.fixture);
};
registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url.endsWith('/tools/live-e2e02-fixture.mjs')) {
      const marker = 'export function seedE2E02(CampaignStore, profile) {';
      const source = loaded.source.toString();
      assert.equal(source.split(marker).length, 2, 'Archived fixture entry changed');
      return {
        ...loaded,
        source: source.replace(
          marker,
          marker + '\n  return globalThis.__restoreE2E02Reference(profile);',
        ),
      };
    }
    return loaded;
  },
});
