import { spawnSync } from 'node:child_process'
import {
  acquireProfileAccess,
  assertProfileAccessOwner
} from '../../src/main/local-profile/profile-access.js'
import {
  canonicalProfilePath,
  prepareProfileDirectory
} from '../../src/shared/maintenance/profile-path.js'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  renameSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  acquireProfileLock,
  assertProfileLockOwner,
  ProfileLockedError
} from '../../src/main/local-profile/local-profile-lock.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('shared Local profile lock', () => {
  it('makes an application owner block the installer and releases by token', () => {
    const fixture = createFixture()
    writeProcess(fixture.proc, 101, '1000')
    const application = acquireProfileLock(fixture.lock, 'application', {
      procRoot: fixture.proc,
      pid: 101
    })

    expect(() =>
      acquireProfileLock(fixture.lock, 'installer', {
        procRoot: fixture.proc,
        pid: 101
      })
    ).toThrowError(ProfileLockedError)
    expect(readFileSync(fixture.lock, 'utf8')).toContain('"application"')

    application.release()
    expect(existsSync(fixture.lock)).toBe(false)
  })

  it('reclaims a lock only after the recorded process identity is stale', () => {
    const fixture = createFixture()
    writeProcess(fixture.proc, 101, '1000')
    const abandoned = acquireProfileLock(fixture.lock, 'application', {
      procRoot: fixture.proc,
      pid: 101
    })
    writeProcess(fixture.proc, 101, '2000')
    writeProcess(fixture.proc, 202, '3000')

    const installer = acquireProfileLock(fixture.lock, 'installer', {
      procRoot: fixture.proc,
      pid: 202
    })
    expect(readFileSync(fixture.lock, 'utf8')).toContain('"installer"')

    abandoned.release()
    expect(existsSync(fixture.lock)).toBe(true)
    installer.release()
    expect(existsSync(fixture.lock)).toBe(false)
  })

  it('does not delete malformed lock evidence whose owner cannot be proven stale', () => {
    const fixture = createFixture()
    writeProcess(fixture.proc, 101, '1000')
    writeFileSync(fixture.lock, 'untrusted lock contents')

    expect(() =>
      acquireProfileLock(fixture.lock, 'installer', {
        procRoot: fixture.proc,
        pid: 101
      })
    ).toThrowError(ProfileLockedError)
    expect(readFileSync(fixture.lock, 'utf8')).toBe('untrusted lock contents')
  })
})

function createFixture(): { root: string; proc: string; lock: string } {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-profile-lock-'))
  roots.push(root)
  const proc = join(root, 'proc')
  mkdirSync(join(proc, 'sys/kernel/random'), { recursive: true })
  writeFileSync(join(proc, 'sys/kernel/random/boot_id'), 'test-boot\n')
  return { root, proc, lock: join(root, 'runtime.lock') }
}

function writeProcess(proc: string, pid: number, startTicks: string): void {
  const directory = join(proc, String(pid))
  mkdirSync(directory, { recursive: true })
  const fields = Array.from({ length: 20 }, () => '0')
  fields[0] = 'S'
  fields[19] = startTicks
  writeFileSync(
    join(directory, 'stat'),
    `${pid} (salt marcher) ${fields.join(' ')}`
  )
  writeFileSync(join(directory, 'cmdline'), `/test/salt-marcher\0--flag\0`)
}

describe.skipIf(process.platform !== 'linux')(
  'canonical profile access',
  () => {
    function fixture() {
      const root = mkdtempSync(join(tmpdir(), 'salt-profile-access-'))
      roots.push(root)
      const real = prepareProfileDirectory(join(root, 'real'))
      const alias = join(root, 'alias')
      symlinkSync(real, alias)
      return { root, real, alias }
    }

    it('requires both parent leases before delegating maintenance', () => {
      const { real, alias } = fixture()
      const profile = join(real, 'profile')
      const canonicalOnly = acquireProfileAccess(profile, 'application')
      try {
        expect(() =>
          assertProfileAccessOwner(join(alias, 'profile'), process.pid, alias)
        ).toThrow()
      } finally {
        canonicalOnly.release()
      }
      const complete = acquireProfileAccess(profile, 'application', real)
      try {
        expect(() =>
          assertProfileAccessOwner(join(alias, 'profile'), process.pid, alias)
        ).not.toThrow()
      } finally {
        complete.release()
      }
    })

    it('resolves aliases before the profile exists and blocks another channel', () => {
      const { real, alias } = fixture()
      expect(canonicalProfilePath(join(alias, 'profile'))).toBe(
        join(real, 'profile')
      )
      const application = acquireProfileAccess(
        join(alias, 'profile'),
        'application'
      )
      try {
        expect(() =>
          acquireProfileAccess(join(real, 'profile'), 'installer')
        ).toThrow(ProfileLockedError)
      } finally {
        application.release()
      }
      const next = acquireProfileAccess(join(real, 'profile'), 'installer')
      next.release()
    })

    it('rejects a real second process through a symlink alias', () => {
      const { real, alias } = fixture()
      const application = acquireProfileAccess(
        join(real, 'profile'),
        'application'
      )
      try {
        const child = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
        import { acquireProfileAccess, assertProfileAccessOwner } from './src/main/local-profile/profile-access.ts';
        import { ProfileLockedError } from './src/main/local-profile/local-profile-lock.ts';
        try {
          const lease = acquireProfileAccess(process.argv[1], 'installer');
          lease.release();
          process.exitCode = 2;
        } catch (error) {
          if (!(error instanceof ProfileLockedError)) throw error;
          console.log('blocked-by-profile-owner');
        }
      `,
            join(alias, 'profile')
          ],
          { encoding: 'utf8', timeout: 15_000 }
        )
        expect(child.error).toBeUndefined()
        expect(child.status, child.stderr).toBe(0)
        expect(child.stdout.trim()).toBe('blocked-by-profile-owner')
      } finally {
        application.release()
      }
    })

    it('keeps the lease outside a replaced profile and leaves siblings independent', () => {
      const { real } = fixture()
      const profile = prepareProfileDirectory(join(real, 'profile'))
      const application = acquireProfileAccess(profile, 'application')
      const sibling = acquireProfileAccess(join(real, 'other'), 'application')
      try {
        renameSync(profile, join(real, 'previous'))
        prepareProfileDirectory(profile)
        expect(() => acquireProfileAccess(profile, 'installer')).toThrow(
          ProfileLockedError
        )
        expect(existsSync(application.path)).toBe(true)
      } finally {
        sibling.release()
        application.release()
      }
    })

    it('honors an older application lease and cleans up a failed composite acquisition', () => {
      const { real, alias } = fixture()
      const old = acquireProfileLock(join(real, 'runtime.lock'), 'application')
      try {
        expect(() =>
          acquireProfileAccess(join(alias, 'profile'), 'installer', alias)
        ).toThrow(ProfileLockedError)
        const independent = acquireProfileAccess(
          join(real, 'profile'),
          'application'
        )
        independent.release()
      } finally {
        old.release()
      }
    })
  }
)

describe('maintenance parent admission', () => {
  it('accepts the exact live owner and rejects a reused PID without changing the lock', () => {
    const fixture = createFixture()
    writeProcess(fixture.proc, 101, '1000')
    const lease = acquireProfileLock(fixture.lock, 'application', {
      procRoot: fixture.proc,
      pid: 101
    })
    const before = readFileSync(fixture.lock, 'utf8')
    try {
      expect(() =>
        assertProfileLockOwner(fixture.lock, 101, 'application', {
          procRoot: fixture.proc
        })
      ).not.toThrow()
      expect(() =>
        assertProfileLockOwner(fixture.lock, 101, 'installer', {
          procRoot: fixture.proc
        })
      ).toThrow()
      expect(() =>
        assertProfileLockOwner(fixture.lock, 102, 'application', {
          procRoot: fixture.proc
        })
      ).toThrow()
      writeProcess(fixture.proc, 101, '2000')
      expect(() =>
        assertProfileLockOwner(fixture.lock, 101, 'application', {
          procRoot: fixture.proc
        })
      ).toThrow()
      expect(readFileSync(fixture.lock, 'utf8')).toBe(before)
    } finally {
      lease.release()
    }
  })

  it('rejects missing and malformed parent leases without repairing them', () => {
    const fixture = createFixture()
    writeProcess(fixture.proc, 101, '1000')
    expect(() =>
      assertProfileLockOwner(fixture.lock, 101, 'application', {
        procRoot: fixture.proc
      })
    ).toThrow()
    expect(existsSync(fixture.lock)).toBe(false)
    writeFileSync(fixture.lock, JSON.stringify({ pid: 101 }))
    expect(() =>
      assertProfileLockOwner(fixture.lock, 101, 'application', {
        procRoot: fixture.proc
      })
    ).toThrow()
    expect(readFileSync(fixture.lock, 'utf8')).toBe(
      JSON.stringify({ pid: 101 })
    )
  })
})
