import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export * from './desktop/session-packet-export';export {sessionPacketMarkdown} from './src/app/campaign/session-packet-contracts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/planner-packet-export.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  exportSessionPacketFile,
  sessionPacketMarkdown,
} = require('../../.build/planner-packet-export.cjs');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'packet-export-')),
    destination = path.join(root, 'Abend – GM.md'),
    old = Buffer.from('  Vorhandene eigene Mappe\r\n\0\xff', 'latin1');
  writeFileSync(destination, old);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return {
    root,
    destination,
    old,
    packet: {
      planId: 'plan',
      planName: 'Abend',
      planRevision: 1,
      campaignName: 'Welt',
      basis: 'one',
      party: [],
      warnings: [],
      visits: [
        {
          id: 'visit',
          title: 'Tor',
          locationId: null,
          location: null,
          blocks: [{ kind: 'gm', heading: 'Privat', text: '  Wortgetreu\r\n\n**Tür**  ' }],
        },
      ],
    },
  };
}
function unchanged(x) {
  assert.deepEqual(readFileSync(x.destination), x.old);
  assert.deepEqual(readdirSync(x.root), [path.basename(x.destination)]);
}
// Keep actual filesystem IO and inject the same fault at either supported writer
// boundary: legacy fs.writeFile or the candidate FileHandle.writeFile.
function interceptWrite(t, write) {
  const originalWrite = fs.writeFile.bind(fs),
    originalOpen = fs.open.bind(fs);
  t.mock.method(fs, 'writeFile', async (file, data, ...args) =>
    write(data, (body) => originalWrite(file, body, ...args)),
  );
  t.mock.method(fs, 'open', async (...args) => {
    const file = await originalOpen(...args),
      original = file.writeFile.bind(file);
    file.writeFile = async (data, ...options) => write(data, (body) => original(body, ...options));
    return file;
  });
}
test('packet export replaces the destination with exact Markdown bytes and leaves no candidate', async (t) => {
  const x = fixture(t);
  let checks = 0;
  await exportSessionPacketFile(x.destination, x.packet, () => checks++);
  assert.deepEqual(readFileSync(x.destination), Buffer.from(sessionPacketMarkdown(x.packet)));
  assert.ok(checks >= 1);
  assert.deepEqual(readdirSync(x.root), [path.basename(x.destination)]);
});
for (const existing of [true, false])
  test(
    'partial packet write preserves ' +
      (existing ? 'existing destination' : 'absent destination') +
      ' and removes the failed candidate',
    async (t) => {
      const x = fixture(t);
      if (!existing) rmSync(x.destination);
      interceptWrite(t, async (data, write) => {
        await write(String(data).slice(0, 7));
        throw new Error('controlled disk full');
      });
      await assert.rejects(
        exportSessionPacketFile(x.destination, x.packet, () => {}),
        /controlled disk full/,
      );
      if (existing) unchanged(x);
      else assert.deepEqual(readdirSync(x.root), []);
    },
  );
test('a source or campaign change during writing cannot publish over the previous file', async (t) => {
  const x = fixture(t);
  let current = true;
  interceptWrite(t, async (data, write) => {
    await write(data);
    current = false;
  });
  await assert.rejects(
    exportSessionPacketFile(x.destination, x.packet, () => {
      if (!current) throw new Error('source no longer current');
    }),
    /source no longer current/,
  );
  unchanged(x);
});
test('an already stale source never creates a candidate or changes the destination', async (t) => {
  const x = fixture(t);
  await assert.rejects(
    exportSessionPacketFile(x.destination, x.packet, () => {
      throw new Error('stale basis');
    }),
    /stale basis/,
  );
  unchanged(x);
});
for (const fault of ['sync', 'rename'])
  test(
    'packet ' + fault + ' failure retains the previous destination and cleans its candidate',
    async (t) => {
      const x = fixture(t);
      if (fault === 'rename')
        t.mock.method(syncFs, 'renameSync', () => {
          throw new Error('controlled rename failure');
        });
      else {
        const original = fs.open.bind(fs);
        t.mock.method(fs, 'open', async (...args) => {
          const file = await original(...args);
          file.sync = async () => {
            throw new Error('controlled sync failure');
          };
          return file;
        });
      }
      await assert.rejects(
        exportSessionPacketFile(x.destination, x.packet, () => {}),
        new RegExp('controlled ' + fault + ' failure'),
      );
      unchanged(x);
    },
  );

test('exclusive candidate creation failure never deletes a pre-existing file at that path', async (t) => {
  const x = fixture(t),
    original = fs.open.bind(fs);
  let collision;
  t.mock.method(fs, 'open', async (file, ...args) => {
    collision = file;
    writeFileSync(file, 'existing unrelated candidate');
    return original(file, ...args);
  });
  await assert.rejects(
    exportSessionPacketFile(x.destination, x.packet, () => {}),
    { code: 'EEXIST' },
  );
  assert.deepEqual(readFileSync(x.destination), x.old);
  assert.equal(readFileSync(collision, 'utf8'), 'existing unrelated candidate');
});
