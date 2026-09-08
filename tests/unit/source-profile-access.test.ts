import { spawnSync } from 'node:child_process'
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
  it('blocks real channel starts and the starter through an alias until asynchronous export completes', async () => {
    const alias = join(root, 'alias')
    symlinkSync(root, alias)
    let finish!: () => void
    const exporting = withSourceProfileAccess(
      root,
      join(root, 'destination'),
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const probe = (channel: string) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `
        import { openApplicationProfile } from './src/main/local-profile/application-profile.ts';
        import { acquireLaunchReservation } from './src/main/local-profile/launch-reservation.ts';
        import { ProfileLockedError } from './src/main/local-profile/local-profile-lock.ts';
        const root = process.argv[1];
        const channel = process.argv[2];
        try {
          const lease = channel === 'starter'
            ? acquireLaunchReservation(root)
            : openApplicationProfile(root + '/profile', { setPath() {} }, channel === 'development' ? undefined : root);
          lease.release();
          console.log('acquired');
        } catch (error) {
          if (!(error instanceof ProfileLockedError)) throw error;
          console.log('blocked');
        }
      `,
          alias,
          channel
        ],
        { encoding: 'utf8', timeout: 15000 }
      )
    try {
      for (const channel of ['development', 'local', 'release', 'starter']) {
        const result = probe(channel)
        expect(result.error).toBeUndefined()
        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout.trim()).toBe('blocked')
      }
    } finally {
      finish()
      await exporting
    }
    const released = probe('release')
    expect(released.error).toBeUndefined()
    expect(released.status, released.stderr).toBe(0)
    expect(released.stdout.trim()).toBe('acquired')
  })

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
