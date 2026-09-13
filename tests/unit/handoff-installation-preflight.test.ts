import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { acquireProfileAccess } from '../../src/main/local-profile/profile-access.js'
import { acquireProfileLock } from '../../src/main/local-profile/local-profile-lock.js'
import { acquireLaunchReservation } from '../../src/main/local-profile/launch-reservation.js'
import { profileAccessPaths } from '../../src/shared/maintenance/profile-path.js'
import { localInstallationPaths } from '../../scripts/local-installation/contract.js'
import {
  assertLocalInstallationAvailable,
  readLocalInstallationAvailability,
  withInstallationLock
} from '../../scripts/local-installation/installation-lock.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'handoff-admission-'))
  roots.push(root)
  const xdg = join(root, 'xdg')
  const paths = localInstallationPaths(xdg)
  mkdirSync(paths.profile, { recursive: true })
  return { root, xdg, paths }
}

describe.skipIf(process.platform !== 'linux')(
  'installation admission from shared profile identity',
  () => {
    it('does not create lock directories while inspecting an unused installation', () => {
      const f = fixture()
      expect(readLocalInstallationAvailability(f.paths)).toEqual({
        status: 'free'
      })
      expect(readdirSync(f.paths.root)).toEqual(['profile'])
    })

    it.each(['application', 'launcher'] as const)(
      'recognizes %s ownership through aliases and unrelated executable names',
      (kind) => {
        const f = fixture()
        const alias = join(f.root, 'alias')
        symlinkSync(f.xdg, alias)
        const aliased = localInstallationPaths(alias)
        const lease =
          kind === 'application'
            ? acquireProfileAccess(aliased.profile, 'application', aliased.root)
            : acquireLaunchReservation(aliased.root)
        try {
          expect(readLocalInstallationAvailability(f.paths).status).toBe('busy')
          expect(
            readLocalInstallationAvailability({
              ...aliased,
              appImage: join(f.root, 'another-deployment.AppImage')
            }).status
          ).toBe('busy')
          expect(() => assertLocalInstallationAvailable(f.paths)).toThrow(
            /occupied/
          )
        } finally {
          lease.release()
        }
        expect(readLocalInstallationAvailability(f.paths)).toEqual({
          status: 'free'
        })
      }
    )

    it.each(['runtime.lock', 'launch.lock'])(
      'honors the compatible legacy %s lease',
      (name) => {
        const f = fixture()
        const lease = acquireProfileLock(
          join(f.paths.root, name),
          'application'
        )
        try {
          expect(readLocalInstallationAvailability(f.paths).status).toBe('busy')
        } finally {
          lease.release()
        }
      }
    )

    it('preserves unknown evidence and refuses admission', () => {
      const f = fixture()
      writeFileSync(f.paths.lock, 'invalid')
      expect(readLocalInstallationAvailability(f.paths)).toEqual({
        status: 'unknown',
        lockPath: f.paths.lock
      })
      expect(() => assertLocalInstallationAvailable(f.paths)).toThrow(
        /Cannot reliably determine/
      )
      expect(readFileSync(f.paths.lock, 'utf8')).toBe('invalid')
      expect(readdirSync(f.paths.root).sort()).toEqual([
        'profile',
        'runtime.lock'
      ])
    })

    it('does not admit a live owner merely because another lock is unknown', () => {
      const f = fixture()
      writeFileSync(f.paths.lock, 'invalid')
      const lease = acquireProfileAccess(f.paths.profile, 'application')
      try {
        expect(readLocalInstallationAvailability(f.paths).status).toBe('busy')
      } finally {
        lease.release()
      }
    })

    it('keeps the final lease authoritative when the application starts after preflight', () => {
      const f = fixture()
      assertLocalInstallationAvailable(f.paths)
      const lease = acquireProfileAccess(
        f.paths.profile,
        'application',
        f.paths.root
      )
      let writes = 0
      try {
        expect(() =>
          withInstallationLock(f.paths, () => {
            writes++
          })
        ).toThrow(/profile lock/)
        expect(writes).toBe(0)
      } finally {
        lease.release()
      }
      withInstallationLock(f.paths, () => {
        writes++
      })
      expect(writes).toBe(1)
    })

    function frontDoor(root: string, downstreamStub = false) {
      const workspace = join(root, 'workspace')
      const source = process.cwd()
      mkdirSync(workspace)
      const pkg = JSON.parse(
        readFileSync(join(source, 'package.json'), 'utf8')
      ) as {
        version: string
        packageManager: string
        scripts: Record<string, string>
      }
      writeFileSync(
        join(workspace, 'package.json'),
        JSON.stringify({
          name: 'handoff-entry-fixture',
          version: pkg.version,
          packageManager: pkg.packageManager,
          scripts: { 'handoff:app': pkg.scripts['handoff:app'] }
        })
      )
      symlinkSync(join(source, 'node_modules'), join(workspace, 'node_modules'))
      if (downstreamStub) {
        mkdirSync(join(workspace, 'scripts'))
        symlinkSync(
          resolve(source, 'scripts/run-handoff.ts'),
          join(workspace, 'scripts/run-handoff.ts')
        )
        writeFileSync(
          join(workspace, 'scripts/handoff-local-app.ts'),
          `
        const args = process.argv.slice(2)
        if (JSON.stringify(args) !== JSON.stringify(['--resume'])) throw new Error('Resume was not forwarded')
        console.log('canonical-resume-forwarded')
      `
        )
      } else symlinkSync(join(source, 'scripts'), join(workspace, 'scripts'))
      return workspace
    }

    it('accepts the documented package command and forwards resume through the real front door', () => {
      const f = fixture()
      const workspace = frontDoor(f.root, true)
      const result = spawnSync(
        'corepack',
        ['pnpm', 'handoff:app', '--resume'],
        {
          cwd: workspace,
          env: { ...process.env, XDG_DATA_HOME: f.xdg },
          encoding: 'utf8',
          timeout: 30_000
        }
      )
      expect(result.error).toBeUndefined()
      expect(result.status, result.stdout + result.stderr).toBe(0)
      expect(result.stdout).toContain('canonical-resume-forwarded')
    })

    it.each(['busy', 'unknown'] as const)(
      'rejects %s in the actual canonical entrypoint before qualification, download or attempt files',
      (state) => {
        const f = fixture()
        const workspace = frontDoor(f.root)
        const lease =
          state === 'busy' ? acquireLaunchReservation(f.paths.root) : null
        if (state === 'unknown') writeFileSync(f.paths.lock, 'invalid')
        const before = readdirSync(f.paths.root).sort()
        try {
          const result = spawnSync(
            'corepack',
            ['pnpm', 'handoff:app', '--resume'],
            {
              cwd: workspace,
              env: { ...process.env, XDG_DATA_HOME: f.xdg },
              encoding: 'utf8',
              timeout: 30_000
            }
          )
          expect(result.error).toBeUndefined()
          expect(result.status).not.toBe(0)
          expect(result.stdout + result.stderr).toContain(
            state === 'busy'
              ? 'installation is occupied'
              : 'Cannot reliably determine'
          )
          expect(result.stderr).not.toContain('Usage:')
          expect(existsSync(join(workspace, '.tmp'))).toBe(false)
          expect(existsSync(join(workspace, 'release'))).toBe(false)
          expect(readdirSync(f.paths.root).sort()).toEqual(before)
          expect(readLocalInstallationAvailability(f.paths).status).toBe(state)
        } finally {
          lease?.release()
        }
        expect(existsSync(profileAccessPaths(f.paths.profile).launch)).toBe(
          false
        )
      }
    )
  }
)
