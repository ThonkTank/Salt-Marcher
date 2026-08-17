import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { encounterCandidateStream } from '../../src/core/session-generation/entropy-streams.js'
import { createRewardRandom } from '../../src/core/session-generation/reward-random.js'

describe('versioned entropy stream encodings', () => {
  it('uses one small injected reward-random boundary', () => {
    expect(encounterCandidateStream(179_974, 2, 'candidate')).toBe(
      '179974|encounter:2:candidate'
    )
    const streams: string[] = []
    const random = createRewardRandom(179_974, {
      unit: (stream) => {
        streams.push(stream)
        return 0.25
      },
      modulo: (stream, modulus) => {
        streams.push(stream)
        return modulus - 1
      }
    })
    expect(random.unit('curse:item-x', 3)).toBe(0.25)
    expect(random.modulo('container:key', 'container-x', 7)).toBe(6)
    expect(streams).toEqual([
      'reward-v3|179974|curse:item-x|3',
      'reward-v3|179974|container:key|container-x'
    ])
  })

  it('salts reward entropy only with the Reward engine version', () => {
    const streams: string[] = []
    createRewardRandom(17, {
      unit: (stream) => {
        streams.push(stream)
        return 0
      },
      modulo: () => 0
    }).unit('magic-target', 2)
    expect(streams).toEqual(['reward-v3|17|magic-target|2'])
    const source = readFileSync(
      'src/utility/session-generation/sha256-entropy.ts',
      'utf8'
    )
    expect(source).not.toContain('SESSION_GENERATION_ENGINE_VERSION')
    expect(source).toContain('SESSION_ENCOUNTER_ENGINE_VERSION')
  })
})
