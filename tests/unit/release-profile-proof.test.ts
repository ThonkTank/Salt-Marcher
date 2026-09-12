import { expect, it } from 'vitest'
import {
  profileDigest,
  verifyProfileProof
} from '../../scripts/release/profile-proof.js'

import { profileProofFixture as fixture } from '../fixtures/release-profile-proof.js'

it('proves complete snapshots and linked history despite separately generated empty migration epochs', () => {
  const proof = verifyProfileProof(fixture())
  expect(proof.migratedExpected).toBe(proof.migratedActual)
  expect(proof.restored).toBe(proof.migratedActual)
  expect(proof.continuedActual).not.toBe(proof.migratedActual)
  expect(proof.protectedRestore).toBe(proof.continuedActual)
  expect(proof.secondProtection).toBe(proof.restored)
})

it.each([
  [
    'source history edit',
    (v: ReturnType<typeof fixture>) => {
      v.history.unchanged.campaigns.pop()
    }
  ],
  [
    'source edit',
    (v: ReturnType<typeof fixture>) => {
      v.unchanged.ownFiles[0]!.base64 = 'AAAA'
    }
  ],
  [
    'lost inactive campaign',
    (v: ReturnType<typeof fixture>) => {
      v.migrated.campaigns.splice(1, 1)
    }
  ],
  [
    'lost play state',
    (v: ReturnType<typeof fixture>) => {
      v.continued.campaigns[0]!.game.session.travel.progress = 0
    }
  ],
  [
    'wrong XP',
    (v: ReturnType<typeof fixture>) => {
      v.continued.campaigns[0]!.party.members[0]!.xp++
    }
  ],
  [
    'wrong history link',
    (v: ReturnType<typeof fixture>) => {
      v.history.continued.installation.party_history_index[0]!['command_id'] =
        'other'
    }
  ],
  [
    'lost safety history',
    (v: ReturnType<typeof fixture>) => {
      v.history.protection.campaigns[0]!.tables.party_action_history = []
    }
  ],
  [
    'protective restore omitted',
    (v: ReturnType<typeof fixture>) => {
      v.protectedRestore = v.migrated
    }
  ],
  [
    'restore gained actions',
    (v: ReturnType<typeof fixture>) => {
      v.history.restored = v.history.continued
    }
  ],
  [
    'second backup lost data',
    (v: ReturnType<typeof fixture>) => {
      v.secondProtection.ownFiles = []
    }
  ],
  [
    'duplicate registry',
    (v: ReturnType<typeof fixture>) => {
      v.source.registry.campaigns[1]!.id = 'active'
      v.unchanged = structuredClone(v.source)
    }
  ]
] as const)('rejects %s', (_name, mutate) => {
  const value = fixture()
  mutate(value)
  expect(() => verifyProfileProof(value)).toThrow()
})

it('canonicalizes object keys while preserving array ordering and unknown content', () => {
  expect(profileDigest({ a: 1, b: [2, 3] })).toBe(
    profileDigest({ b: [2, 3], a: 1 })
  )
  expect(profileDigest({ a: 1, b: [2, 3] })).not.toBe(
    profileDigest({ a: 1, b: [3, 2] })
  )
})
