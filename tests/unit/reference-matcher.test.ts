import { describe, expect, it } from 'vitest'
import type { ReferenceIndex } from '../../src/shared/contracts/reference.js'
import {
  compileReferenceIndex,
  matchReferenceText
} from '../../src/renderer/features/reference/reference-matcher.js'

const index: ReferenceIndex = {
  revision: 'test',
  terms: [
    {
      term: 'Prone',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'condition', id: 'conditions:prone' },
          title: 'Prone',
          context: 'Conditions'
        }
      ]
    },
    {
      term: 'Magic Missile',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'spell', id: 'spells:magic-missile' },
          title: 'Magic Missile',
          context: 'Spells'
        }
      ]
    },
    {
      term: 'Missile',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'item', id: 'equipment:missile' },
          title: 'Missile',
          context: 'Equipment'
        }
      ]
    },
    {
      term: 'ffi',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'rule', id: 'rule:ffi' },
          title: 'ffi',
          context: 'Rule'
        }
      ]
    },
    {
      term: 'Slow',
      matchMode: 'folded',
      candidates: [
        {
          target: { kind: 'spell', id: 'spells:slow' },
          title: 'Slow',
          context: 'Spells'
        }
      ]
    },
    {
      term: 'Slow',
      matchMode: 'exact',
      candidates: [
        {
          target: { kind: 'location', id: 'location-slow' },
          title: 'Slow',
          context: 'Campaign Location'
        }
      ]
    }
  ]
}

describe('reference matcher', () => {
  const compiled = compileReferenceIndex(index)

  it('matches folded SRD terms at word boundaries and keeps the longest phrase', () => {
    const matches = matchReferenceText(
      compiled,
      'A prone target is hit by magic missile, not a slowpoke.'
    )
    expect(matches.map((match) => match.text)).toEqual([
      'prone',
      'magic missile'
    ])
  })

  it('combines exact world and folded rule candidates without silent precedence', () => {
    const [upper] = matchReferenceText(compiled, 'Slow')
    const [lower] = matchReferenceText(compiled, 'slow')
    expect(upper?.candidates.map((candidate) => candidate.target.kind)).toEqual(
      ['location', 'spell']
    )
    expect(lower?.candidates.map((candidate) => candidate.target.kind)).toEqual(
      ['spell']
    )
  })

  it('maps compatibility-normalized matches back to intact source spans', () => {
    const matches = matchReferenceText(compiled, 'The ﬃ mark and Prone.')
    expect(matches.map((match) => match.text)).toEqual(['ﬃ', 'Prone'])
    for (const match of matches)
      expect('The ﬃ mark and Prone.'.slice(match.start, match.end)).toBe(
        match.text
      )
  })

  it('suppresses targets already present in the recursive ancestor path', () => {
    expect(
      matchReferenceText(compiled, 'Prone and Slow', [
        { kind: 'condition', id: 'conditions:prone' }
      ]).map((match) => match.text)
    ).toEqual(['Slow'])
  })
})
