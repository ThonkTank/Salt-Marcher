import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/runtime/chase-draft-cache.ts'],
  outfile: '.build/chase-draft-cache.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { ChaseDraftCache } = createRequire(import.meta.url)('../../.build/chase-draft-cache.cjs');
const tick = () => new Promise((r) => setImmediate(r)),
  draft = (n) => ({
    version: 1,
    writeId: 'edit-' + n,
    chaseId: 'chase',
    sceneId: 'scene',
    revision: 2,
    fields: { 'chase-complication': 'Wagen ' + n },
    rows: [{ participantId: 'actor', distance: String(n) }],
  });
function fixture() {
  const before = globalThis.window;
  let stored = null,
    fail = false,
    drop = false,
    readFails = false,
    hold = false,
    release;
  const calls = [];
  globalThis.window = {
    campaign: {
      chase: async () =>
        readFails
          ? { ok: false, error: 'read failed' }
          : {
              ok: true,
              value: {
                chase: {
                  id: 'chase',
                  sceneId: 'scene',
                  revision: 2,
                  status: 'running',
                  participants: [{ id: 'actor' }],
                },
                draft: stored,
              },
            },
      keepChaseDraft: async (token, d, expected) => {
        calls.push({ d, expected });
        if (hold) {
          hold = false;
          await new Promise((r) => {
            release = r;
          });
        }
        if (fail) return { ok: false, error: 'write failed' };
        assert.equal(expected, stored?.writeId ?? null);
        stored = structuredClone(d);
        return drop ? { ok: false, error: 'response lost' } : { ok: true };
      },
    },
  };
  const cache = new ChaseDraftCache(() => {});
  cache.accept('cam', { chase: { id: 'chase' }, draft: null });
  return {
    cache,
    calls,
    get stored() {
      return stored;
    },
    set stored(v) {
      stored = v;
    },
    hold: () => {
      hold = true;
    },
    release: () => release(),
    fail: (v = true) => {
      fail = v;
    },
    drop: () => {
      drop = true;
    },
    readFails: (v) => {
      readFails = v;
    },
    cleanup() {
      globalThis.window = before;
    },
  };
}
test('rapid editing retains only the in-flight save and the latest value', async () => {
  const x = fixture();
  try {
    x.hold();
    const p = x.cache.put('token', 'cam', draft(0));
    for (let n = 1; n <= 50; n++) x.cache.put('token', 'cam', draft(n));
    assert.equal(x.calls.length, 1);
    x.release();
    assert(await p);
    assert(await x.cache.flush('cam'));
    assert.equal(x.calls.length, 2);
    assert.equal(x.calls[1].expected, 'edit-0');
    assert.deepEqual(x.stored, draft(50));
  } finally {
    x.cleanup();
  }
});
test('a lost response is reconciled by exact stored bytes and does not repeat the write', async () => {
  const x = fixture();
  try {
    x.drop();
    assert(await x.cache.put('token', 'cam', draft(1)));
    assert(await x.cache.flush('cam'));
    assert.equal(x.calls.length, 1);
    assert.equal(x.cache.status('cam', 'chase').error, undefined);
  } finally {
    x.cleanup();
  }
});
test('failed write and read retain latest raw fields until explicit retry can establish the stored write id', async () => {
  const x = fixture();
  try {
    x.drop();
    x.readFails(true);
    assert.equal(await x.cache.put('token', 'cam', draft(1)), false);
    assert.equal(await x.cache.put('token', 'cam', draft(2)), false);
    assert.equal(await x.cache.flush('cam'), false);
    x.readFails(false);
    assert(await x.cache.retry('token', 'cam'));
    assert.deepEqual(x.stored, draft(2));
    assert.equal(x.calls[1].expected, 'edit-1');
  } finally {
    x.cleanup();
  }
});
test('an unrelated saved draft cannot overwrite retained local raw input during retry', async () => {
  const x = fixture();
  try {
    x.fail();
    assert.equal(await x.cache.put('token', 'cam', draft(1)), false);
    x.stored = draft(99);
    assert.equal(await x.cache.retry('token', 'cam'), false);
    assert.deepEqual(x.cache.current('cam', 'chase'), draft(1));
    assert.deepEqual(x.stored, draft(99));
    assert.equal(x.calls.length, 1);
  } finally {
    x.cleanup();
  }
});
test('workspace release and stale views preserve failed input while clean caches are released', async () => {
  const x = fixture();
  try {
    x.fail();
    assert.equal(await x.cache.put('token', 'cam', draft(1)), false);
    x.cache.release('cam');
    x.cache.accept('cam', { chase: { id: 'chase' }, draft: draft(99) });
    assert.deepEqual(x.cache.current('cam', 'chase'), draft(1));
    assert.equal(x.cache.status('cam', 'chase').dirty, true);
  } finally {
    x.cleanup();
  }
});

test('retry safely rebases after participant reconciliation without restoring a removed participant', async () => {
  const x = fixture();
  try {
    x.fail();
    assert.equal(await x.cache.put('token', 'cam', draft(1)), false);
    x.fail(false);
    window.campaign.chase = async () => ({
      ok: true,
      value: {
        chase: { id: 'chase', sceneId: 'scene', revision: 3, status: 'running', participants: [] },
        draft: null,
      },
    });
    assert(await x.cache.retry('token', 'cam'));
    assert.equal(x.stored.revision, 3);
    assert.deepEqual(x.stored.rows, []);
    assert.equal(x.stored.fields['chase-complication'], 'Wagen 1');
  } finally {
    x.cleanup();
  }
});
