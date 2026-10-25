import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';

import { selectTests } from './test-selection.mjs';

let selection;
try { selection = selectTests(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exit(1); }
const { files, serial, list } = selection;
if (list) { console.log(files.join('\n')); process.exit(0); }
const concurrency = serial ? 1 : Math.min(4, availableParallelism());
mkdirSync('.build', { recursive: true });
const started = performance.now();
const report = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  node: process.version, concurrency, files,
};
async function run(arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}
const prepared = await run(['build.mjs', '--test']);
report.prepareMs = performance.now() - started;
let result = prepared;
if (!prepared.code) {
  result = await run(['--test', `--test-concurrency=${concurrency}`,
    '--test-reporter=spec', '--test-reporter=tap',
    '--test-reporter-destination=stdout', '--test-reporter-destination=.build/tests.tap', ...files]);
}
report.totalMs = performance.now() - started;
report.testMs = report.totalMs - report.prepareMs;
Object.assign(report, result);
writeFileSync('.build/test-run.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Selected test run: ${(report.totalMs / 1000).toFixed(1)}s including ${(report.prepareMs / 1000).toFixed(1)}s preparation; ${concurrency} test processes.`);
process.exitCode = result.code;
