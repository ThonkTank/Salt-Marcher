import { spawn } from 'node:child_process';
import { readFile, realpath, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { acquireLock, alive, atomicJSON, exists, readJSON, type Lease } from './update-files';
import {
  checkedJournal,
  installationRoot,
  installLock,
  journalFile,
  profileLock,
  type UpdateJournal,
} from './update-install';
import type { DownloadedUpdate } from './update-service';
export async function openUpdateRuntime(executable: string, profile: string) {
  const root =
      process.platform === 'linux' && process.arch === 'x64'
        ? await installationRoot(executable)
        : null,
    token = process.env.SALTMARCHER_UPDATE_TOKEN;
  let release: (() => Promise<void>) | null = null;
  let transaction: UpdateJournal | null = null;
  if (root && (await exists(installLock(root)))) {
    const lock = await readJSON<Lease>(installLock(root));
    if (token && lock.token === token && alive(lock.pid)) {
      transaction = checkedJournal(await readJSON<UpdateJournal>(journalFile(root)), root);
      if (
        transaction.phase !== 'starting' ||
        transaction.token !== token ||
        transaction.profile !== profile ||
        transaction.next !== path.dirname(executable)
      )
        throw new Error('Update-Erststart gehört nicht zu dieser Installation.');
    } else
      throw new Error(
        'Installation läuft oder wurde unterbrochen. SaltMarcher über Starten.sh erneut öffnen.',
      );
  }
  if (root && !transaction) {
    const journal = await readJSON<UpdateJournal>(journalFile(root)).catch((e) => {
      if (e.code === 'ENOENT') return null;
      throw e;
    });
    if (journal && !['committed', 'rolled-back'].includes(checkedJournal(journal, root).phase))
      throw new Error('Unterbrochenes Update. SaltMarcher über Starten.sh wiederherstellen.');
  }
  if (!transaction && process.platform === 'linux')
    release = await acquireLock(profileLock(profile));
  return {
    root,
    transaction,
    async ready() {
      if (!transaction) return;
      await atomicJSON(path.join(root!, '.update-ready'), { token, pid: process.pid });
      for (let n = 0; n < 600; n++) {
        const j = checkedJournal(await readJSON<UpdateJournal>(journalFile(root!)), root!);
        if (j.token !== token) throw new Error('Updateauftrag hat sich geändert.');
        if (j.phase === 'committed' && !(await exists(profileLock(profile)))) {
          try {
            release = await acquireLock(profileLock(profile));
            return;
          } catch {
            /* Kernel lease may still be draining its owner pipe. */
          }
        }
        if (
          j.phase === 'rolled-back' ||
          j.phase === 'rolling-back' ||
          (!alive(j.helperPid) && j.phase !== 'committed')
        )
          throw new Error('Updatehelfer wurde beendet; Start bleibt gesperrt.');
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error('Updatefreigabe fehlt.');
    },
    async close() {
      await release?.();
      release = null;
    },
    async prepare(update: DownloadedUpdate) {
      if (!root) throw new Error('Diese Installation unterstützt keine In-App-Updates.');
      await access(root, constants.W_OK);
      if (await exists(installLock(root))) throw new Error('Eine Installation läuft bereits.');
      const previous = await realpath(path.join(root, 'current'));
      if (previous !== path.dirname(executable))
        throw new Error('Aktive Installation wurde inzwischen geändert. Bitte neu starten.');
      const file = path.join(root, '.updates', 'request-' + randomUUID() + '.json');
      await mkdir(path.dirname(file), { recursive: true });
      await atomicJSON(file, {
        root,
        profile,
        previous,
        staged: update.directory,
        parentPid: process.pid,
        token: randomUUID(),
      });
      return file;
    },
    async handoff(file: string) {
      const child = spawn(
        executable,
        [path.join(path.dirname(executable), 'resources/app/update-helper.cjs'), '--install', file],
        { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, detached: true, stdio: 'ignore' },
      );
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      child.unref();
    },
    async publicKey() {
      return readFile(
        path.join(path.dirname(executable), 'resources/app/update-public-key.pem'),
        'utf8',
      );
    },
  };
}
