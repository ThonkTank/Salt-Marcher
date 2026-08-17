import { describe, expect, it } from 'vitest'
import {
  assertCandidateState,
  parseRemoteHead,
  successfulCheckUrl,
  type CandidateState
} from '../../scripts/candidate-delivery.js'

const valid: CandidateState = {
  branch: 'quality-reset/candidate',
  upstream: 'origin/quality-reset/candidate',
  head: 'b'.repeat(40),
  upstreamHead: 'b'.repeat(40),
  remoteMain: 'a'.repeat(40),
  clean: true,
  mainIsAncestor: true,
  successfulCheckUrl: 'https://github.example/check/1'
}

describe('candidate delivery policy', () => {
  it('parses the live remote head without consulting local main', () => {
    expect(parseRemoteHead(`${'a'.repeat(40)}\trefs/heads/main\n`)).toBe(
      'a'.repeat(40)
    )
    expect(() => parseRemoteHead('')).toThrow(/resolve origin\/main/)
  })

  it('requires a successful Check for the exact candidate SHA', () => {
    const runs = [
      {
        headSha: valid.head,
        status: 'completed',
        conclusion: 'failure',
        url: 'failed'
      },
      {
        headSha: valid.head,
        status: 'completed',
        conclusion: 'success',
        url: 'green'
      }
    ]
    expect(successfulCheckUrl(runs, valid.head)).toBe('green')
    expect(successfulCheckUrl(runs, 'c'.repeat(40))).toBeNull()
  })

  it('rejects stale upstreams, dirty trees, direct main, and unproved SHAs', () => {
    expect(() => assertCandidateState(valid)).not.toThrow()
    for (const patch of [
      { branch: 'main', upstream: 'origin/main' },
      { upstream: 'origin/old-candidate' },
      { upstreamHead: 'c'.repeat(40) },
      { clean: false },
      { mainIsAncestor: false },
      { successfulCheckUrl: null }
    ])
      expect(() => assertCandidateState({ ...valid, ...patch })).toThrow()
  })
})
