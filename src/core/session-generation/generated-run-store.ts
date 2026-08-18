import type Database from 'better-sqlite3'
import {
  groupRewardGeneratedRunSchema,
  persistedGroupRewardGeneratedRunSchema,
  persistedSessionGeneratedRunSchema,
  sessionGeneratedRunSchema,
  type GeneratedRun,
  type GeneratedRewardBasis,
  type GroupRewardGeneratedRun,
  type PersistedGroupRewardGeneratedRun,
  type PersistedSessionGeneratedRun,
  type SessionGeneratedRun
} from '../../shared/contracts/session-generation.js'
import { GeneratedRunRewardBasisStore } from './generated-run-reward-basis-store.js'
import { GeneratedRunChildrenStore } from './generated-run-children-store.js'
import { SessionGeneratedRunRepository } from './session-generated-run-repository.js'
import { GroupRewardGeneratedRunRepository } from './group-reward-generated-run-repository.js'
import {
  deepFreeze,
  inputMembers,
  parseRunRootRow,
  runRootSelect,
  type GroupRewardRunRootRow,
  type SessionRunRootRow
} from './generated-run-row-codec.js'

export { initializeSessionGenerationSchema } from './generated-run-schema.js'

export class GeneratedRunStore {
  constructor(private readonly db: Database.Database) {}

  findByFingerprint(originFingerprint: string): GeneratedRun | null {
    return this.readRoot('origin_fingerprint = ?', originFingerprint)
  }

  read(id: string): GeneratedRun | null {
    return this.readRoot('id = ?', id)
  }

  save(run: SessionGeneratedRun): SessionGeneratedRun
  save(run: GroupRewardGeneratedRun): GroupRewardGeneratedRun
  save(
    run: SessionGeneratedRun | GroupRewardGeneratedRun
  ): SessionGeneratedRun | GroupRewardGeneratedRun {
    const parsed =
      run.runKind === 'session'
        ? sessionGeneratedRunSchema.parse(run)
        : groupRewardGeneratedRunSchema.parse(run)
    if (parsed.runKind === 'session')
      new SessionGeneratedRunRepository(this.db).save(parsed)
    else new GroupRewardGeneratedRunRepository(this.db).save(parsed)
    return deepFreeze(parsed)
  }

  private readRoot(where: string, value: string): GeneratedRun | null {
    const row = this.db
      .prepare(
        `${runRootSelect}
          WHERE run.${where}`
      )
      .get(value)
    if (!row) return null
    const parsed = parseRunRootRow(row)
    return parsed.runKind === 'session'
      ? this.hydrateSession(parsed)
      : this.hydrateGroupReward(parsed)
  }

  private hydrateSession(row: SessionRunRootRow): PersistedSessionGeneratedRun {
    const party = this.db
      .prepare(
        `SELECT level, quantity AS count
           FROM session_generation_party_level
          WHERE run_id = ? ORDER BY position`
      )
      .all(row.id)
    const encounterRows = this.db
      .prepare(
        `SELECT encounter_number AS encounterNumber, target_xp AS targetXp,
                adjusted_xp AS adjustedXp, xp_delta AS xpDelta, difficulty,
                pattern_id AS patternId, monster_count AS monsterCount,
                statblock_count AS statblockCount,
                effective_monster_count AS effectiveMonsterCount,
                xp_multiplier AS xpMultiplier, bossiness_rank AS bossinessRank
           FROM session_generation_encounter
          WHERE run_id = ? ORDER BY encounter_number`
      )
      .all(row.id) as Array<
      Record<string, unknown> & { encounterNumber: number }
    >
    const allBlocks = this.db
      .prepare(
        `SELECT encounter_number AS encounterNumber, role,
                challenge_rating AS challengeRating,
                challenge_rating_code AS challengeRatingCode, quantity,
                statblock_slots AS statblockSlots, unit_xp AS unitXp
           FROM session_generation_encounter_block
          WHERE run_id = ? ORDER BY encounter_number, position`
      )
      .all(row.id) as Array<
      Record<string, unknown> & { encounterNumber: number }
    >
    const allDiagnostics = this.db
      .prepare(
        `SELECT encounter_number AS encounterNumber,
                constraint_code AS constraintCode, actual_value AS value,
                minimum_value AS minimum, maximum_value AS maximum,
                normalized_distance AS normalizedDistance
           FROM session_generation_encounter_diagnostic
          WHERE run_id = ? ORDER BY encounter_number, position`
      )
      .all(row.id) as Array<{
      encounterNumber: number
      constraintCode: string
      value: number
      minimum: number
      maximum: number
      normalizedDistance: number
    }>
    const encounters = encounterRows.map((entry) => ({
      ...entry,
      blocks: allBlocks
        .filter(
          (candidate) => candidate.encounterNumber === entry.encounterNumber
        )
        .map(({ encounterNumber, ...candidate }) => {
          void encounterNumber
          return candidate
        }),
      constraintDiagnostics: allDiagnostics
        .filter(
          (candidate) => candidate.encounterNumber === entry.encounterNumber
        )
        .map(({ encounterNumber, constraintCode, ...candidate }) => {
          void encounterNumber
          return { constraint: constraintCode, ...candidate }
        })
    }))
    const treasures = this.readTreasures(row.id)
    const warningParameters = this.readParameters('warning', row.id)
    const warnings = (
      this.db
        .prepare(
          `SELECT position, code, encounter_number AS encounterNumber
           FROM session_generation_warning
          WHERE run_id = ? ORDER BY position`
        )
        .all(row.id) as Array<{
        position: number
        code: string
        encounterNumber: number
      }>
    ).map(({ position, ...entry }) => ({
      ...entry,
      parameters: warningParameters.get(position) ?? {}
    }))
    const auditParameters = this.readParameters('audit', row.id)
    const audits = (
      this.db
        .prepare(
          `SELECT position, code, passed, hard
             FROM session_generation_audit
            WHERE run_id = ? ORDER BY position`
        )
        .all(row.id) as Array<{
        position: number
        code: string
        passed: number
        hard: number
      }>
    ).map(({ position, ...entry }) => ({
      ...entry,
      passed: Boolean(entry.passed),
      hard: Boolean(entry.hard),
      parameters: auditParameters.get(position) ?? {}
    }))
    const rewardBasis = this.readRewardBasis(row.id)
    return deepFreeze(
      persistedSessionGeneratedRunSchema.parse({
        runKind: 'session',
        id: row.id,
        originFingerprint: row.originFingerprint,
        generatedAt: row.generatedAt,
        engineVersion: row.encounterEngineVersion,
        rewardEngineVersion: row.rewardEngineVersion,
        catalogVersion: row.catalogVersion,
        catalogContentHash: row.catalogContentHash,
        generatorPreset: {
          id: row.presetId,
          revision: row.presetRevision,
          configHash: row.presetConfigHash
        },
        input: {
          party,
          ...(rewardBasis
            ? {
                ledgerParty: inputMembers(
                  row.rewardEngineVersion,
                  rewardBasis.members
                )
              }
            : {}),
          adventureDayFraction: row.adventureDayFraction,
          ...(row.encounterCountInput === null
            ? {}
            : { encounterCount: row.encounterCountInput }),
          seed: row.seed
        },
        session: {
          partyCount: row.partyCount,
          dayXpBudget: row.dayXpBudget,
          sessionXpTarget: row.sessionXpTarget,
          averageLevel: row.averageLevel,
          encounterCount: row.resolvedEncounterCount,
          goldBudgetCp: row.goldBudgetCp,
          normalTreasureCount:
            treasures.length === 0 ? 0 : row.normalTreasureCount,
          overstockTreasureCount: row.overstockTreasureCount,
          magicTargets: {
            Common: row.magicCommon,
            Uncommon: row.magicUncommon,
            Rare: row.magicRare,
            'Very Rare': row.magicVeryRare,
            Legendary: row.magicLegendary
          }
        },
        rewardBasis,
        encounters,
        itemDefinitions: this.readItemDefinitions(row.id),
        treasures,
        rewardSummary: {
          normalValueCp: row.normalValueCp,
          overstockValueCp: row.overstockValueCp,
          magicCount: row.magicCount
        },
        warnings,
        audits
      })
    )
  }

  private hydrateGroupReward(
    row: GroupRewardRunRootRow
  ): PersistedGroupRewardGeneratedRun {
    const source = this.db
      .prepare(
        `SELECT scene_id AS sceneId, group_id AS groupId,
                scene_revision AS sceneRevision,
                group_revision AS groupRevision,
                party_revision AS partyRevision,
                campaign_rules_revision AS campaignRulesRevision,
                reward_xp_basis AS rewardXpBasis, base_xp AS baseXp,
                adjusted_xp AS adjustedXp, reward_xp AS rewardXp,
                gold_budget_cp AS goldBudgetCp, magic_common AS magicCommon,
                magic_uncommon AS magicUncommon, magic_rare AS magicRare,
                magic_very_rare AS magicVeryRare,
                magic_legendary AS magicLegendary,
                normal_value_cp AS normalValueCp, magic_count AS magicCount
           FROM session_generation_group_source WHERE run_id = ?`
      )
      .get(row.id) as {
      sceneId: string
      groupId: string
      sceneRevision: number
      groupRevision: number | null
      partyRevision: number
      campaignRulesRevision: number
      rewardXpBasis: 'base' | 'adjusted'
      baseXp: number
      adjustedXp: number
      rewardXp: number
      goldBudgetCp: number
      magicCommon: number
      magicUncommon: number
      magicRare: number
      magicVeryRare: number
      magicLegendary: number
      normalValueCp: number
      magicCount: number
    }
    const party = this.db
      .prepare(
        `SELECT level, quantity AS count
           FROM session_generation_party_level
          WHERE run_id = ? ORDER BY position`
      )
      .all(row.id)
    const groupEntries = this.db
      .prepare(
        `SELECT creature_id AS creatureId, alive_quantity AS quantity,
                dead_quantity AS deadQuantity
           FROM session_generation_group_entry
          WHERE run_id = ? ORDER BY position`
      )
      .all(row.id)
    const preset = this.db
      .prepare(
        `SELECT preset_id AS id, preset_revision AS revision,
                preset_config_hash AS configHash
           FROM session_generation_group_preset WHERE run_id = ?`
      )
      .get(row.id) as
      { id: string; revision: number; configHash: string } | undefined
    const rewardBasis = this.readRewardBasis(row.id)
    const auditParameters = this.readParameters('audit', row.id)
    const audits = (
      this.db
        .prepare(
          `SELECT position, code, passed, hard
             FROM session_generation_audit
            WHERE run_id = ? ORDER BY position`
        )
        .all(row.id) as Array<{
        position: number
        code: string
        passed: number
        hard: number
      }>
    ).map(({ position, ...entry }) => ({
      ...entry,
      passed: Boolean(entry.passed),
      hard: Boolean(entry.hard),
      parameters: auditParameters.get(position) ?? {}
    }))
    return deepFreeze(
      persistedGroupRewardGeneratedRunSchema.parse({
        runKind: 'group_reward',
        id: row.id,
        originFingerprint: row.originFingerprint,
        generatedAt: row.generatedAt,
        rewardEngineVersion: row.rewardEngineVersion,
        catalogVersion: row.catalogVersion,
        catalogContentHash: row.catalogContentHash,
        generatorPreset: preset ?? {
          id: '00000000-0000-4000-8000-000000000001',
          revision: 0,
          configHash: '0'.repeat(64)
        },
        input: {
          party,
          ...(rewardBasis
            ? {
                ledgerParty: inputMembers(
                  row.rewardEngineVersion,
                  rewardBasis.members
                )
              }
            : {}),
          sceneId: source.sceneId,
          groupId: source.groupId,
          sceneRevision: source.sceneRevision,
          groupRevision: source.groupRevision,
          groupEntries,
          partyRevision: source.partyRevision,
          campaignRulesRevision: source.campaignRulesRevision,
          rewardXpBasis: source.rewardXpBasis,
          baseXp: source.baseXp,
          adjustedXp: source.adjustedXp,
          rewardXp: source.rewardXp,
          seed: row.seed
        },
        rewardBasis,
        goldBudgetCp: source.goldBudgetCp,
        magicTargets: {
          Common: source.magicCommon,
          Uncommon: source.magicUncommon,
          Rare: source.magicRare,
          'Very Rare': source.magicVeryRare,
          Legendary: source.magicLegendary
        },
        itemDefinitions: this.readItemDefinitions(row.id),
        treasures: this.readTreasures(row.id),
        rewardSummary: {
          normalValueCp: source.normalValueCp,
          overstockValueCp: 0,
          magicCount: source.magicCount
        },
        audits
      })
    )
  }

  private readTreasures(runId: string): GeneratedRun['treasures'] {
    return new GeneratedRunChildrenStore(this.db).readTreasures(runId)
  }

  private readItemDefinitions(runId: string): GeneratedRun['itemDefinitions'] {
    return new GeneratedRunChildrenStore(this.db).readDefinitions(runId)
  }

  private readRewardBasis(runId: string): GeneratedRewardBasis | null {
    return new GeneratedRunRewardBasisStore(this.db).read(runId)
  }

  private readParameters(owner: 'warning' | 'audit', runId: string) {
    const positionColumn =
      owner === 'warning' ? 'warning_position' : 'audit_position'
    const rows = this.db
      .prepare(
        `SELECT ${positionColumn} AS position, parameter_key AS parameterKey,
                value_type AS valueType, text_value AS textValue,
                number_value AS numberValue, boolean_value AS booleanValue
           FROM session_generation_${owner}_parameter
          WHERE run_id = ? ORDER BY ${positionColumn}, parameter_key`
      )
      .all(runId) as Array<{
      position: number
      parameterKey: string
      valueType: 'string' | 'number' | 'boolean' | 'null'
      textValue: string | null
      numberValue: number | null
      booleanValue: number | null
    }>
    const result = new Map<
      number,
      Record<string, string | number | boolean | null>
    >()
    for (const row of rows) {
      const parameters = result.get(row.position) ?? {}
      parameters[row.parameterKey] =
        row.valueType === 'string'
          ? row.textValue!
          : row.valueType === 'number'
            ? row.numberValue!
            : row.valueType === 'boolean'
              ? Boolean(row.booleanValue)
              : null
      result.set(row.position, parameters)
    }
    return result
  }
}
