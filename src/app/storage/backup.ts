import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateBackupCandidate } from './snapshot-validation';

export async function writeBackup(
  db: Pick<InstanceType<typeof Database>, 'backup'>,
  filename: string,
  isCurrent: () => boolean,
  validateCandidate?: (filename: string) => Promise<void>,
) {
  const candidate = filename + '.candidate-' + randomUUID();
  try {
    await db.backup(candidate);
    if (validateCandidate) await validateCandidate(candidate);
    else validateBackupCandidate(candidate);
    const fd = openSync(candidate, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    if (!isCurrent()) throw new Error('Wiederherstellungskopie durch Löschung überholt.');
    renameSync(candidate, filename);
    const directory = openSync(dirname(filename), 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  } catch (error) {
    rmSync(candidate, { force: true });
    throw error;
  } finally {
    // Read-only validation of a WAL-mode copy can create these sidecars too.
    // The unique candidate is closed and never shared with another connection.
    for (const suffix of ['-wal', '-shm']) rmSync(candidate + suffix, { force: true });
  }
}
