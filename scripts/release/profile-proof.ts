import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { withPartyHistoryDefaults } from '../qualification/historical-party-history-scenario.js'
import {
  assertPartyHistoryMigration,
  assertPartyHistoryXp
} from '../qualification/party-history-assertions.js'

const roster = z
  .object({
    revision: z.number().int(),
    members: z
      .array(z.object({ id: z.string(), xp: z.number() }).passthrough())
      .min(1)
  })
  .passthrough()
const registryEntry = z
  .object({ id: z.string(), lastOpenedAt: z.iso.datetime().nullable() })
  .passthrough()
const profile = z
  .object({
    coverage: z.literal(
      'settings-campaigns-party-own-files-world-combat-travel-v3'
    ),
    settings: z
      .object({ preferences: z.record(z.string(), z.unknown()) })
      .passthrough(),
    registry: z
      .object({
        activeCampaignId: z.string(),
        campaigns: z.array(registryEntry).min(2),
        trashedCampaigns: z.array(registryEntry).min(1)
      })
      .passthrough(),
    campaigns: z
      .array(
        z
          .object({
            id: z.string(),
            trashed: z.boolean(),
            party: roster,
            game: z
              .object({ session: z.object({ party: roster }).passthrough() })
              .passthrough()
          })
          .passthrough()
      )
      .min(3),
    ownFiles: z.array(z.record(z.string(), z.unknown())).min(1)
  })
  .passthrough()
const rows = z.array(z.record(z.string(), z.unknown())).nullable()
const history = z
  .object({
    installation: z
      .object({
        party_history_installation: rows,
        party_history_campaign: rows,
        party_history_index: rows
      })
      .strict(),
    campaigns: z.array(
      z
        .object({
          id: z.string(),
          tables: z
            .object({
              party_action_history: rows,
              party_action_receipt: rows
            })
            .strict()
        })
        .strict()
    )
  })
  .strict()
export const profileProofInputSchema = z
  .object({
    source: profile,
    unchanged: profile,
    migrated: profile,
    continued: profile,
    restored: profile,
    protection: profile,
    protectedRestore: profile,
    secondProtection: profile,
    history: z
      .object({
        source: history,
        unchanged: history,
        migrated: history,
        continued: history,
        restored: history,
        protection: history,
        protectedRestore: history,
        secondProtection: history
      })
      .strict()
  })
  .strict()

/** Stable object-key ordering; array order and every retained field remain significant. */
export function profileDigest(value: unknown): string {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical)
    if (input !== null && typeof input === 'object')
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, canonical(entry)])
      )
    return input
  }
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
}

/** Content proof only: callers must separately establish runtime/file/CI provenance. */
export function verifyProfileProof(raw: unknown) {
  const v = profileProofInputSchema.parse(raw)
  const h = v.history
  assert.deepEqual(h.unchanged, h.source, 'Source history changed')
  assert.deepEqual(v.unchanged, v.source, 'Source profile changed')
  const ids = v.source.campaigns.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'Duplicate campaigns')
  const active = v.source.registry.activeCampaignId
  const regular = v.source.registry.campaigns.map((c) => c.id)
  const trash = v.source.registry.trashedCampaigns.map((c) => c.id)
  assert(regular.includes(active), 'Active campaign missing from registry')
  assert.deepEqual(
    [...regular, ...trash].sort(),
    [...ids].sort(),
    'Registry differs from campaigns'
  )
  for (const campaign of v.source.campaigns)
    assert.equal(campaign.trashed, trash.includes(campaign.id))
  assert.deepEqual(
    h.source.campaigns.map((c) => c.id).sort(),
    v.source.campaigns
      .map((c) => `${c.trashed ? '.trash/' : ''}${c.id}`)
      .sort(),
    'History omits campaigns'
  )
  const expectedMigration = profile.parse(withPartyHistoryDefaults(v.source))
  assert.deepEqual(
    v.migrated,
    expectedMigration,
    'Unexpected profile migration'
  )
  assertPartyHistoryMigration(h.source, h.migrated)
  const expectedContinuation = structuredClone(expectedMigration)
  const opened = v.continued.registry.campaigns.find(
    (c) => c.id === active
  )!.lastOpenedAt
  assert(opened, 'Continuation must record campaign opening')
  const previousOpened = expectedContinuation.registry.campaigns.find(
    (c) => c.id === active
  )!
  assert(
    !previousOpened.lastOpenedAt ||
      Date.parse(opened) >= Date.parse(previousOpened.lastOpenedAt)
  )
  previousOpened.lastOpenedAt = opened
  const campaign = expectedContinuation.campaigns.find((c) => c.id === active)!
  for (const party of [campaign.party, campaign.game.session.party]) {
    assert.equal(
      party.members.length,
      1,
      'XP qualification requires one explicit character'
    )
    party.revision++
    party.members[0]!.xp += 25
  }
  assert.deepEqual(
    v.continued,
    expectedContinuation,
    'Unexpected saved changes'
  )
  assertPartyHistoryXp(h.migrated, h.continued, v.migrated, v.continued)
  assert.deepEqual(
    v.restored,
    expectedMigration,
    'Restore lost original content'
  )
  assertPartyHistoryMigration(h.source, h.restored)
  assert.deepEqual(v.protection, v.continued, 'Protective backup lost work')
  assert.deepEqual(
    v.protectedRestore,
    v.continued,
    'Protective backup was not restored'
  )
  assert.deepEqual(
    v.secondProtection,
    v.restored,
    'Second restoration lost preceding content'
  )
  assert.deepEqual(h.protection, h.continued)
  assert.deepEqual(h.protectedRestore, h.continued)
  assert.deepEqual(h.secondProtection, h.restored)
  // Only the empty identity freshly created from a pre-history source may vary.
  const migratedHistory = (value: z.infer<typeof history>) => {
    const normalized = structuredClone(value)
    if (h.source.installation.party_history_installation === null) {
      assertPartyHistoryMigration(h.source, value)
      normalized.installation.party_history_installation = [
        { singleton: 1, id: 'new-empty-installation-epoch' }
      ]
    }
    return normalized
  }
  const digest = (data: unknown, actions: unknown) =>
    profileDigest({ profile: data, history: actions })
  const migratedActions = migratedHistory(h.migrated)
  return {
    sourceUnchanged: true as const,
    campaigns: {
      active: 1,
      inactive: regular.length - 1,
      recoverableDeleted: trash.length
    },
    before: digest(v.source, h.source),
    migratedExpected: digest(expectedMigration, migratedActions),
    migratedActual: digest(v.migrated, migratedActions),
    continuedExpected: digest(expectedContinuation, h.continued),
    continuedActual: digest(v.continued, h.continued),
    restored: digest(v.restored, migratedHistory(h.restored)),
    protection: digest(v.protection, h.protection),
    protectedRestore: digest(v.protectedRestore, h.protectedRestore),
    secondProtection: digest(
      v.secondProtection,
      migratedHistory(h.secondProtection)
    )
  }
}
