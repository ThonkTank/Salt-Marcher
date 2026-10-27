import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { prepareCatalogBuildAsset } from '../../tools/catalog-build-asset.mjs';
const asset = await prepareCatalogBuildAsset();

test('historical reference build inventories its revision and embeds only compressed catalog text', async () => {
  execFileSync(process.execPath, ['tools/build-legacy-obsidian.mjs'], { stdio: 'pipe' });
  const inventory = JSON.parse(
    await readFile('.build/legacy-obsidian/catalog-build-inventory.json', 'utf8'),
  );
  const main = await readFile('.build/legacy-obsidian/main.js', 'utf8');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty =
    execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim().length > 0;
  assert.equal(inventory.target, 'historical-obsidian-reference');
  assert.equal(inventory.command, 'npm run build:legacy:obsidian');
  assert.equal(inventory.commit, head);
  assert.equal(inventory.dirty, dirty);
  assert.equal(inventory.sourceRevision, dirty ? `${head}+dirty` : head);
  assert.equal(inventory.mainJsGrowthBytes, inventory.mainBytes - inventory.baselineMainBytes);
  assert.ok(inventory.catalogPayloadBytes <= inventory.catalogPayloadLimitBytes);
  assert.equal(inventory.catalogPayloadLimitBytes, 180000);
  assert.match(main, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.doesNotMatch(main, /Mucous Cloud/);
  assert.ok(main.includes(asset.payload.slice(0, 80)));
});
