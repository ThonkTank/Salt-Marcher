import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, isAbsolute, join, basename } from 'node:path'
import { z } from 'zod'
import { maintenanceJournalSchema } from '../../../src/shared/contracts/maintenance.js'

// Loaded only by the historical test bootstrap, never by the normal release.
const home = process.env['XDG_DATA_HOME']
if (
  process.env['SALT_MARCHER_HISTORICAL_UI'] === 'true' &&
  home &&
  isAbsolute(home)
) {
  const root = join(home, 'salt-marcher')
  const armPath = join(root, 'qualification-publication-crash.json')
  if (fs.existsSync(armPath)) {
    const arm = z
      .object({
        id: z.uuid(),
        point: z.string().min(1)
      })
      .strict()
      .parse(JSON.parse(fs.readFileSync(armPath, 'utf8')))
    const original = {
      open: fs.openSync,
      close: fs.closeSync,
      rename: fs.renameSync,
      sync: fs.fsyncSync
    }
    const descriptors = new Map<number, string>()
    let pending: { directory: string; point: string } | null = null
    fs.openSync = (...args) => {
      const fd = original.open(...args)
      if (typeof args[0] === 'string') descriptors.set(fd, args[0])
      return fd
    }
    fs.closeSync = (fd) => {
      try {
        original.close(fd)
      } finally {
        descriptors.delete(fd)
      }
    }
    fs.renameSync = (source, target) => {
      original.rename(source, target)
      if (
        typeof source !== 'string' ||
        typeof target !== 'string'
      )
        return
      const history = join(root, 'maintenance-history')
      if (dirname(target) === history) {
        const journal = maintenanceJournalSchema.parse(
          JSON.parse(
            fs.readFileSync(join(root, 'maintenance-journal.json'), 'utf8')
          )
        )
        if (
          journal.formatVersion === 3 &&
          journal.phase === 'rollback-program' &&
          target === join(history, `${journal.id}-rolled-back.json`)
        ) {
          pending = { directory: history, point: 'rollback-history-written' }
        }
        return
      }
      if (dirname(target) !== root) return
      let point: string | null = null
      if (target === join(root, 'maintenance-journal.json')) {
        const journal = maintenanceJournalSchema.parse(
          JSON.parse(fs.readFileSync(target, 'utf8'))
        )
        point = `journal:${journal.phase}`
      } else if (
        source === join(root, 'profile') &&
        basename(target).startsWith('previous-')
      )
        point = 'old-data-moved'
      else if (
        target === join(root, 'profile') &&
        dirname(source) === root &&
        basename(source).startsWith('staged-')
      )
        point = 'new-data-moved'
      else if (
        source === join(root, 'profile') &&
        basename(target).startsWith('failed-')
      )
        point = 'failed-data-preserved'
      else if (
        target === join(root, 'profile') &&
        dirname(source) === root &&
        basename(source).startsWith('previous-')
      )
        point = 'old-data-restored'
      else if (target === join(root, 'current')) point = 'program-linked'
      if (point) pending = { directory: root, point }
    }
    fs.fsyncSync = (fd) => {
      original.sync(fd)
      if (!pending || descriptors.get(fd) !== pending.directory) return
      const event = pending
      pending = null
      if (event.point !== arm.point) return
      const journal = maintenanceJournalSchema.parse(
        JSON.parse(
          fs.readFileSync(join(root, 'maintenance-journal.json'), 'utf8')
        )
      )
      fs.writeFileSync(
        join(root, 'qualification-publication-boundary.json'),
        JSON.stringify({
          id: arm.id,
          point: event.point,
          pid: process.pid,
          journal
        }),
        { flag: 'wx' }
      )
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000)
      throw new Error('Expected publication SIGKILL did not arrive')
    }
    syncBuiltinESMExports()
  }
}
