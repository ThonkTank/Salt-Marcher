import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { z } from 'zod'
import { durableJson } from '../../../src/shared/maintenance/files.js'

// Only included by the explicit historical test artifact build option.
const home = process.env['XDG_DATA_HOME']
const enabled = process.env['SALT_MARCHER_HISTORICAL_UI'] === 'true'
if (enabled && home && isAbsolute(home)) {
  const root = join(home, 'salt-marcher')
  const armPath = join(root, 'qualification-maintenance-crash.json')
  if (existsSync(armPath)) {
    const arm = z
      .object({ id: z.uuid() })
      .strict()
      .parse(JSON.parse(readFileSync(armPath, 'utf8')))
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Original is explicitly rebound to the same database with call below.
    const original = Database.prototype.exec
    Database.prototype.exec = function (sql: string) {
      const result = original.call(this, sql)
      if (
        sql.includes('CREATE TABLE IF NOT EXISTS loot_operation_receipt') &&
        this.inTransaction &&
        this.pragma('user_version', { simple: true }) === 41
      ) {
        const path = relative(root, this.name).split(sep).join('/')
        if (!/^staged-[a-f0-9-]{36}\/campaign-data\/campaigns\//.test(path))
          throw new Error(
            'Maintenance interruption requires an isolated staged campaign'
          )
        durableJson(join(root, 'qualification-maintenance-boundary.json'), {
          id: arm.id,
          pid: process.pid,
          database: path,
          inTransaction: true,
          fromVersion: 41,
          point: 'after-original-loot-receipt-ddl'
        })
        // Parent must kill this exact PID. A timeout is a test failure, never success.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000)
        throw new Error('Expected parent SIGKILL did not arrive')
      }
      return result
    }
  }
}
await import(new URL('./maintenance-original.js', import.meta.url).href)
