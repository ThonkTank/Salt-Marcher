import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile, realpath, open, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  acquireLock,
  alive,
  atomicJSON,
  exists,
  readJSON,
  rejectLegacyRunningProfile,
  requireSpace,
  treeSize,
  copyProfile,
} from './update-files';
import {
  checkedJournal,
  copyApplication,
  installationRoot,
  installLock,
  installUpdate,
  journalFile,
  pointCurrent,
  profileLock,
  rollback,
  verifyStaged,
  type UpdateJournal,
} from './update-install';
import {
  manifestName,
  releaseAssetURL,
  updateProduct,
  type UpdateManifest,
} from './update-manifest';
import { githubFetch } from './update-service';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const appDir = path.resolve(__dirname, '../..');
const publicKey = () => readFile(path.join(__dirname, 'update-public-key.pem'), 'utf8');
export interface InstallRequest {
  root: string;
  profile: string;
  previous: string;
  staged: string;
  parentPid: number;
  token: string;
}
function env(extra: NodeJS.ProcessEnv = {}) {
  const e = { ...process.env, ...extra };
  delete e.ELECTRON_RUN_AS_NODE;
  delete e.SALTMARCHER_UPDATE_TOKEN;
  return { ...e, ...extra };
}
async function runProbe(dir: string, profile: string, manifest: UpdateManifest) {
  const handle = await open(path.join(profile, 'workbench.sqlite'), 'r');
  const header = Buffer.alloc(100);
  try {
    const read = await handle.read(header, 0, 100, 0);
    if (read.bytesRead !== 100 || header.subarray(0, 16).toString() !== 'SQLite format 3\0')
      throw new Error('Keine unterstützte Kampagnendatenbank.');
    const schema = header.readUInt32BE(60);
    if (schema < manifest.schema.min || schema > manifest.schema.max)
      throw new Error('Dieses Release unterstützt das vorhandene Datenformat nicht.');
  } finally {
    await handle.close();
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      path.join(dir, 'electron'),
      [path.join(dir, 'resources/app/update-probe.cjs'), profile],
      { env: { ...env(), ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let output = '';
    child.stderr.on('data', (b) => {
      output = (output + b).slice(-6000);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Datenprüfung hat das Zeitlimit überschritten.'));
    }, 120000);
    child.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error('Datenprüfung fehlgeschlagen: ' + output));
    });
  });
}
async function startCandidate(j: UpdateJournal) {
  let child: ChildProcess | null = null;
  try {
    child = spawn(path.join(j.next, 'electron'), ['--data-dir', j.profile], {
      env: env({ SALTMARCHER_UPDATE_TOKEN: j.token }),
      detached: true,
      stdio: 'ignore',
    });
    await new Promise<void>((resolve, reject) => {
      child!.once('spawn', resolve);
      child!.once('error', reject);
    });
    j.childPid = child.pid!;
    await atomicJSON(journalFile(j.root), j);
    for (let n = 0; n < 600; n++) {
      const ready = await readJSON<{ token: string; pid: number }>(
        path.join(j.root, '.update-ready'),
      ).catch(() => null);
      if (ready?.token === j.token && ready.pid === child.pid) {
        child.unref();
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Neue Version konnte nicht gestartet werden.');
      await sleep(200);
    }
    throw new Error('Neue Version hat den erfolgreichen Start nicht bestätigt.');
  } catch (e) {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await new Promise((r) => child!.once('exit', r));
    }
    throw e;
  }
}
async function releaseManifest(source: string) {
  if (
    (await exists(path.join(source, manifestName))) &&
    (await exists(path.join(source, manifestName + '.sig')))
  )
    return;
  const info = await readJSON<{ applicationVersion: string }>(
    path.join(source, 'resources/app/build-info.json'),
  );
  for (const name of [manifestName, manifestName + '.sig']) {
    if (await exists(path.join(source, name))) continue;
    const r = await githubFetch(releaseAssetURL(info.applicationVersion, name), {
      signal: AbortSignal.timeout(30000),
    });
    const data = Buffer.from(await r.arrayBuffer());
    if (data.length > 65536) throw new Error('Releasemanifest zu groß.');
    await writeFile(path.join(source, name), data, { flag: 'wx' });
  }
}
async function recover(root: string) {
  const j = await readJSON<UpdateJournal>(journalFile(root)).catch((e) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (!j) return;
  checkedJournal(j, root);
  if (['committed', 'rolled-back'].includes(j.phase)) return;
  // A still-starting candidate notices its dead helper and exits before exposing the UI.
  if (j.childPid && alive(j.childPid))
    throw new Error('Ein Update-Erststart läuft noch. Bitte kurz warten und erneut starten.');
  const release = await acquireLock(profileLock(j.profile));
  try {
    await rejectLegacyRunningProfile(j.profile);
    await rollback(j);
  } finally {
    await release();
  }
}
async function install(request: InstallRequest) {
  const { root, profile, previous, staged, parentPid, token } = request;
  if (
    !path.isAbsolute(root) ||
    !path.isAbsolute(profile) ||
    path.dirname(previous) !== root ||
    !staged.startsWith(root + path.sep + '.updates' + path.sep)
  )
    throw new Error('Ungültiger Installationsauftrag.');
  const releaseInstall = await acquireLock(installLock(root), token);
  let releaseProfile: (() => Promise<void>) | null = null;
  try {
    for (let n = 0; alive(parentPid) && n < 300; n++) await sleep(100);
    if (alive(parentPid)) throw new Error('Vorherige Anwendung läuft noch.');
    releaseProfile = await acquireLock(profileLock(profile), token);
    await rejectLegacyRunningProfile(profile);
    await installUpdate(
      { root, profile, previous, staged, publicKey: await publicKey(), token },
      { probe: runProbe, start: startCandidate },
    );
    await rm(path.join(root, '.update-error.json'), { force: true });
  } finally {
    await releaseProfile?.();
    await releaseInstall();
  }
}
async function bootstrap(args: string[]) {
  const root = path.resolve(args[0] ?? path.join(homedir(), '.local/opt/saltmarcher'));
  const profile = path.resolve(
    args[1] ??
      path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'),
        'CampaignWorkbench',
      ),
  );
  if (
    root === appDir ||
    root.startsWith(appDir + path.sep) ||
    profile === root ||
    profile.startsWith(root + path.sep) ||
    root.startsWith(profile + path.sep)
  )
    throw new Error('Anwendungspaket, Installation und Datenprofil müssen getrennte Ordner sein.');
  await releaseManifest(appDir);
  const manifest = await verifyStaged(appDir, await publicKey());
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(profile, { recursive: true, mode: 0o700 });
  const token = randomUUID(),
    release = await acquireLock(installLock(root), token);
  let profileRelease: (() => Promise<void>) | null = null;
  try {
    await recover(root);
    profileRelease = await acquireLock(profileLock(profile), token);
    await rejectLegacyRunningProfile(profile);
    await atomicJSON(path.join(root, '.saltmarcher-installation.json'), {
      format: 1,
      product: updateProduct,
      root,
    });
    await requireSpace(root, manifest.unpackedBytes + 3 * (await treeSize(profile)));
    const staged = path.join(root, '.updates', 'bootstrap-' + randomUUID());
    await copyApplication(appDir, staged);
    if (await exists(path.join(root, 'current'))) {
      const previous = await realpath(path.join(root, 'current'));
      await installUpdate(
        { root, profile, previous, staged, publicKey: await publicKey(), token },
        { probe: runProbe, start: startCandidate },
      );
    } else {
      if (await exists(path.join(profile, 'workbench.sqlite'))) {
        const backup = path.join(root, '.bootstrap-backups', randomUUID());
        await copyProfile(profile, path.join(backup, 'profile'));
        await copyProfile(path.join(backup, 'profile'), path.join(backup, 'trial'));
        await runProbe(staged, path.join(backup, 'trial'), manifest);
      }
      const next = path.join(root, manifest.version + '-' + manifest.commit.slice(0, 12));
      if (await exists(next)) throw new Error('Versionsordner existiert bereits.');
      await import('node:fs/promises').then((fs) => fs.rename(staged, next));
      await pointCurrent(root, next);
    }
    await atomicJSON(path.join(root, '.saltmarcher-installation.json'), {
      format: 1,
      product: updateProduct,
      root,
    });
    const applications = path.join(
      process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local/share'),
      'applications',
    );
    await mkdir(applications, { recursive: true });
    const quote = (v: string) => '"' + v.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%') + '"';
    await writeFile(
      path.join(applications, 'org.saltmarcher.desktop'),
      `[Desktop Entry]\nType=Application\nName=SaltMarcher\nExec=${quote(path.join(root, 'current/Starten.sh'))} --data-dir ${quote(profile)}\nTerminal=false\nCategories=Game;Utility;\nStartupNotify=true\n`,
    );
    console.log('SaltMarcher installiert. Start: ' + path.join(root, 'current/Starten.sh'));
  } finally {
    await profileRelease?.();
    await release();
  }
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--bootstrap') {
    await bootstrap(args);
    return;
  }
  if (mode === '--install') {
    const request = await readJSON<InstallRequest>(args[0]!);
    try {
      await install(request);
    } catch (e) {
      await atomicJSON(path.join(request.root, '.update-error.json'), {
        message: (e as Error).message,
      });
      const journal = await readJSON<UpdateJournal>(journalFile(request.root)).catch(() => null);
      if (!journal || journal.phase === 'rolled-back') {
        const child = spawn(
          path.join(request.previous, 'Starten.sh'),
          ['--data-dir', request.profile],
          { env: env(), detached: true, stdio: 'ignore' },
        );
        child.unref();
      }
      throw e;
    }
    return;
  }
  if (mode === '--launch') {
    const root = await installationRoot(path.join(appDir, 'electron'));
    if (root) {
      const release = await acquireLock(installLock(root));
      try {
        await recover(root);
      } finally {
        await release();
      }
    }
    const target = root ? await realpath(path.join(root, 'current')) : appDir;
    const child = spawn(path.join(target, 'electron'), args, { env: env(), stdio: 'inherit' });
    child.once('error', (e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
    child.once('exit', (code, signal) => {
      process.exitCode = code ?? (signal ? 1 : 0);
    });
    return;
  }
  throw new Error('Unbekannter Updatehelfer-Auftrag.');
}
void main().catch((e) => {
  console.error((e as Error).message);
  process.exitCode = 1;
});
