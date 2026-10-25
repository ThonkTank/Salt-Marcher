import {
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  lstat,
  readdir,
  chmod,
  copyFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  atomicJSON,
  copyProfile,
  exists,
  readJSON,
  requireSpace,
  sha256,
  syncDir,
  treeSize,
} from './update-files';
import {
  manifestName,
  verifyManifest,
  updateProduct,
  type UpdateManifest,
} from './update-manifest';
import { safePackageName } from './update-package';
export interface Installation {
  format: 1;
  product: typeof updateProduct;
  root: string;
}
export interface UpdateJournal {
  format: 1;
  id: string;
  root: string;
  profile: string;
  previous: string;
  next: string;
  backup: string;
  trial: string;
  retained: string;
  phase:
    | 'prepared'
    | 'backed-up'
    | 'validated'
    | 'activating'
    | 'starting'
    | 'committed'
    | 'rolling-back'
    | 'rolled-back';
  token: string;
  helperPid: number;
  childPid?: number;
  error?: string;
}
export const journalFile = (root: string) => path.join(root, '.update-journal.json');
export const profileLock = (profile: string) => profile + '.saltmarcher-update.lock';
export const installLock = (root: string) => path.join(root, '.update-lock');
export async function installationRoot(executable: string): Promise<string | null> {
  const version = path.dirname(executable),
    root = path.dirname(version);
  try {
    const m = await readJSON<Installation>(path.join(root, '.saltmarcher-installation.json'));
    if (
      m.format === 1 &&
      m.product === updateProduct &&
      m.root === root &&
      (await lstat(root)).isDirectory()
    )
      return root;
  } catch {}
  return null;
}
export async function pointCurrent(root: string, target: string) {
  if (path.dirname(target) !== root)
    throw new Error('Versionsordner liegt außerhalb der Installation.');
  const temp = path.join(root, '.current-' + randomUUID());
  await symlink(path.basename(target), temp);
  await rename(temp, path.join(root, 'current'));
  await syncDir(root);
}
export async function verifyStaged(directory: string, publicKey: string): Promise<UpdateManifest> {
  const manifest = verifyManifest(
    await readFile(path.join(directory, manifestName)),
    await readFile(path.join(directory, manifestName + '.sig')),
    publicKey,
  );
  if ((await sha256(path.join(directory, 'manifest.json'))) !== manifest.indexSha256)
    throw new Error('Paketindex wurde verändert.');
  const index = await readJSON<{
    product: string;
    version: string;
    commit: string;
    files: { name: string; bytes: number; sha256: string; mode: number }[];
  }>(path.join(directory, 'manifest.json'));
  if (
    index.product !== updateProduct ||
    index.version !== manifest.version ||
    index.commit !== manifest.commit ||
    !Array.isArray(index.files)
  )
    throw new Error('Paketidentität geändert.');
  const names = new Set<string>();
  let total = 0;
  for (const f of index.files) {
    if (!safePackageName(f.name) || names.has(f.name) || ![420, 493].includes(f.mode))
      throw new Error('Ungültiger Paketpfad.');
    names.add(f.name);
    const filename = path.join(directory, f.name);
    let parent = path.dirname(filename);
    while (parent !== directory) {
      if (!(await lstat(parent)).isDirectory())
        throw new Error('Paket enthält einen Verzeichnislink.');
      parent = path.dirname(parent);
    }
    const s = await lstat(filename);
    if (!s.isFile() || s.size !== f.bytes || (await sha256(filename)) !== f.sha256)
      throw new Error('Vorbereitetes Paket wurde verändert.');
    total += s.size;
    await chmod(filename, f.mode);
  }
  // No unlisted code, directories with symlinks, or injected native modules.
  async function walk(dir: string): Promise<void> {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name),
        name = path.relative(directory, file);
      if (e.isDirectory()) await walk(file);
      else if (
        !e.isFile() ||
        (!names.has(name) && !['manifest.json', manifestName, manifestName + '.sig'].includes(name))
      )
        throw new Error('Nicht deklarierter Paketinhalt: ' + name);
    }
  }
  await walk(directory);
  if (total !== manifest.unpackedBytes) throw new Error('Paketgröße geändert.');
  return manifest;
}
export interface InstallHooks {
  probe: (versionDir: string, profile: string, manifest: UpdateManifest) => Promise<void>;
  start: (journal: UpdateJournal) => Promise<void>;
  phase?: (journal: UpdateJournal) => Promise<void>;
}
async function save(j: UpdateJournal, h?: InstallHooks) {
  await atomicJSON(journalFile(j.root), j);
  await h?.phase?.(structuredClone(j));
}
export function checkedJournal(j: UpdateJournal, root: string) {
  if (
    j.format !== 1 ||
    j.root !== root ||
    !/^[-a-f0-9]{36}$/.test(j.id) ||
    typeof j.token !== 'string' ||
    !path.isAbsolute(j.profile) ||
    path.dirname(j.previous) !== root ||
    path.dirname(j.next) !== root ||
    j.backup !== path.join(root, '.update-backups', j.id, 'profile') ||
    j.trial !== path.join(root, '.update-backups', j.id, 'trial') ||
    j.retained !== j.profile + '.failed-update-' + j.id ||
    ![
      'prepared',
      'backed-up',
      'validated',
      'activating',
      'starting',
      'committed',
      'rolling-back',
      'rolled-back',
    ].includes(j.phase)
  )
    throw new Error('Installationsjournal ungültig. Originale bleiben erhalten.');
  return j;
}
export async function rollback(j: UpdateJournal) {
  checkedJournal(j, j.root);
  if (j.phase === 'committed' || j.phase === 'rolled-back') return;
  const changed = ['activating', 'starting', 'rolling-back'].includes(j.phase);
  if (changed) {
    j.phase = 'rolling-back';
    await save(j);
    if (!(await exists(j.backup)))
      throw new Error('Vollständige Sicherung fehlt; keine automatische Wiederherstellung.');
    const restored = j.profile + '.restoring-' + j.id;
    // Each rename is recoverable. The preserved original proves the first rename happened.
    if (!(await exists(j.retained))) {
      await rm(restored, { recursive: true, force: true });
      await copyProfile(j.backup, restored);
      await rename(j.profile, j.retained);
      await syncDir(path.dirname(j.profile));
    }
    if (!(await exists(j.profile))) {
      if (!(await exists(restored))) await copyProfile(j.backup, restored);
      await rename(restored, j.profile);
      await syncDir(path.dirname(j.profile));
    }
    await pointCurrent(j.root, j.previous);
  }
  j.phase = 'rolled-back';
  await save(j);
}
export async function installUpdate(
  input: {
    root: string;
    profile: string;
    previous: string;
    staged: string;
    publicKey: string;
    token: string;
  },
  h: InstallHooks,
) {
  const { root, profile, previous, staged, publicKey, token } = input;
  const old = await readJSON<UpdateJournal>(journalFile(root)).catch((e) => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  if (old) {
    checkedJournal(old, root);
    if (!['committed', 'rolled-back'].includes(old.phase))
      throw new Error('Vorherige Installation zuerst wiederherstellen.');
    await atomicJSON(path.join(root, '.update-history', old.id + '.json'), old);
  }
  const m = await verifyStaged(staged, publicKey),
    next = path.join(root, m.version + '-' + m.commit.slice(0, 12));
  if (await exists(next))
    throw new Error('Dieser unveränderliche Versionsordner existiert bereits.');
  await requireSpace(root, 3 * (await treeSize(profile)) + m.unpackedBytes);
  await requireSpace(path.dirname(profile), await treeSize(profile));
  const id = randomUUID(),
    base = path.join(root, '.update-backups', id);
  const j: UpdateJournal = {
    format: 1,
    id,
    root,
    profile,
    previous,
    next,
    backup: path.join(base, 'profile'),
    trial: path.join(base, 'trial'),
    retained: profile + '.failed-update-' + id,
    phase: 'prepared',
    token,
    helperPid: process.pid,
  };
  await save(j, h);
  try {
    await copyProfile(profile, j.backup + '.partial');
    await rename(j.backup + '.partial', j.backup);
    await syncDir(base);
    j.phase = 'backed-up';
    await save(j, h);
    await copyProfile(j.backup, j.trial);
    await h.probe(staged, j.trial, m);
    j.phase = 'validated';
    await save(j, h);
    // Staging is in this installation, so promotion stays on one filesystem.
    await rename(staged, next);
    await syncDir(root);
    j.phase = 'activating';
    await save(j, h);
    await pointCurrent(root, next);
    j.phase = 'starting';
    await save(j, h);
    await h.start(j);
    j.phase = 'committed';
    await save(j, h);
    return j;
  } catch (error) {
    j.error = (error as Error).message;
    await rollback(j);
    throw error;
  }
}
export async function copyApplication(source: string, dest: string) {
  await mkdir(dest, { recursive: true, mode: 0o700 });
  for (const e of await readdir(source, { withFileTypes: true })) {
    const a = path.join(source, e.name),
      b = path.join(dest, e.name);
    if (e.isDirectory()) await copyApplication(a, b);
    else if (e.isFile()) {
      await copyFile(a, b);
      await chmod(b, (await lstat(a)).mode & 0o111 ? 0o755 : 0o644);
      const h = await import('node:fs/promises').then((fs) => fs.open(b, 'r'));
      try {
        await h.sync();
      } finally {
        await h.close();
      }
    } else throw new Error('Anwendungspaket enthält Links.');
  }
  await syncDir(dest);
}
