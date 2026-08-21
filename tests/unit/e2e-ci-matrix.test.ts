import { describe, expect, it } from 'vitest'
import {
  e2eCiMatrix,
  e2eCiSuites,
  measuredE2eCiSeconds
} from '../../scripts/e2e-ci-matrix.js'
import {
  e2eSuiteHasType,
  e2eSuiteRegistry
} from '../../scripts/e2e-suite-registry.js'

describe('E2E CI matrix', () => {
  it('derives four functional shards exclusively from the suite registry', () => {
    const matrix = e2eCiMatrix('functional')
    expect(matrix.include).toHaveLength(4)
    expect(
      matrix.include.flatMap(({ shard }) => e2eCiSuites('functional', shard))
    ).toEqual(e2eSuiteRegistry.map((suite) => suite.name))
  })

  it('balances measured visual suites across three typed shards', () => {
    const matrix = e2eCiMatrix('visual')
    expect(matrix.include).toHaveLength(3)
    const selected = matrix.include.flatMap(({ shard }) =>
      e2eCiSuites('visual', shard)
    )
    expect(selected.toSorted()).toEqual(
      e2eSuiteRegistry
        .filter((suite) => e2eSuiteHasType(suite, 'visual'))
        .map((suite) => suite.name)
        .toSorted()
    )
    expect(
      matrix.include.map(({ shard }) => measuredE2eCiSeconds('visual', shard))
    ).toEqual([181, 255, 182])
  })

  it('fails closed for unknown shard names', () => {
    expect(() => e2eCiSuites('functional', 'unknown')).toThrow(
      'Unknown functional E2E CI shard'
    )
    expect(() => e2eCiSuites('visual', 'unknown')).toThrow(
      'Unknown visual E2E CI shard'
    )
  })
})
