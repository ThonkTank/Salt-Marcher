// Standalone controlled failures from the same frozen seed, with fresh profiles.
import assert from 'node:assert/strict';
import { readFile, copyFile, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const seed = process.env.E2E_REFERENCE_FIXTURE;
const output = process.env.QA_EVIDENCE_DIR;
assert(seed && output, 'Explicit reference fixture and new output required');
const report = JSON.parse(await readFile(path.join(seed, 'result.json'), 'utf8'));
const bytes = await readFile(path.join(seed, 'seed.sqlite'));
assert.equal(createHash('sha256').update(bytes).digest('hex'), report.seedDatabaseHash);
await copyFile(path.join(seed, 'seed.sqlite'), path.join(output, 'seed.sqlite'));
await cp(path.join(seed, 'seed-player-images'), path.join(output, 'seed-player-images'), {
  recursive: true,
});
const { runE2E02Countercases } = await import(
  pathToFileURL(path.join(process.cwd(), 'tools/live-e2e02-countercases.mjs'))
);
await runE2E02Countercases({
  output,
  fixture: report.fixture,
  seedDatabaseHash: report.seedDatabaseHash,
  source: report.source,
  softwareGpu: false,
});
