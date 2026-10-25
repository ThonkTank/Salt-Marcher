import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from './helpers/build.mjs';
import { createRequire } from 'node:module';
import { assertNativeCompletion } from '../tools/native-session.mjs';
buildSync({
  entryPoints: ['src/app/editor-transition.ts'],
  outfile: '.build/editor-transition.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { acknowledgeFields, captureView } = createRequire(import.meta.url)(
  '../.build/editor-transition.cjs',
);
test('confirmation advances the canonical revision but preserves later literal edits, including explicit empty text', () => {
  const sent = { id: 'visit', revision: 4, title: 'Gesendet', notes: '  Original\r\n' },
    confirmed = { ...sent, revision: 5 },
    current = { ...sent, revision: 999, title: '', notes: '  Original\r\nDanach' };
  const accepted = acknowledgeFields(confirmed, sent, current, ['title', 'notes']);
  assert.deepEqual(accepted.basis, confirmed);
  assert.deepEqual(accepted.value, { ...confirmed, title: '', notes: current.notes });
  assert.equal(accepted.dirty, true);
  const next = acknowledgeFields(
    { ...accepted.value, revision: 6 },
    accepted.value,
    accepted.value,
    ['title', 'notes'],
  );
  assert.equal(next.dirty, false);
});
test('a return to the old text during save is a new edit, not an acknowledgement of the sent text', () => {
  const sent = { summary: 'Gesendeter Rückblick', handoff: 'Weiter' },
    current = { summary: 'Vorheriger Rückblick', handoff: 'Weiter' };
  assert.deepEqual(acknowledgeFields(sent, sent, current, ['summary', 'handoff']), {
    basis: sent,
    value: current,
    dirty: true,
  });
});
test('the same entity in a new activation or opening cannot accept an old response', () => {
  let token = 'first',
    target = 'note',
    opening = 1;
  const current = captureView(() => [token, target, opening]);
  assert(current());
  target = 'other';
  assert(!current());
  target = 'note';
  opening++;
  assert(!current());
  opening = 1;
  token = 'second';
  assert(!current());
});
test('native qualification rejects absent launches, forced exit, absent PID evidence and renderer errors', () => {
  const good = { pid: 123, exit: { code: 0, signal: null }, pidAbsent: true };
  assertNativeCompletion([good], []);
  for (const launches of [
    [],
    [{ ...good, exit: undefined }],
    [{ ...good, exit: { code: null, signal: 'SIGTERM' } }],
    [{ ...good, pidAbsent: false }],
  ])
    assert.throws(() => assertNativeCompletion(launches, []));
  assert.throws(() => assertNativeCompletion([good], ['renderer failed']));
});

buildSync({
  entryPoints: ['src/app/booking-dialog.ts'],
  outfile: '.build/booking-dialog.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { BookingDialog } = createRequire(import.meta.url)('../.build/booking-dialog.cjs');
test('a closed and reopened dialog ignores the old reply and cannot unlock a newer booking', async (t) => {
  const previous = globalThis.window;
  t.after(() => {
    globalThis.window = previous;
  });
  globalThis.window = { localStorage: { getItem: () => null } };
  const dialog = new BookingDialog(),
    events = [];
  let releaseOld, releaseNew;
  const options = (send) => ({
    campaignId: 'campaign',
    current: () => true,
    send,
    lock: (busy) => events.push(['lock', busy]),
    report: (message) => events.push(['error', message]),
    confirmed: () => events.push(['confirmed']),
  });
  const old = dialog.run(options(() => new Promise((r) => (releaseOld = r))));
  assert(dialog.busy);
  dialog.reset();
  const next = dialog.run(options(() => new Promise((r) => (releaseNew = r))));
  releaseOld(true);
  assert.equal(await old, false);
  assert(dialog.busy);
  assert.deepEqual(events, [
    ['lock', true],
    ['lock', true],
  ]);
  releaseNew(true);
  assert.equal(await next, true);
  assert.deepEqual(events.slice(2), [['lock', false], ['confirmed']]);
});
test('unknown outcome releases closing, keeps local error and blocks another send until receipt status clears', async (t) => {
  const previous = globalThis.window;
  t.after(() => {
    globalThis.window = previous;
  });
  let ref = null;
  globalThis.window = { localStorage: { getItem: () => ref } };
  const dialog = new BookingDialog(),
    errors = [],
    locks = [];
  let writes = 0;
  const options = {
    campaignId: 'campaign',
    current: () => true,
    send: async (failed) => {
      writes++;
      ref = JSON.stringify({
        family: 'combat',
        campaignId: 'campaign',
        commandId: 'one',
        fingerprint: 'a'.repeat(64),
      });
      failed('Antwort verloren');
      return false;
    },
    lock: (busy) => locks.push(busy),
    report: (message) => errors.push(message),
    confirmed: () => assert.fail('Unconfirmed dialog cannot succeed'),
  };
  assert.equal(await dialog.run(options), false);
  assert.equal(dialog.busy, false);
  assert.deepEqual(locks, [true, false]);
  assert.match(errors[0], /Antwort verloren.*Schließen.*Buchungsstatus/);
  await dialog.run(options);
  assert.equal(writes, 1);
  ref = null;
  await dialog.run({
    ...options,
    send: async () => {
      writes++;
      return true;
    },
    confirmed: () => {},
  });
  assert.equal(writes, 2);
});
