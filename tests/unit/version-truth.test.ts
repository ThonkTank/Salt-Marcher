import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertVersionTruthDocument,
  readVersionTruth,
  renderVersionTruth
} from '../../scripts/version-truth.js'

describe('version truth gate', () => {
  it('derives current schema paths and independent version dimensions', () => {
    const truth = readVersionTruth()
    expect(truth.schemas).toEqual([
      {
        role: 'installation',
        current: 34,
        path: '27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33 -> 34',
        owner: 'installation-schema-migrations.ts'
      },
      {
        role: 'campaign',
        current: 35,
        path: '27 -> 28 -> 29 -> 30 -> 31 -> 32 -> 33 -> 34 -> 35',
        owner: 'campaign-schema-migrations.ts'
      }
    ])
    expect(truth.encounterEngineVersion).toBe('encounter-v5')
    expect(truth.rewardEngineVersion).toBe('reward-v3')
    expect(truth.readableRewardEngineVersions).toEqual([
      'reward-v2',
      'reward-v3'
    ])
  })

  it('rejects documentation drift', () => {
    const truth = readVersionTruth()
    const actual = readFileSync(
      'docs/project/architecture/version-truth.md',
      'utf8'
    )
    expect(() => assertVersionTruthDocument(actual, truth)).not.toThrow()
    expect(() =>
      assertVersionTruthDocument(
        renderVersionTruth(truth).replace('reward-v3', 'reward-v2'),
        truth
      )
    ).toThrow(/differs from executable version registries/)
  })
})
