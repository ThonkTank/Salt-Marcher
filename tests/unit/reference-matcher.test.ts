import { describe, expect, it } from 'vitest'
import type {
  ReferenceIndex,
  ReferenceTarget
} from '../../src/shared/contracts/reference.js'
import {
  compileReferenceIndex,
  matchReferenceText
} from '../../src/renderer/features/reference/reference-matcher.js'

const srd = (
  definitionKind: 'condition' | 'spell' | 'item' | 'rule',
  definitionId: string
): ReferenceTarget => ({
  scope: 'srd',
  catalogId: 'srd-5.1',
  definitionKind,
  definitionId
})

const index: ReferenceIndex = {
  scope: 'static',
  revision: 'test',
  terms: [
    ['Prone', 'folded', srd('condition', 'conditions:prone')],
    ['Magic Missile', 'folded', srd('spell', 'spells:magic-missile')],
    ['Missile', 'folded', srd('item', 'equipment:missile')],
    ['ffi', 'folded', srd('rule', 'rule:ffi')],
    ['Slow', 'folded', srd('spell', 'spells:slow')],
    [
      'Slow',
      'exact',
      {
        scope: 'campaign',
        campaignId: 'campaign',
        entityKind: 'location',
        entityId: 'location-slow'
      }
    ]
  ].map(([term, matchMode, target]) => ({
    term: term as string,
    matchMode: matchMode as 'folded' | 'exact',
    candidates: [{ target: target as ReferenceTarget, title: term as string }]
  }))
}

describe('reference matcher', () => {
  const compiled = compileReferenceIndex(index)

  it('matches folded terms at boundaries and keeps the longest phrase', () => {
    expect(
      matchReferenceText(
        compiled,
        'A prone target is hit by magic missile, not a slowpoke.'
      ).map((match) => match.text)
    ).toEqual(['prone', 'magic missile'])
  })

  it('combines exact campaign and folded rule candidates', () => {
    expect(matchReferenceText(compiled, 'Slow')[0]?.candidates).toHaveLength(2)
    expect(matchReferenceText(compiled, 'slow')[0]?.candidates).toHaveLength(1)
  })

  it('maps compatibility-normalized matches to intact source spans', () => {
    expect(
      matchReferenceText(compiled, 'The ﬃ mark and Prone.').map(
        (match) => match.text
      )
    ).toEqual(['ﬃ', 'Prone'])
  })

  it('keeps German campaign names exact while preserving their source span', () => {
    const campaignIndex: ReferenceIndex = {
      scope: 'campaign',
      revision: 'campaign-de',
      terms: [
        {
          term: 'Über den Hügel',
          matchMode: 'exact',
          candidates: [
            {
              target: {
                scope: 'campaign',
                campaignId: 'campaign',
                entityKind: 'location',
                entityId: 'huegel'
              },
              title: 'Über den Hügel'
            }
          ]
        }
      ]
    }
    const campaignCompiled = compileReferenceIndex(campaignIndex)
    expect(
      matchReferenceText(campaignCompiled, 'Reise Über den Hügel.')[0]?.text
    ).toBe('Über den Hügel')
    expect(
      matchReferenceText(campaignCompiled, 'Reise über den Hügel.')
    ).toEqual([])
  })

  it('suppresses targets already in the recursive ancestor path', () => {
    expect(
      matchReferenceText(compiled, 'Prone and Slow', [
        srd('condition', 'conditions:prone')
      ]).map((match) => match.text)
    ).toEqual(['Slow'])
  })

  it('keeps matching linear after compiling a large catalog', () => {
    const large: ReferenceIndex = {
      scope: 'static',
      revision: 'large',
      terms: Array.from({ length: 10_000 }, (_, termIndex) => ({
        term: `Catalog Term ${termIndex}`,
        matchMode: 'folded' as const,
        candidates: [
          {
            target: srd('rule', `rule:${termIndex}`),
            title: `Catalog Term ${termIndex}`
          }
        ]
      }))
    }
    const compileStarted = performance.now()
    const largeCompiled = compileReferenceIndex(large)
    const compileDuration = performance.now() - compileStarted
    const prose = `${'ordinary prose '.repeat(5_000)} Catalog Term 9999.`
    const matchStarted = performance.now()
    const matches = matchReferenceText(largeCompiled, prose)
    const matchDuration = performance.now() - matchStarted
    expect(matches.at(-1)?.text).toBe('Catalog Term 9999')
    expect(compileDuration).toBeLessThan(2_000)
    expect(matchDuration).toBeLessThan(1_000)
  })

  it('keeps a dense 50,000-character prose fixture inside the 16ms gate', () => {
    const dense: ReferenceIndex = {
      scope: 'static',
      revision: 'dense',
      terms: Array.from({ length: 1_518 }, (_, termIndex) => ({
        term: `Rule Term ${termIndex}`,
        matchMode: 'folded' as const,
        candidates: [
          {
            target: srd('rule', `dense:${termIndex}`),
            title: `Rule Term ${termIndex}`
          }
        ]
      }))
    }
    const denseCompiled = compileReferenceIndex(dense)
    const prose = `${'ordinary prose '.repeat(3_570)} Rule Term 1517.`
    matchReferenceText(denseCompiled, prose)
    const durations = Array.from({ length: 3 }, () => {
      const started = process.cpuUsage()
      const matches = matchReferenceText(denseCompiled, prose)
      expect(matches.at(-1)?.text).toBe('Rule Term 1517')
      const elapsed = process.cpuUsage(started)
      return (elapsed.user + elapsed.system) / 1_000
    })
    expect(Math.min(...durations)).toBeLessThan(16)
  })
})
