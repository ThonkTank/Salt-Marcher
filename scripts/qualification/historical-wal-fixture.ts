import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import { sha256 } from '../../src/shared/maintenance/files.js'
import { assertHistoricalTestIsolation } from './historical-test-isolation.js'

/** Synthetic writes only; production schema and migration SQL stay untouched. */
export async function prepareHistoricalWal(root: string) {
  assertHistoricalTestIsolation()
  const access = acquireProfileAccess(join(root, 'profile'), 'installer', root)
  const scratch = join(root, 'qualification-wal-inspection')
  try {
    mkdirSync(scratch)
    const database = join(
      access.profile,
      'campaign-data',
      'installation.sqlite'
    )
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA synchronous=FULL');
      const original = db.prepare('SELECT preferences_json FROM installation_settings WHERE singleton=1').get().preferences_json;
      const preferences = JSON.parse(original);
      assert.equal(preferences.preferences.theme, 'dark');
      const checkpointed = JSON.stringify({...preferences, preferences: {...preferences.preferences, theme: 'light'}});
      const update = db.prepare('UPDATE installation_settings SET preferences_json=? WHERE singleton=1');
      update.run(checkpointed);
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      update.run(original);
      process.stdout.write(JSON.stringify({original, checkpointed}), () => process.kill(process.pid, 'SIGKILL'));
    `,
        database
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    let output = ''
    let errors = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      errors += chunk
    })
    const deadline = setTimeout(() => child.kill('SIGKILL'), 20_000)
    let result: { code: number | null; signal: NodeJS.Signals | null }
    try {
      result = await new Promise<typeof result>((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', (code, signal) => resolve({ code, signal }))
      })
    } finally {
      clearTimeout(deadline)
    }
    assert.equal(result.code, null, errors)
    assert.equal(result.signal, 'SIGKILL', errors)
    const receipt: unknown = JSON.parse(output)
    assert(
      receipt &&
        typeof receipt === 'object' &&
        'original' in receipt &&
        'checkpointed' in receipt
    )
    const bare = join(scratch, 'bare.sqlite')
    const complete = join(scratch, 'complete.sqlite')
    cpSync(database, bare)
    cpSync(database, complete)
    cpSync(`${database}-wal`, `${complete}-wal`)
    const read = (path: string) => {
      const db = new DatabaseSync(path)
      try {
        return db
          .prepare(
            'SELECT preferences_json FROM installation_settings WHERE singleton=1'
          )
          .get()!['preferences_json']
      } finally {
        db.close()
      }
    }
    const checkpointed = read(bare)
    const recovered = read(complete)
    assert.equal(checkpointed, receipt.checkpointed)
    assert.equal(recovered, receipt.original)
    assert.notEqual(checkpointed, recovered)
    const wal = {
      bytes: statSync(`${database}-wal`).size,
      sha256: sha256(`${database}-wal`)
    }
    assert(wal.bytes > 32)
    return {
      process: { pid: child.pid, ...result },
      wal,
      checkpointed,
      recovered
    }
  } finally {
    rmSync(scratch, { recursive: true })
    access.release()
  }
}
