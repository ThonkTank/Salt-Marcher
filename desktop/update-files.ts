import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  lstat,
  readdir,
  copyFile,
  chmod,
  statfs,
  readlink,
} from 'node:fs/promises';
import path from 'node:path';
export async function exists(file: string) {
  try {
    await lstat(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
export async function syncDir(dir: string) {
  const h = await open(dir, 'r');
  try {
    await h.sync();
  } finally {
    await h.close();
  }
}
export async function atomicJSON(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomUUID();
  const h = await open(temp, 'wx', 0o600);
  try {
    await h.writeFile(JSON.stringify(value) + '\n');
    await h.sync();
  } finally {
    await h.close();
  }
  await rename(temp, file);
  await syncDir(path.dirname(file));
}
export async function readJSON<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8'));
}
export function alive(pid: number) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}
export interface Lease {
  pid: number;
  token: string;
}
/** Kernel lock survives competing recoveries and is released when the owner pipe closes.
 * util-linux flock is part of the supported Linux installation prerequisites. Never unlink
 * the .guard inode: waiters must all contend on the same kernel lock. */
export async function acquireLock(
  file: string,
  token: string = randomUUID(),
): Promise<() => Promise<void>> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const child = spawn(
    'flock',
    [
      '--exclusive',
      '--nonblock',
      file + '.guard',
      process.execPath,
      '-e',
      "process.stdout.write('ready\\n');process.stdin.resume();process.stdin.on('end',()=>process.exit(0));",
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (b) => {
    stderr = (stderr + b).slice(-2000);
  });
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', () =>
        reject(new Error('Für sichere Linux-Updates wird util-linux flock benötigt.')),
      );
      child.once('exit', () =>
        reject(new Error('SaltMarcher oder eine Installation läuft bereits. ' + stderr)),
      );
      child.stdout.once('data', () => resolve());
    });
    await atomicJSON(file, { pid: process.pid, token });
  } catch (e) {
    child.stdin.end();
    throw e;
  }
  return async () => {
    try {
      const value = await readJSON<Lease>(file);
      if (value.token === token) {
        await rm(file);
        await syncDir(path.dirname(file));
      }
    } finally {
      child.stdin.end();
      await exited;
    }
  };
}
export async function sha256(file: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function treeSize(dir: string): Promise<number> {
  let size = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) size += await treeSize(file);
    else if (entry.isFile()) size += (await lstat(file)).size;
    else if (!transientProfileName(entry.name))
      throw new Error('Profilsicherung enthält einen nicht unterstützten Link: ' + entry.name);
  }
  return size;
}
export const transientProfileName = (name: string) =>
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket', '.saltmarcher-profile.lock'].includes(
    name,
  );
/** Closed profiles only. Never follow links into another profile or user directory. */
export async function copyProfile(from: string, to: string) {
  await mkdir(to, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (transientProfileName(entry.name)) continue;
    const source = path.join(from, entry.name),
      dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyProfile(source, dest);
    else if (entry.isFile()) {
      await copyFile(source, dest);
      await chmod(dest, 0o600);
      const h = await open(dest, 'r');
      try {
        await h.sync();
      } finally {
        await h.close();
      }
    } else throw new Error('Profilsicherung benötigt eine reguläre Datei: ' + entry.name);
  }
  await syncDir(to);
}
export async function requireSpace(dir: string, bytes: number) {
  const s = await statfs(dir);
  if (s.bavail * s.bsize < bytes + 128 * 1024 ** 2)
    throw new Error('Nicht genügend freier Speicher für Update und Sicherung.');
}
export async function rejectLegacyRunningProfile(profile: string) {
  const target = await readlink(path.join(profile, 'SingletonLock')).catch((e) => {
    if (e.code === 'ENOENT' || e.code === 'EINVAL') return '';
    throw e;
  });
  const pid = Number(target.split('-').at(-1));
  if (pid && alive(pid))
    throw new Error('SaltMarcher zuerst regulär schließen. Das Datenprofil wird noch verwendet.');
}
