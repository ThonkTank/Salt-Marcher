import { describe, expect, it } from 'vitest'
import {
  assertCurrentLocalPersistenceVersion,
  currentVersionOneLocalPersistenceContracts,
  localPersistenceFormatVersions
} from '../../src/shared/contracts/local-persistence-format-versions.js'

describe('local persistence format allowlist', () => {
  it('names every current local persistence contract and exact version', () => {
    expect(localPersistenceFormatVersions).toEqual({
      buildReceipt: 2,
      localArtifactManifest: 2,
      campaignLifecycleReceipt: 2,
      localInstallJournal: 2,
      handoffReceipt: 7,
      handoffInvocationHistory: 2,
      candidateArtifactReceipt: 1,
      campaignBackupManifest: 2,
      localProfileLock: 1,
      localStorageInspection: 1,
      localStorageCompatibilityInspection: 1,
      storageRetentionProgress: 1,
      storageRetentionReceipt: 1
    })
    expect(currentVersionOneLocalPersistenceContracts).toEqual([
      'candidateArtifactReceipt',
      'localProfileLock',
      'localStorageInspection',
      'localStorageCompatibilityInspection',
      'storageRetentionProgress',
      'storageRetentionReceipt'
    ])
  })

  it('rejects obsolete version-one envelopes after a format advances', () => {
    expect(() =>
      assertCurrentLocalPersistenceVersion(
        { formatVersion: 1 },
        'campaignBackupManifest'
      )
    ).toThrow('Unsupported campaignBackupManifest formatVersion 1; expected 2')
    expect(() =>
      assertCurrentLocalPersistenceVersion(
        { formatVersion: 1 },
        'localInstallJournal'
      )
    ).toThrow('Unsupported localInstallJournal formatVersion 1; expected 2')
  })
})
