import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertCatalogPayloadLimits,
  catalogMainJsGrowth,
  prepareCatalogBuildAsset,
} from "../tools/catalog-build-asset.mjs";

test("catalog build asset verifies the shared identity and numeric payload limits", async () => {
  const asset = await prepareCatalogBuildAsset();
  assert.equal(asset.inventory.sha256, asset.identity.artifactSha256);
  assert.ok(asset.inventory.gzipBytes <= asset.identity.limits.gzipBytes);
  assert.ok(asset.inventory.base64Characters <= asset.identity.limits.base64Characters);
  assert.equal(Buffer.from(asset.payload, "base64").byteLength, asset.inventory.gzipBytes);
});

test("all catalog payload gates fail closed when exceeded", () => {
  const limits = { gzipBytes: 10, base64Characters: 20, mainJsGrowthBytes: 30 };
  assert.throws(() => assertCatalogPayloadLimits({ gzipBytes: 11, base64Characters: 20 }, limits), /Gzip-Payload/);
  assert.throws(() => assertCatalogPayloadLimits({ gzipBytes: 10, base64Characters: 21 }, limits), /Base64-Payload/);
  const identity = { baseline: { mainBytes: 100 }, limits };
  assert.equal(catalogMainJsGrowth(130, identity), 30);
  assert.throws(() => catalogMainJsGrowth(131, identity), /main\.js-Zuwachs/);
});

test("product build inventories its revision and embeds only compressed catalog text", () => {
  execFileSync(process.execPath, ["build.mjs"], { stdio: "pipe" });
  const inventory = JSON.parse(execFileSync(process.execPath, ["-e",
    "process.stdout.write(require('fs').readFileSync('.build/catalog-build-inventory.json'))"], { encoding: "utf8" }));
  const main = execFileSync(process.execPath, ["-e",
    "process.stdout.write(require('fs').readFileSync('main.js','utf8'))"], { encoding: "utf8", maxBuffer: 3_000_000 });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim().length > 0;
  assert.equal(inventory.commit, head);
  assert.equal(inventory.dirty, dirty);
  assert.equal(inventory.sourceRevision, dirty ? `${head}+dirty` : head);
  assert.ok(inventory.mainJsGrowthBytes <= 180000);
  assert.match(main, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.doesNotMatch(main, /Mucous Cloud/);
  assert.ok(main.includes((awaitablePayloadPrefix())));
});

function awaitablePayloadPrefix() {
  return execFileSync(process.execPath, ["-e",
    "import('./tools/catalog-build-asset.mjs').then(async m=>process.stdout.write((await m.prepareCatalogBuildAsset()).payload.slice(0,80)))"],
  { encoding: "utf8" });
}

test("catalog build asset rejects a changed source before bundling", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dungeon-catalog-"));
  const source = join(directory, "source.json");
  const identity = join(directory, "identity.json");
  await writeFile(source, "{}\n");
  await writeFile(identity, JSON.stringify({
    source,
    artifactSha256: "0".repeat(64),
    baseline: { commit: "test", mainBytes: 0 },
    limits: { gzipBytes: 1000, base64Characters: 1000, mainJsGrowthBytes: 1000 },
  }));
  await assert.rejects(prepareCatalogBuildAsset(identity), /Quellhash abweichend/);
});
