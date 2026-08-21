import { describe, expect, it } from 'vitest'

import {
  exactShaAggregateNeeds,
  verifyExactShaAggregate
} from '../../scripts/exact-sha-aggregate-contract.js'

const sha = 'a'.repeat(40)

function successfulNeeds(): Record<string, { result: string }> {
  return Object.fromEntries(
    exactShaAggregateNeeds.map((name) => [name, { result: 'success' }])
  )
}

describe('exact SHA aggregate contract', () => {
  it('accepts only the exact checked PR head with every dependency successful', () => {
    expect(() =>
      verifyExactShaAggregate({
        checkedOutSha: sha,
        checkedSha: sha,
        pullRequestHeadSha: sha,
        needs: successfulNeeds()
      })
    ).not.toThrow()
  })

  it.each([
    ['checkout', { checkedOutSha: 'b'.repeat(40) }],
    ['checked SHA', { checkedSha: 'b'.repeat(40) }]
  ])('rejects a foreign %s', (_name, patch) => {
    expect(() =>
      verifyExactShaAggregate({
        checkedOutSha: sha,
        checkedSha: sha,
        pullRequestHeadSha: sha,
        needs: successfulNeeds(),
        ...patch
      })
    ).toThrow(/differs/)
  })

  it('rejects unsuccessful, missing, and unexpected dependencies', () => {
    const failed = successfulNeeds()
    failed['visual'] = { result: 'failure' }
    expect(() =>
      verifyExactShaAggregate({
        checkedOutSha: sha,
        checkedSha: sha,
        pullRequestHeadSha: sha,
        needs: failed
      })
    ).toThrow(/visual=failure/)

    const missing = successfulNeeds()
    delete missing['visual']
    expect(() =>
      verifyExactShaAggregate({
        checkedOutSha: sha,
        checkedSha: sha,
        pullRequestHeadSha: sha,
        needs: missing
      })
    ).toThrow(/dependency set differs/)

    expect(() =>
      verifyExactShaAggregate({
        checkedOutSha: sha,
        checkedSha: sha,
        pullRequestHeadSha: sha,
        needs: { ...successfulNeeds(), foreign: { result: 'success' } }
      })
    ).toThrow(/dependency set differs/)
  })
})
