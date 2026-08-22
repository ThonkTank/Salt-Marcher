import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { pruneLocalBackup } from '../../scripts/local-storage/backup-prune.js'
import {
  backupBytesWarningThreshold,
  backupCountWarningThreshold
} from '../../scripts/local-storage/contract.js'
import {
  inspectLocalStorage,
  storageWarnings
} from '../../scripts/local-storage/inspection.js'
import { createLocalStorageFixture } from '../support/local-storage-fixture.js'

const cleanup: Array<() => void> = []
afterEach(() => {
  for (const remove of cleanup.splice(0)) remove()
})

describe('manual campaign-backup pruning', () => {
  it('is a dry run without the exact hash and deletes at most one eligible backup', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const manifests = new Map<string, string>()
    for (let day = 1; day <= 7; day += 1) {
      const name = `backup-${day}`
      manifests.set(name, fixture.backup(name, `2026-01-0${day}T12:00:00.000Z`))
    }
    const options = {
      ...fixture,
      backup: 'backup-1',
      now: () => new Date('2026-03-15T12:00:00.000Z')
    }

    const dryRun = pruneLocalBackup(options)
    expect(dryRun).toMatchObject({
      backup: 'backup-1',
      dryRun: true,
      deleted: false,
      refusal: null
    })
    expect(dryRun.releasedBytes).toBeGreaterThan(0)
    expect(existsSync(join(fixture.paths.backups, 'backup-1'))).toBe(true)

    const refused = pruneLocalBackup({
      ...options,
      confirmManifestSha: '0'.repeat(64)
    })
    expect(refused).toMatchObject({ deleted: false, dryRun: false })
    expect(typeof refused.refusal).toBe('string')

    const deleted = pruneLocalBackup({
      ...options,
      confirmManifestSha: manifests.get('backup-1')!
    })
    expect(deleted).toMatchObject({
      deleted: true,
      dryRun: false,
      refusal: null
    })
    expect(existsSync(join(fixture.paths.backups, 'backup-1'))).toBe(false)
    expect(existsSync(join(fixture.paths.backups, 'backup-2'))).toBe(true)
  })

  it('refuses the newest five, young, invalid, and non-exact targets', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    for (let day = 1; day <= 6; day += 1)
      fixture.backup(`old-${day}`, `2026-01-0${day}T12:00:00.000Z`)
    fixture.backup('young', '2026-03-10T12:00:00.000Z')
    fixture.backup('invalid', '2026-01-01T12:00:00.000Z')
    writeFileSync(
      join(fixture.paths.backups, 'invalid', 'campaign.sqlite'),
      'changed'
    )
    const base = {
      ...fixture,
      now: () => new Date('2026-03-15T12:00:00.000Z')
    }

    expect(pruneLocalBackup({ ...base, backup: 'young' }).refusal).toMatch(
      /newest|younger/
    )
    expect(pruneLocalBackup({ ...base, backup: 'invalid' }).refusal).toMatch(
      /invalid/
    )
    expect(() => pruneLocalBackup({ ...base, backup: '*' })).toThrow(/exact/)
    expect(() => pruneLocalBackup({ ...base, backup: '../old-1' })).toThrow(
      /exact/
    )
  })

  it('never auto-deletes backups and emits advisory capacity warnings', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    fixture.backup('backup', '2026-01-01T12:00:00.000Z')
    const before = inspectLocalStorage({
      ...fixture,
      now: () => new Date('2026-03-15T12:00:00.000Z')
    })
    expect(before.backups).toHaveLength(1)
    expect(storageWarnings(backupCountWarningThreshold + 1, 0)).toEqual([
      expect.objectContaining({ code: 'backup-count-high' })
    ])
    expect(storageWarnings(0, backupBytesWarningThreshold + 1)).toEqual([
      expect.objectContaining({ code: 'backup-bytes-high' })
    ])
  })

  it('recognizes and preserves legacy v1 backups without offering restore or pruning', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    fixture.backup('legacy', '2025-01-01T12:00:00.000Z')
    const manifestPath = join(
      fixture.paths.backups,
      'legacy',
      'backup-manifest.json'
    )
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      unknown
    >
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, formatVersion: 1 })
    )

    const inspection = inspectLocalStorage({
      ...fixture,
      now: () => new Date('2026-03-15T12:00:00.000Z')
    })
    expect(inspection.backups).toEqual([])
    const finding = inspection.findings.find(
      ({ area, name }) => area === 'backups' && name === 'legacy'
    )
    expect(finding?.reason).toContain('is preserved')
    expect(
      pruneLocalBackup({
        ...fixture,
        backup: 'legacy',
        now: () => new Date('2026-03-15T12:00:00.000Z')
      }).refusal
    ).toContain('automatic restore and pruning are unsupported')
    expect(existsSync(join(fixture.paths.backups, 'legacy'))).toBe(true)
  })
})
