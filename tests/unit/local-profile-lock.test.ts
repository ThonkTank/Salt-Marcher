import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  acquireProfileLock,
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
