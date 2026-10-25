import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let m, p, i, f, s;
before(async () => {
  await mkdir('.build', { recursive: true });
  for (const name of ['manifest', 'package', 'install', 'files', 'service'])
    await build({
      entryPoints: ['desktop/update-' + name + '.ts'],
      outfile: '.build/update-' + name + '.test.cjs',
      bundle: true,
      platform: 'node',
      format: 'cjs',
    });
  m = require('../.build/update-manifest.test.cjs');
  p = require('../.build/update-package.test.cjs');
  i = require('../.build/update-install.test.cjs');
  f = require('../.build/update-files.test.cjs');
  s = require('../.build/update-service.test.cjs');
});
const keys = generateKeyPairSync('ed25519'),
  publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }),
  commit = 'a'.repeat(40);
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'saltmarcher-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'),
    install = path.join(root, 'install'),
    profile = path.join(root, 'profile'),
    old = path.join(install, 'old');
  await mkdir(source, { recursive: true });
  await mkdir(old, { recursive: true });
  await mkdir(profile);
  await writeFile(path.join(profile, 'workbench.sqlite'), 'campaign, live-state, drafts');
  await mkdir(path.join(profile, 'audio'));
  await writeFile(path.join(profile, 'audio/song.ogg'), 'media bytes');
  await symlink('old', path.join(install, 'current'));
  for (const name of [
    'electron',
    'Starten.sh',
    'resources/app/main.cjs',
    'resources/app/update-helper.cjs',
    'resources/app/update-probe.cjs',
  ]) {
    await mkdir(path.dirname(path.join(source, name)), { recursive: true });
    await writeFile(path.join(source, name), 'test executable', { mode: 0o755 });
  }
  await writeFile(
    path.join(source, 'resources/app/build-info.json'),
    JSON.stringify({ applicationVersion: '1.0.1', commit, product: m.updateProduct }),
  );
  const archive = path.join(root, 'release.zip'),
    hashes = await p.packUpdate(source, archive, '1.0.1', commit);
  const manifest = {
    format: 1,
    product: m.updateProduct,
    dataLine: 'CampaignWorkbench',
    version: '1.0.1',
    commit,
    platform: 'linux-x64',
    archive: 'SaltMarcher-1.0.1-linux-x64.zip',
    ...hashes,
    schema: { min: 0, max: 48, target: 48 },
  };
  const signed = Buffer.from(JSON.stringify(manifest)),
    signature = sign(null, signed, keys.privateKey);
  const staged = await p.unpackUpdate(archive, path.join(install, '.updates'), manifest);
  await writeFile(path.join(staged, m.manifestName), signed);
  await writeFile(path.join(staged, m.manifestName + '.sig'), signature);
  return {
    root,
    source,
    install,
    profile,
    old,
    archive,
    manifest,
    signed,
    signature,
    staged,
    input: { root: install, profile, previous: old, staged, publicKey, token: randomUUID() },
  };
}
test('stable version order and old-release exclusion', () => {
  assert.equal(m.newerVersion('0.164.0', '0.3.0'), true);
  assert.equal(m.newerVersion('1.0.0', '1.0.0'), false);
  assert.throws(() => m.newerVersion('1.0.0-beta', '0.3.0'));
  const asset = (name) => ({ name }),
    release = (v, extras = {}) => ({
      tag_name: 'v' + v,
      draft: false,
      prerelease: false,
      assets: [
        asset(m.manifestName),
        asset(m.manifestName + '.sig'),
        asset(`SaltMarcher-${v}-linux-x64.zip`),
      ],
      ...extras,
    });
  assert.deepEqual(
    m
      .releaseCandidates(
        [
          release('1.1.0'),
          release('2.0.0', { draft: true }),
          release('3.0.0', { prerelease: true }),
          release('4.0.0', { assets: [] }),
          release('1.0.0'),
        ],
        '1.0.0',
      )
      .map((r) => r.version),
    ['1.1.0'],
  );
});
test('signature binds product, data lineage, platform and file hashes', async (t) => {
  const x = await fixture(t);
  assert.equal(m.verifyManifest(x.signed, x.signature, publicKey).version, '1.0.1');
  assert.throws(
    () =>
      m.verifyManifest(
        Buffer.from(x.signed.toString().replace('1.0.1', '1.0.2')),
        x.signature,
        publicKey,
      ),
    /signatur/,
  );
  assert.throws(() => m.checkedManifest({ ...x.manifest, dataLine: 'old SaltMarcher' }));
  assert.throws(() => m.checkedManifest({ ...x.manifest, platform: 'win32-x64' }));
  await writeFile(path.join(x.staged, 'electron'), 'modified');
  await assert.rejects(i.verifyStaged(x.staged, publicKey), /verändert/);
});
test('package index cannot be rewritten even with matching per-file hashes', async (t) => {
  const x = await fixture(t),
    file = path.join(x.staged, 'manifest.json');
  await writeFile(file, (await readFile(file, 'utf8')) + ' ');
  await assert.rejects(i.verifyStaged(x.staged, publicKey), /Paketindex/);
});
test('archive rejects traversal and unsigned byte changes', async (t) => {
  const x = await fixture(t);
  for (const n of ['../outside', '/tmp/x', 'foo/../../x', 'foo\\x', 'foo//bar'])
    assert.equal(p.safePackageName(n), false);
  await writeFile(x.archive, 'truncated');
  await assert.rejects(p.unpackUpdate(x.archive, x.install, x.manifest), /Prüfsumme|Größe/);
});
test('package and profile symlinks are never followed', async (t) => {
  const x = await fixture(t);
  await symlink('/etc/passwd', path.join(x.staged, 'escape'));
  await assert.rejects(i.verifyStaged(x.staged, publicKey));
  await symlink('/etc/passwd', path.join(x.profile, 'escape'));
  await assert.rejects(f.copyProfile(x.profile, path.join(x.root, 'copy')), /reguläre/);
});
test('successful activation preserves complete profile and immutable old version', async (t) => {
  const x = await fixture(t);
  const journal = await i.installUpdate(x.input, {
    probe: async (dir, profile) => {
      assert.notEqual(profile, x.profile);
      assert.equal(await readFile(path.join(profile, 'audio/song.ogg'), 'utf8'), 'media bytes');
      await writeFile(path.join(profile, 'workbench.sqlite'), 'migrated trial');
    },
    start: async (j) => {
      assert.equal(await realpath(path.join(x.install, 'current')), j.next);
      assert.equal(
        await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
        'campaign, live-state, drafts',
      );
    },
  });
  assert.equal(journal.phase, 'committed');
  assert.equal(
    await readFile(path.join(journal.backup, 'workbench.sqlite'), 'utf8'),
    'campaign, live-state, drafts',
  );
  await writeFile(path.join(x.profile, 'workbench.sqlite'), 'new play after activation');
  await i.rollback(journal);
  assert.equal(
    await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
    'new play after activation',
  );
  assert((await stat(x.old)).isDirectory());
});
for (const phase of ['backed-up', 'validated', 'activating', 'starting'])
  test('failure at ' + phase + ' retains original data and prior application', async (t) => {
    const x = await fixture(t);
    await assert.rejects(
      i.installUpdate(x.input, {
        probe: async () => {},
        start: async () => {},
        phase: async (j) => {
          if (j.phase === phase) throw new Error('injected interruption');
        },
      }),
    );
    const j = await f.readJSON(i.journalFile(x.install));
    await i.rollback(j);
    assert.equal(await realpath(path.join(x.install, 'current')), x.old);
    assert.equal(
      await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
      'campaign, live-state, drafts',
    );
  });
test('failed first start restores backup and preserves failed migrated data', async (t) => {
  const x = await fixture(t);
  await assert.rejects(
    i.installUpdate(x.input, {
      probe: async () => {},
      start: async () => {
        await writeFile(path.join(x.profile, 'workbench.sqlite'), 'failed migration');
        throw new Error('startup failed');
      },
    }),
  );
  const j = await f.readJSON(i.journalFile(x.install));
  assert.equal(j.phase, 'rolled-back');
  assert.equal(
    await readFile(path.join(j.retained, 'workbench.sqlite'), 'utf8'),
    'failed migration',
  );
  assert.equal(
    await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
    'campaign, live-state, drafts',
  );
});
test('migration failure never changes current or original', async (t) => {
  const x = await fixture(t);
  await assert.rejects(
    i.installUpdate(x.input, {
      probe: async () => {
        throw new Error('bad schema');
      },
      start: async () => assert.fail('must not start'),
    }),
  );
  assert.equal(await realpath(path.join(x.install, 'current')), x.old);
});
test('locks reject concurrent process and recover dead owner', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sm-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'lock'),
    release = await f.acquireLock(file);
  await assert.rejects(f.acquireLock(file), /läuft/);
  await release();
  await writeFile(file, JSON.stringify({ pid: 2147483647, token: 'dead' }));
  const unlock = await f.acquireLock(file);
  await unlock();
  await assert.rejects(f.requireSpace(dir, Number.MAX_SAFE_INTEGER), /Speicher/);
});
async function serviceFixture(t) {
  const x = await fixture(t),
    calls = [];
  let fail = null;
  const request = async (url, init) => {
    calls.push(url);
    if (fail) throw new Error(fail);
    if (init?.signal?.aborted) throw new Error('aborted');
    if (url.includes('/releases?'))
      return new Response(
        JSON.stringify([
          {
            draft: false,
            prerelease: false,
            tag_name: 'v1.0.1',
            body: 'Changes',
            assets: [
              { name: m.manifestName },
              { name: m.manifestName + '.sig' },
              { name: x.manifest.archive },
            ],
          },
        ]),
      );
    if (url.endsWith('.json.sig')) return new Response(x.signature);
    if (url.endsWith('.json')) return new Response(x.signed);
    return new Response(await readFile(x.archive));
  };
  const service = new s.UpdateService({
    version: '1.0.0',
    root: x.install,
    settings: path.join(x.profile, 'update-settings.json'),
    publicKey,
    emit: () => {},
    request,
  });
  await service.init();
  return {
    ...x,
    service,
    calls,
    fail: (v) => {
      fail = v;
    },
  };
}
test('check, download and prepare are separate; daily checks and preferences persist', async (t) => {
  const x = await serviceFixture(t);
  await x.service.autoCheck();
  assert.equal(x.service.status().phase, 'available');
  assert(!x.calls.some((u) => u.endsWith('.zip')));
  const count = x.calls.length;
  await x.service.autoCheck();
  assert.equal(x.calls.length, count);
  await x.service.download();
  assert.equal(x.service.status().phase, 'ready');
  assert.equal(x.service.installation().manifest.version, '1.0.1');
  await x.service.automatic(false);
  assert.equal((await f.readJSON(path.join(x.profile, 'update-settings.json'))).automatic, false);
});
test('offline and rate limits are recoverable, no forced quit', async (t) => {
  const x = await serviceFixture(t);
  x.fail('offline');
  await x.service.check();
  assert.equal(x.service.status().phase, 'error');
  x.fail(null);
  await x.service.check();
  assert.equal(x.service.status().phase, 'available');
  await assert.rejects(
    s.githubFetch('https://api.github.com/a', {}, async () => new Response('', { status: 429 })),
    /begrenzt/,
  );
  await assert.rejects(s.githubFetch('https://evil.example/a'), /Unerlaubtes/);
  await assert.rejects(
    s.githubFetch(
      'https://github.com/a',
      {},
      async () =>
        new Response('', { status: 302, headers: { location: 'http://localhost/secret' } }),
    ),
    /Unerlaubtes/,
  );
});
test('cancelled download leaves no prepared installation', async (t) => {
  const x = await fixture(t);
  let streamStarted;
  const started = new Promise((r) => {
    streamStarted = r;
  });
  const service = new s.UpdateService({
    version: '1.0.0',
    root: x.install,
    settings: path.join(x.profile, 'updates.json'),
    publicKey,
    emit: () => {},
    request: async (url, init) => {
      if (url.includes('/releases?'))
        return new Response(
          JSON.stringify([
            {
              draft: false,
              prerelease: false,
              tag_name: 'v1.0.1',
              assets: [
                { name: m.manifestName },
                { name: m.manifestName + '.sig' },
                { name: x.manifest.archive },
              ],
            },
          ]),
        );
      if (url.endsWith('.json.sig')) return new Response(x.signature);
      if (url.endsWith('.json')) return new Response(x.signed);
      return new Response(
        new ReadableStream({
          start(controller) {
            streamStarted();
            init.signal.addEventListener('abort', () => controller.error(new Error('cancelled')), {
              once: true,
            });
          },
        }),
      );
    },
  });
  await service.init();
  await service.check();
  const download = service.download();
  await started;
  service.cancel();
  await download;
  assert.equal(service.status().phase, 'available');
  assert.throws(() => service.installation(), /Kein geprüftes/);
});
test('startup failure after committed never rolls back later work', async (t) => {
  const x = await fixture(t);
  const j = await i.installUpdate(x.input, { probe: async () => {}, start: async () => {} });
  await writeFile(path.join(x.profile, 'workbench.sqlite'), 'later user changes');
  await i.rollback({ ...j, phase: 'committed' });
  assert.equal(
    await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
    'later user changes',
  );
});
test('partial rollback resumes after preserving original profile', async (t) => {
  const x = await fixture(t);
  await assert.rejects(
    i.installUpdate(x.input, {
      probe: async () => {},
      start: async () => {
        throw new Error('fail');
      },
    }),
  );
  const j = await f.readJSON(i.journalFile(x.install));
  await rm(x.profile, { recursive: true });
  j.phase = 'rolling-back';
  await i.rollback(j);
  assert.equal(await readFile(path.join(x.profile, 'audio/song.ogg'), 'utf8'), 'media bytes');
});
for (const phase of ['prepared', 'backed-up', 'validated', 'activating', 'starting', 'committed'])
  test('process termination after durable ' + phase + ' is recoverable', async (t) => {
    const x = await fixture(t),
      { spawn } = await import('node:child_process');
    const code = `const {installUpdate}=require(process.argv[1]);installUpdate(JSON.parse(process.argv[2]),{probe:async()=>{},start:async()=>{},phase:async j=>{if(j.phase===process.argv[3])process.exit(73);}}).catch(e=>{console.error(e);process.exit(1)});`;
    const child = spawn(
      process.execPath,
      ['-e', code, path.resolve('.build/update-install.test.cjs'), JSON.stringify(x.input), phase],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let errors = '';
    child.stderr.on('data', (b) => (errors += b));
    assert.equal(await new Promise((r) => child.once('exit', r)), 73, errors);
    const j = await f.readJSON(i.journalFile(x.install));
    assert.equal(j.phase, phase);
    await i.rollback(j);
    assert.equal(
      await readFile(path.join(x.profile, 'workbench.sqlite'), 'utf8'),
      'campaign, live-state, drafts',
    );
    assert.equal(
      await realpath(path.join(x.install, 'current')),
      phase === 'committed' ? j.next : x.old,
    );
  });
