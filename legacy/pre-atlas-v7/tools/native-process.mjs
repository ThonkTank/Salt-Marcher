import { readFile, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

/** Register only this run's success path with its outer process owner. The
 * temporary registry is removed when ui-session exits; it is not a test ledger. */
export async function registerNativeEvidence(file) {
  const registry = process.env.CODEX_UI_EVIDENCE_REGISTRY;
  if (registry)
    await writeFile(
      path.join(registry, randomUUID() + '.json'),
      JSON.stringify({ file: path.resolve(file) }),
    );
}

// Complete compiled runtime used by ordinary, copied and packaged UI probes.
export const nativeRuntimeArtifacts = Object.freeze([
  'main.cjs',
  'preload.cjs',
  'player-preload.cjs',
  'store-worker.cjs',
  'atlas-region-worker.cjs',
  'room-directory-worker.cjs',
  'terrain-route-worker.cjs',
  'backup-validation-worker.cjs',
  'update-helper.cjs',
  'update-probe.cjs',
  'ui/renderer.js',
  'ui/atlas-brush-worker.js',
  'ui/atlas-deck-runtime.js',
  'ui/preset-settings.js',
  'ui/index.html',
  'ui/app.css',
  'ui/player-display.js',
  'ui/player-display.html',
  'ui/player.css',
  'ui/preset-settings.css',
]);

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function bounded(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function observeExit(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
}
export async function pidAbsent(pid, timeout = 3000) {
  const deadline = Date.now() + timeout;
  do {
    try {
      await stat('/proc/' + pid);
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      throw error;
    }
    if (Date.now() >= deadline) throw Error('Owned native PID remains: ' + pid);
    await delay(20);
  } while (true);
}
export async function ownsProfile(child, profile) {
  if (!child?.pid) return false;
  const args = (await readFile('/proc/' + child.pid + '/cmdline').catch(() => Buffer.alloc(0)))
    .toString()
    .split('\0')
    .filter(Boolean);
  const index = args.indexOf('--data-dir');
  if (index !== -1 && args[index + 1] === profile) return true;
  // Electron rewrites its Linux process title into one argv field and moves
  // the runtime entry before the final profile. Match that complete suffix,
  // never an arbitrary profile substring or another process discovered by name.
  return args.length === 1 && args[0].includes(' --data-dir ') && args[0].endsWith(' ' + profile);
}
/** Only a previously registered ChildProcess may be passed. Profile-based
 * ownership is additionally required for emergency Electron termination. */
export async function stopOwnedChild(child, { owns = async () => true, timeout = 3000 } = {}) {
  if (!child?.pid) return { started: false };
  const exited = observeExit(child);
  let forced = false;
  if (child.exitCode === null && child.signalCode === null) {
    if (!(await owns(child))) throw Error('Refusing cleanup without native process ownership');
    child.kill('SIGTERM');
    try {
      await bounded(exited, timeout, 'Owned process did not terminate');
    } catch {
      if (!(await owns(child))) throw Error('Native process ownership changed during cleanup');
      forced = true;
      child.kill('SIGKILL');
    }
  }
  const exit = await bounded(exited, timeout, 'Owned process did not exit after cleanup');
  await pidAbsent(child.pid, timeout);
  return { pid: child.pid, exit, pidAbsent: true, forced };
}

async function processIdentity(pid) {
  const value = await readFile('/proc/' + pid + '/stat', 'utf8');
  return value.slice(value.lastIndexOf(')') + 2).split(' ')[19];
}
/** Explicit adapter for a child started by the application updater, not by
 * Playwright. Capture identity while it is live; never rediscover by name. */
export async function registerOwnedPid(pid, profile) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !(await ownsProfile({ pid }, profile)))
    throw Error('Cannot register native PID without exact profile ownership');
  return { pid, profile, identity: await processIdentity(pid) };
}
export async function stopRegisteredPid(owner, timeout = 3000) {
  if (!owner) return { started: false };
  const owns = async () => {
    try {
      return (
        (await processIdentity(owner.pid)) === owner.identity &&
        (await ownsProfile(owner, owner.profile))
      );
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  };
  try {
    await pidAbsent(owner.pid, 1);
    return { pid: owner.pid, pidAbsent: true, forced: false };
  } catch {}
  if (!(await owns())) throw Error('External native PID ownership changed');
  process.kill(owner.pid, 'SIGTERM');
  let forced = false;
  try {
    await pidAbsent(owner.pid, timeout);
  } catch {
    if (!(await owns())) throw Error('External native PID ownership changed during cleanup');
    forced = true;
    process.kill(owner.pid, 'SIGKILL');
    await pidAbsent(owner.pid, timeout);
  }
  return { pid: owner.pid, pidAbsent: true, forced };
}

/** Private filtered bus shared by standard and packaged native adapters. */
export async function startNativeBus(profile) {
  const { spawn } = await import('node:child_process');
  const path = await import('node:path');
  if (!process.env.DBUS_SESSION_BUS_ADDRESS) throw Error('Native session bus missing');
  const socket = path.join(profile, 'bus');
  const child = spawn(
    'xdg-dbus-proxy',
    [
      process.env.DBUS_SESSION_BUS_ADDRESS,
      socket,
      '--filter',
      '--talk=org.freedesktop.portal.Desktop',
      '--talk=org.freedesktop.Notifications',
    ],
    { stdio: 'ignore' },
  );
  let launchError;
  child.on('error', (error) => {
    launchError = error;
  });
  try {
    for (let i = 0; i < 100; i++) {
      if (launchError) throw launchError;
      if (await stat(socket).catch(() => null)) return { child, address: 'unix:path=' + socket };
      if (child.exitCode !== null) throw Error('Native bus proxy exited');
      await delay(20);
    }
    throw Error('Native bus proxy did not start');
  } catch (error) {
    await stopOwnedChild(child);
    throw error;
  }
}
