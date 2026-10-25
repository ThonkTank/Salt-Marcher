import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertCatalogMainJsBudget,
  assertCatalogPayloadLimits,
  catalogMainJsGrowth,
  catalogPayloadMainJsBytes,
  prepareCatalogBuildAsset,
} from '../../tools/catalog-build-asset.mjs';

const asset = await prepareCatalogBuildAsset();

test('catalog build asset verifies the shared identity and numeric payload limits', async () => {
  assert.equal(asset.inventory.sha256, asset.identity.artifactSha256);
  assert.ok(asset.inventory.gzipBytes <= asset.identity.limits.gzipBytes);
  assert.ok(asset.inventory.base64Characters <= asset.identity.limits.base64Characters);
  assert.equal(Buffer.from(asset.payload, 'base64').byteLength, asset.inventory.gzipBytes);
});

test('all catalog payload gates fail closed when exceeded', () => {
  const limits = { gzipBytes: 10, base64Characters: 20, mainJsGrowthBytes: 30 };
  assert.throws(
    () => assertCatalogPayloadLimits({ gzipBytes: 11, base64Characters: 20 }, limits),
    /Gzip-Payload/,
  );
  assert.throws(
    () => assertCatalogPayloadLimits({ gzipBytes: 10, base64Characters: 21 }, limits),
    /Base64-Payload/,
  );
  const identity = { baseline: { mainBytes: 100 }, limits };
  assert.equal(catalogMainJsGrowth(130, identity), 30);
  assert.equal(catalogMainJsGrowth(131, identity), 31);
  assert.equal(assertCatalogMainJsBudget(30, identity), 30);
  assert.throws(() => assertCatalogMainJsBudget(31, identity), /main\.js-Kataloganteil/);
  const metafile = {
    outputs: {
      'main.js': {
        inputs: {
          'src/unrelated.ts': { bytesInOutput: 900000 },
          'catalog-asset:srd-5.1-gzip': { bytesInOutput: 29 },
        },
      },
    },
  };
  assert.equal(catalogPayloadMainJsBytes(metafile), 29);
  metafile.outputs['main.js'].inputs['src/unrelated.ts'].bytesInOutput += 1000000;
  assert.equal(catalogPayloadMainJsBytes(metafile), 29);
  assert.throws(
    () => catalogPayloadMainJsBytes({ outputs: { 'main.js': { inputs: {} } } }),
    /keinen emittierten SRD-5\.1-Katalogpayload/,
  );
});

test('product build inventories its revision and embeds only compressed catalog text', async () => {
  execFileSync(process.execPath, ['build.mjs'], { stdio: 'pipe' });
  const inventory = JSON.parse(await readFile('.build/catalog-build-inventory.json', 'utf8'));
  const main = await readFile('main.js', 'utf8');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty =
    execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      encoding: 'utf8',
    }).trim().length > 0;
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

test('catalog build asset rejects a changed source before bundling', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dungeon-catalog-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, 'source.json');
  const identity = join(directory, 'identity.json');
  await writeFile(source, '{}\n');
  await writeFile(
    identity,
    JSON.stringify({
      source,
      artifactSha256: '0'.repeat(64),
      baseline: { commit: 'test', mainBytes: 0 },
      limits: { gzipBytes: 1000, base64Characters: 1000, mainJsGrowthBytes: 1000 },
    }),
  );
  await assert.rejects(prepareCatalogBuildAsset(identity), /Quellhash abweichend/);
});
