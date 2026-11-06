import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../tools/host-test.cjs', import.meta.url), 'utf8');
const boundary = source.lastIndexOf('(async () => {\n  let failure;');
assert.ok(boundary > 0, 'execute the actual native workflow, without its GUI bootstrap');
const workflow = source.slice(boundary);
async function run({
  mainError,
  shutdownError,
  failMain = false,
  failShutdown = false,
  writeFails = false,
} = {}) {
  let calls = 0,
    receipt;
  const diagnostics = [];
  const process = { exitCode: 0 };
  await vm.runInNewContext(workflow, {
    Error,
    String,
    JSON,
    process,
    page: null,
    run: 'controlled',
    checks: ['fixture'],
    errors: [],
    guardFailure: null,
    peak: 17,
    out: '/qa',
    main: async () => {
      if (failMain) throw mainError;
    },
    shutdown: async () => {
      calls++;
      if (failShutdown) throw shutdownError;
    },
    fs: {
      mkdirSync() {},
      writeFileSync(path, text) {
        if (writeFails) throw new Error('read-only output');
        receipt = JSON.parse(text);
      },
    },
    console: {
      log() {},
      error(...args) {
        diagnostics.push(args);
      },
    },
  });
  assert.equal(calls, 1, 'shutdown is attempted exactly once');
  return { receipt, code: process.exitCode, diagnostics };
}
test('success retains original receipt fields and null errors', async () => {
  const { receipt, code } = await run();
  assert.deepEqual(receipt, {
    run: 'controlled',
    checks: ['fixture'],
    errors: [],
    guardFailure: null,
    failure: null,
    shutdownFailure: null,
    peakBytes: 17,
    passed: true,
  });
  assert.equal(code, 0);
});
for (const stage of ['main', 'shutdown', 'both'])
  test(`${stage} failure is persisted and fails the run`, async () => {
    const { receipt, code } = await run({
      failMain: stage !== 'shutdown',
      mainError: new Error('main failure'),
      failShutdown: stage !== 'main',
      shutdownError: new Error('shutdown failure'),
    });
    assert.equal(receipt.passed, false);
    assert.equal(code, 1);
    assert.equal(receipt.failure?.message ?? null, stage === 'shutdown' ? null : 'main failure');
    assert.equal(
      receipt.shutdownFailure?.message ?? null,
      stage === 'main' ? null : 'shutdown failure',
    );
  });
for (const value of [null, undefined, false, 0, '', 'non-error'])
  test(`falsy/non-Error throw ${String(value)} remains failure`, async () => {
    const { receipt, code } = await run({
      failMain: true,
      mainError: value,
      failShutdown: true,
      shutdownError: value,
    });
    assert.equal(receipt.passed, false);
    assert.equal(code, 1);
    assert.deepEqual(receipt.failure, { name: 'NonErrorThrown', message: String(value) });
    assert.deepEqual(receipt.shutdownFailure, receipt.failure);
  });
test('unwritable receipt is a reported failure, not an unhandled rejection', async () => {
  const { receipt, code, diagnostics } = await run({ writeFails: true });
  assert.equal(receipt, undefined);
  assert.equal(code, 1);
  assert.equal(diagnostics[0][0], 'QA result receipt could not be written');
});
