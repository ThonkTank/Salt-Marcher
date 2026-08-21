import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { handoffInvocationHistorySchema } from '../../scripts/delivery-contract.js'
import { applyAuditRetention } from '../../scripts/local-storage/audit-retention.js'
import { inspectLocalStorage } from '../../scripts/local-storage/inspection.js'
import {
  applyDeploymentRetention,
  applyStorageRetention,
  collectStorageRetentionReceipt
} from '../../scripts/local-storage/retention.js'
import { createLocalStorageFixture } from '../support/local-storage-fixture.js'

const cleanup: Array<() => void> = []
afterEach(() => {
  for (const remove of cleanup.splice(0)) remove()
})

describe('local deployment retention', () => {
  it('rejects and preserves an obsolete v1 deployment manifest', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const legacy = fixture.deployment('a', '2026-01-01T12:00:00.000Z')
    const current = ['b', 'c', 'd'].map((character, index) =>
      fixture.deployment(character, `2026-01-0${index + 2}T12:00:00.000Z`)
    )
    fixture.activate(current[2]!)
    makeLegacyDeployment(fixture.paths.deployments, legacy)

    const before = inspectLocalStorage(fixture)
    expect(before.deployments).not.toContainEqual(
      expect.objectContaining({ fingerprint: legacy })
    )
    expect(before.findings).toContainEqual(
      expect.objectContaining({
        name: legacy,
        reason: 'Unsupported localArtifactManifest formatVersion 1; expected 2'
      })
    )

    applyDeploymentRetention({
      ...fixture,
      receiptDirectory: fixture.receiptDirectory,
      applicationSha: 'a'.repeat(40)
    })
    expect(existsSync(join(fixture.paths.deployments, legacy))).toBe(true)
  })

  it('inventories but never cleans an obsolete root installation layout', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const current = fixture.deployment('d', '2026-01-04T12:00:00.000Z')
    fixture.activate(current)
    const legacyImage = join(fixture.paths.root, 'SaltMarcher.AppImage')
    const legacyMarker = join(fixture.paths.root, 'installed-artifact.json')
    writeFileSync(legacyImage, 'obsolete')
    writeFileSync(
      legacyMarker,
      JSON.stringify({ formatVersion: 1, artifactSha256: 'a'.repeat(64) })
    )

    expect(
      inspectLocalStorage(fixture).compatibility.artifacts.find(
        ({ name }) => name === 'legacy-root-installation'
      )
    ).toMatchObject({
      status: 'unsupported-obsolete',
      applicationReachable: false
    })
    expect(existsSync(legacyImage)).toBe(true)
    expect(existsSync(legacyMarker)).toBe(true)
  })

  it('keeps the active, two newest inactive, and journal-referenced deployments', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const fingerprints = ['a', 'b', 'c', 'd', 'e'].map((character, index) =>
      fixture.deployment(character, `2026-01-0${index + 1}T12:00:00.000Z`)
    )
    fixture.activate(fingerprints[2]!)
    fixture.protectWithJournal(fingerprints[0]!)
    const invalid = '9'.repeat(64)
    mkdirSync(join(fixture.paths.deployments, invalid))
    writeFileSync(join(fixture.paths.deployments, invalid, 'foreign.txt'), 'x')
    mkdirSync(join(fixture.paths.deployments, 'foreign-entry'))
    fixture.backup('campaign-backup', '2026-01-01T12:00:00.000Z')

    const before = inspectLocalStorage(fixture)
    expect(
      before.deployments
        .filter(({ retention }) => retention === 'delete')
        .map(({ fingerprint }) => fingerprint)
    ).toEqual([fingerprints[1]])

    const result = applyDeploymentRetention({
      ...fixture,
      receiptDirectory: fixture.receiptDirectory,
      applicationSha: 'a'.repeat(40)
    })
    expect(result.deletedDeploymentFingerprints).toEqual([fingerprints[1]])
    expect(result.retainedDeploymentFingerprints).toEqual([
      fingerprints[4],
      fingerprints[3],
      fingerprints[2],
      fingerprints[0]
    ])
    expect(result.releasedBytes).toBeGreaterThan(0)
    expect(existsSync(join(fixture.paths.deployments, invalid))).toBe(true)
    expect(existsSync(join(fixture.paths.deployments, 'foreign-entry'))).toBe(
      true
    )
    expect(existsSync(join(fixture.paths.backups, 'campaign-backup'))).toBe(
      true
    )
    expect(result.findings.map(({ name }) => name)).toEqual(
      expect.arrayContaining([invalid, 'foreign-entry'])
    )
  })

  it('blocks all automatic pruning when current or the journal is unreadable', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    fixture.deployment('a', '2026-01-01T12:00:00.000Z')
    fixture.deployment('b', '2026-01-02T12:00:00.000Z')
    writeFileSync(fixture.paths.journal, '{broken')

    const inspection = inspectLocalStorage(fixture)
    expect(inspection.activeDeploymentFingerprint).toBeNull()
    expect(
      inspection.deployments.every(({ retention }) => retention === 'keep')
    ).toBe(true)
    expect(() =>
      applyDeploymentRetention({
        ...fixture,
        receiptDirectory: fixture.receiptDirectory,
        applicationSha: 'a'.repeat(40)
      })
    ).toThrow(/valid active deployment/)
  })

  it('fails a deletion checkpoint without removing the verified active deployment', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const fingerprints = ['a', 'b', 'c', 'd'].map((character, index) =>
      fixture.deployment(character, `2026-01-0${index + 1}T12:00:00.000Z`)
    )
    fixture.activate(fingerprints[3]!)

    expect(() =>
      applyDeploymentRetention({
        ...fixture,
        receiptDirectory: fixture.receiptDirectory,
        applicationSha: 'a'.repeat(40),
        removeDirectory: () => {
          throw new Error('injected delete failure')
        }
      })
    ).toThrow('injected delete failure')
    expect(existsSync(fixture.paths.current)).toBe(true)
    expect(existsSync(join(fixture.paths.deployments, fingerprints[0]!))).toBe(
      true
    )
  })
})

function makeLegacyDeployment(deployments: string, fingerprint: string): void {
  const path = join(deployments, fingerprint)
  const current = JSON.parse(
    readFileSync(join(path, 'artifact-manifest.json'), 'utf8')
  ) as {
    artifactSha256: string
    receipt: { build: { commit: string; dirty: boolean; builtAt: string } }
  }
  writeFileSync(
    join(path, 'artifact-manifest.json'),
    JSON.stringify({
      formatVersion: 1,
      artifactFile: 'SaltMarcher-Local-0.1.0.AppImage',
      artifactSha256: current.artifactSha256,
      build: {
        channel: 'local',
        commit: current.receipt.build.commit,
        sourceFingerprint: fingerprint,
        dirty: current.receipt.build.dirty,
        builtAt: current.receipt.build.builtAt,
        schemaVersion: 27
      }
    })
  )
}

describe('handoff audit retention', () => {
  it('keeps all nonterminal details, the newest 100 terminal details, and every SHA state', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const attempts = join(fixture.receiptDirectory, 'attempts')
    const states = join(fixture.receiptDirectory, 'states')
    mkdirSync(attempts)
    mkdirSync(states)
    const invocations = []
    for (let index = 0; index < 103; index += 1) {
      const attemptId = `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`
      const auditPath = join(attempts, `${attemptId}.json`)
      const status = index === 102 ? 'running' : 'complete'
      writeFileSync(
        auditPath,
        JSON.stringify({ formatVersion: 6, activeAttemptId: attemptId, status })
      )
      writeFileSync(
        join(states, `${index.toString().padStart(3, '0')}.json`),
        'state'
      )
      invocations.push({
        attemptId,
        applicationSha: 'a'.repeat(40),
        intent: 'advance',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        statePath: join(states, `${index.toString().padStart(3, '0')}.json`),
        auditPath
      })
    }
    writeFileSync(
      join(fixture.receiptDirectory, 'invocations.json'),
      JSON.stringify({ formatVersion: 2, invocations })
    )

    const result = applyAuditRetention({
      receiptDirectory: fixture.receiptDirectory
    })
    expect(result).toMatchObject({
      retainedInvocations: 101,
      removedInvocations: 2
    })
    expect(result.removedAttemptFiles).toHaveLength(2)
    const retainedHistory = handoffInvocationHistorySchema.parse(
      JSON.parse(
        readFileSync(join(fixture.receiptDirectory, 'invocations.json'), 'utf8')
      )
    )
    expect(retainedHistory.invocations).toHaveLength(101)
    expect(
      existsSync(join(attempts, `${invocations[102]!.attemptId}.json`))
    ).toBe(true)
    expect(existsSync(join(states, '000.json'))).toBe(true)
    expect(existsSync(join(states, '102.json'))).toBe(true)
  })

  it('fails the retention checkpoint when an owned attempt detail cannot be deleted', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const attempts = join(fixture.receiptDirectory, 'attempts')
    mkdirSync(attempts)
    const invocations = []
    for (let index = 0; index < 101; index += 1) {
      const attemptId = `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`
      const auditPath = join(attempts, `${attemptId}.json`)
      writeFileSync(
        auditPath,
        JSON.stringify({
          formatVersion: 6,
          activeAttemptId: attemptId,
          status: 'failed'
        })
      )
      invocations.push({
        attemptId,
        applicationSha: 'a'.repeat(40),
        intent: 'advance',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        statePath: join(fixture.receiptDirectory, 'states', `${index}.json`),
        auditPath
      })
    }
    writeFileSync(
      join(fixture.receiptDirectory, 'invocations.json'),
      JSON.stringify({ formatVersion: 2, invocations })
    )

    expect(() =>
      applyAuditRetention({
        receiptDirectory: fixture.receiptDirectory,
        removeFile: () => {
          throw new Error('injected audit delete failure')
        }
      })
    ).toThrow('injected audit delete failure')
  })

  it('resumes after audit failure without losing already released deployment evidence', () => {
    const fixture = createLocalStorageFixture()
    cleanup.push(fixture.cleanup)
    const fingerprints = ['a', 'b', 'c', 'd'].map((character, index) =>
      fixture.deployment(character, `2026-01-0${index + 1}T12:00:00.000Z`)
    )
    fixture.activate(fingerprints[3]!)
    const attempts = join(fixture.receiptDirectory, 'attempts')
    mkdirSync(attempts)
    const invocations = Array.from({ length: 101 }, (_, index) => {
      const attemptId = `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`
      const auditPath = join(attempts, `${attemptId}.json`)
      writeFileSync(
        auditPath,
        JSON.stringify({
          formatVersion: 6,
          activeAttemptId: attemptId,
          status: 'complete'
        })
      )
      return {
        attemptId,
        applicationSha: 'a'.repeat(40),
        intent: 'advance',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        statePath: join(fixture.receiptDirectory, 'states', `${index}.json`),
        auditPath
      }
    })
    writeFileSync(
      join(fixture.receiptDirectory, 'invocations.json'),
      JSON.stringify({ formatVersion: 2, invocations })
    )
    const options = {
      ...fixture,
      applicationSha: 'a'.repeat(40),
      now: () => new Date('2026-03-15T12:00:00.000Z')
    }

    expect(() =>
      applyStorageRetention({
        ...options,
        removeAuditFile: () => {
          throw new Error('injected audit delete failure')
        }
      })
    ).toThrow('injected audit delete failure')
    expect(existsSync(join(fixture.paths.deployments, fingerprints[0]!))).toBe(
      false
    )
    expect(existsSync(join(fixture.paths.deployments, fingerprints[3]!))).toBe(
      true
    )

    const resumed = applyStorageRetention(options)
    expect(resumed.deployment.deletedDeploymentFingerprints).toEqual([
      fingerprints[0]
    ])
    expect(resumed.deployment.releasedBytes).toBeGreaterThan(0)
    expect(collectStorageRetentionReceipt(options)).toEqual(resumed)
  })
})
