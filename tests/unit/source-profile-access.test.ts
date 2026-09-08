import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withSourceProfileAccess } from '../../src/main/local-profile/source-profile-access.js'
import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import { acquireLaunchReservation } from '../../src/main/local-profile/launch-reservation.js'
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'salt-source-access-'))
  mkdirSync(join(root, 'profile'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
describe('exclusive asynchronous source export', () => {
  it('holds runtime and launch leases until the export promise resolves', async () => {
    let finish!: () => void
    const exporting = withSourceProfileAccess(
      root,
      join(root, 'destination'),
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    expect(() =>
      acquireProfileAccess(join(root, 'profile'), 'application', root)
    ).toThrow()
    expect(() => acquireLaunchReservation(root)).toThrow()
    finish()
    await exporting
    acquireProfileAccess(join(root, 'profile'), 'application', root).release()
    acquireLaunchReservation(root).release()
  })
  it('releases its leases after export failure', async () => {
    await expect(
      withSourceProfileAccess(root, join(root, 'destination'), () =>
        Promise.reject(new Error('failed export'))
      )
    ).rejects.toThrow('failed export')
    acquireProfileAccess(join(root, 'profile'), 'application', root).release()
    acquireLaunchReservation(root).release()
  })
  it.each(['alias', 'nested', 'parent'])(
    'rejects overlapping %s profiles before invoking the exporter',
    async (kind) => {
      const alias = join(root, 'alias')
      symlinkSync(join(root, 'profile'), alias)
      const target =
        kind === 'alias'
          ? alias
          : kind === 'nested'
            ? join(alias, 'inside')
            : root
      const exporter = vi.fn(() => Promise.resolve())
      await expect(
        withSourceProfileAccess(root, target, exporter)
      ).rejects.toThrow('getrennte Profile')
      expect(exporter).not.toHaveBeenCalled()
    }
  )
  it('releases the launch lease when a source application already owns the profile', async () => {
    const app = acquireProfileAccess(join(root, 'profile'), 'application', root)
    try {
      await expect(
        withSourceProfileAccess(root, join(root, 'destination'), () =>
          Promise.resolve()
        )
      ).rejects.toThrow()
      acquireLaunchReservation(root).release()
    } finally {
      app.release()
    }
  })
})
