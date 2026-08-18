import { z } from 'zod'
import type { GeneratedRewardBasis } from '../../shared/contracts/session-generation.js'

const commonRootRowSchema = z.object({
  id: z.string(),
  originFingerprint: z.string(),
  generatedAt: z.string(),
  rewardEngineVersion: z.string(),
  catalogVersion: z.string(),
  catalogContentHash: z.string(),
  seed: z.number().int().nonnegative()
})

const sessionFields = {
  encounterEngineVersion: z.string(),
  presetId: z.string(),
  presetRevision: z.number().int().nonnegative(),
  presetConfigHash: z.string(),
  adventureDayFraction: z.string(),
  encounterCountInput: z.number().int().nullable(),
  partyCount: z.number().int(),
  dayXpBudget: z.number().int(),
  sessionXpTarget: z.number().int(),
  averageLevel: z.number(),
  resolvedEncounterCount: z.number().int(),
  goldBudgetCp: z.number().int(),
  normalTreasureCount: z.number().int(),
  overstockTreasureCount: z.number().int(),
  magicCommon: z.number().int(),
  magicUncommon: z.number().int(),
  magicRare: z.number().int(),
  magicVeryRare: z.number().int(),
  magicLegendary: z.number().int(),
  normalValueCp: z.number().int(),
  overstockValueCp: z.number().int(),
  magicCount: z.number().int()
} as const

const generatedRunRootRowSchema = z.discriminatedUnion('runKind', [
  commonRootRowSchema.extend({
    runKind: z.literal('session'),
    ...sessionFields
  }),
  commonRootRowSchema.extend({
    runKind: z.literal('group_reward'),
    ...Object.fromEntries(
      Object.keys(sessionFields).map((key) => [key, z.null()])
    )
  })
])

export type RunRootRow = z.output<typeof generatedRunRootRowSchema>
export type SessionRunRootRow = Extract<RunRootRow, { runKind: 'session' }>
export type GroupRewardRunRootRow = Extract<
  RunRootRow,
  { runKind: 'group_reward' }
>

export function parseRunRootRow(value: unknown): RunRootRow {
  return generatedRunRootRowSchema.parse(value)
}

export const runRootSelect = `
  SELECT run.id, run.run_kind AS runKind,
         run.origin_fingerprint AS originFingerprint,
         run.generated_at AS generatedAt,
         run.encounter_engine_version AS encounterEngineVersion,
         run.reward_engine_version AS rewardEngineVersion,
         run.catalog_version AS catalogVersion,
         run.catalog_content_hash AS catalogContentHash,
         run.preset_id AS presetId, run.preset_revision AS presetRevision,
         run.preset_config_hash AS presetConfigHash, run.seed,
         session.adventure_day_fraction AS adventureDayFraction,
         session.encounter_count_input AS encounterCountInput,
         session.party_count AS partyCount,
         session.day_xp_budget AS dayXpBudget,
         session.session_xp_target AS sessionXpTarget,
         session.average_level AS averageLevel,
         session.resolved_encounter_count AS resolvedEncounterCount,
         session.gold_budget_cp AS goldBudgetCp,
         session.normal_treasure_count AS normalTreasureCount,
         session.overstock_treasure_count AS overstockTreasureCount,
         session.magic_common AS magicCommon,
         session.magic_uncommon AS magicUncommon,
         session.magic_rare AS magicRare,
         session.magic_very_rare AS magicVeryRare,
         session.magic_legendary AS magicLegendary,
         session.normal_value_cp AS normalValueCp,
         session.overstock_value_cp AS overstockValueCp,
         session.magic_count AS magicCount
    FROM session_generation_run AS run
    LEFT JOIN session_generation_session AS session ON session.run_id = run.id`

export function inputMembers(
  rewardEngineVersion: string,
  members: GeneratedRewardBasis['members']
): readonly Record<string, unknown>[] {
  if (rewardEngineVersion === 'reward-v3')
    return members.map(({ projectedXp: _projectedXp, ...member }) => {
      void _projectedXp
      if (member.level === undefined)
        throw new Error('Current reward member is missing its level')
      return member
    })
  return members.map(({ level: _level, ...member }) => {
    void _level
    return member
  })
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
