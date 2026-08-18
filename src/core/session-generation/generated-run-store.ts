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
    this.db
      .transaction(() =>
        parsed.runKind === 'session'
          ? this.insertSession(parsed)
          : this.insertGroupReward(parsed)
      )
      .immediate()
    return deepFreeze(parsed)
  }

  private insertSession(run: SessionGeneratedRun): void {
    this.db
      .prepare(
        `INSERT INTO session_generation_run (
           id, run_kind, origin_fingerprint, generated_at,
           encounter_engine_version, reward_engine_version, catalog_version,
           catalog_content_hash, preset_id, preset_revision,
           preset_config_hash, seed
         ) VALUES (?, 'session', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.originFingerprint,
        run.generatedAt,
        run.engineVersion,
        run.rewardEngineVersion,
        run.catalogVersion,
        run.catalogContentHash,
        run.generatorPreset.id,
        run.generatorPreset.revision,
        run.generatorPreset.configHash,
        run.input.seed
      )
    const insertParty = this.db.prepare(
      `INSERT INTO session_generation_party_level (
         run_id, position, level, quantity
       ) VALUES (?, ?, ?, ?)`
    )
    run.input.party.forEach((entry, position) =>
      insertParty.run(run.id, position, entry.level, entry.count)
    )
    this.db
      .prepare(
        `INSERT INTO session_generation_session (
           run_id, adventure_day_fraction, encounter_count_input, party_count,
           day_xp_budget, session_xp_target, average_level,
           resolved_encounter_count, gold_budget_cp, normal_treasure_count,
           overstock_treasure_count, magic_common, magic_uncommon, magic_rare,
           magic_very_rare, magic_legendary, normal_value_cp,
           overstock_value_cp, magic_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.input.adventureDayFraction,
        run.input.encounterCount ?? null,
        run.session.partyCount,
        run.session.dayXpBudget,
        run.session.sessionXpTarget,
        run.session.averageLevel,
        run.session.encounterCount,
        run.session.goldBudgetCp,
        Math.max(1, run.session.normalTreasureCount),
        run.session.overstockTreasureCount,
        run.session.magicTargets.Common,
        run.session.magicTargets.Uncommon,
        run.session.magicTargets.Rare,
        run.session.magicTargets['Very Rare'],
        run.session.magicTargets.Legendary,
        run.rewardSummary.normalValueCp,
        run.rewardSummary.overstockValueCp,
        run.rewardSummary.magicCount
      )
    this.insertRewardBasis(run)
    this.insertEncounters(run)
    this.insertTreasures(run)
    const warning = this.db.prepare(
      `INSERT INTO session_generation_warning (
         run_id, position, code, encounter_number
       ) VALUES (?, ?, ?, ?)`
    )
    run.warnings.forEach((entry, position) => {
      warning.run(run.id, position, entry.code, entry.encounterNumber)
      this.insertParameters('warning', run.id, position, entry.parameters)
    })
    const audit = this.db.prepare(
      `INSERT INTO session_generation_audit (
         run_id, position, code, passed, hard
       ) VALUES (?, ?, ?, ?, ?)`
    )
    run.audits.forEach((entry, position) => {
      audit.run(
        run.id,
        position,
        entry.code,
        Number(entry.passed),
        Number(entry.hard)
      )
      this.insertParameters('audit', run.id, position, entry.parameters)
    })
  }

  private insertGroupReward(run: GroupRewardGeneratedRun): void {
    this.db
      .prepare(
        `INSERT INTO session_generation_run (
           id, run_kind, origin_fingerprint, generated_at,
           encounter_engine_version, reward_engine_version, catalog_version,
           catalog_content_hash, preset_id, preset_revision,
           preset_config_hash, seed
         ) VALUES (?, 'group_reward', ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?)`
      )
      .run(
        run.id,
        run.originFingerprint,
        run.generatedAt,
        run.rewardEngineVersion,
        run.catalogVersion,
        run.catalogContentHash,
        run.input.seed
      )
    const insertParty = this.db.prepare(
      `INSERT INTO session_generation_party_level (
         run_id, position, level, quantity
       ) VALUES (?, ?, ?, ?)`
    )
    run.input.party.forEach((entry, position) =>
      insertParty.run(run.id, position, entry.level, entry.count)
    )
    this.db
      .prepare(
        `INSERT INTO session_generation_group_source (
           run_id, scene_id, group_id, scene_revision, group_revision,
           party_revision, campaign_rules_revision, reward_xp_basis, base_xp,
           adjusted_xp, reward_xp, gold_budget_cp, magic_common,
           magic_uncommon, magic_rare, magic_very_rare, magic_legendary,
           normal_value_cp, magic_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.input.sceneId,
        run.input.groupId,
        run.input.sceneRevision,
        run.input.groupRevision,
        run.input.partyRevision,
        run.input.campaignRulesRevision,
        run.input.rewardXpBasis,
        run.input.baseXp,
        run.input.adjustedXp,
        run.input.rewardXp,
        run.goldBudgetCp,
        run.magicTargets.Common,
        run.magicTargets.Uncommon,
        run.magicTargets.Rare,
        run.magicTargets['Very Rare'],
        run.magicTargets.Legendary,
        run.rewardSummary.normalValueCp,
        run.rewardSummary.magicCount
      )
    this.db
      .prepare(
        `INSERT INTO session_generation_group_preset (
           run_id, preset_id, preset_revision, preset_config_hash
         ) VALUES (?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.generatorPreset.id,
        run.generatorPreset.revision,
        run.generatorPreset.configHash
      )
    this.insertRewardBasis(run)
    const insertGroupEntry = this.db.prepare(
      `INSERT INTO session_generation_group_entry (
         run_id, position, creature_id, alive_quantity, dead_quantity
       ) VALUES (?, ?, ?, ?, ?)`
    )
    run.input.groupEntries.forEach((entry, position) =>
      insertGroupEntry.run(
        run.id,
        position,
        entry.creatureId,
        entry.quantity,
        entry.deadQuantity
      )
    )
    this.insertTreasures(run)
    const audit = this.db.prepare(
      `INSERT INTO session_generation_audit (
         run_id, position, code, passed, hard
       ) VALUES (?, ?, ?, ?, ?)`
    )
    run.audits.forEach((entry, position) => {
      audit.run(
        run.id,
        position,
        entry.code,
        Number(entry.passed),
        Number(entry.hard)
      )
      this.insertParameters('audit', run.id, position, entry.parameters)
    })
  }

  private insertRewardBasis(run: GeneratedRun): void {
    new GeneratedRunRewardBasisStore(this.db).insert(run)
  }

  private insertEncounters(run: SessionGeneratedRun): void {
    const encounter = this.db.prepare(
      `INSERT INTO session_generation_encounter (
         run_id, encounter_number, target_xp, adjusted_xp, xp_delta,
         difficulty, pattern_id, monster_count, statblock_count,
         effective_monster_count, xp_multiplier, bossiness_rank
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const block = this.db.prepare(
      `INSERT INTO session_generation_encounter_block (
         run_id, encounter_number, position, role, challenge_rating,
         challenge_rating_code, quantity, statblock_slots, unit_xp
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const diagnostic = this.db.prepare(
      `INSERT INTO session_generation_encounter_diagnostic (
         run_id, encounter_number, position, constraint_code, actual_value,
         minimum_value, maximum_value, normalized_distance
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const entry of run.encounters) {
      encounter.run(
        run.id,
        entry.encounterNumber,
        entry.targetXp,
        entry.adjustedXp,
        entry.xpDelta,
        entry.difficulty,
        entry.patternId,
        entry.monsterCount,
        entry.statblockCount,
        entry.effectiveMonsterCount,
        entry.xpMultiplier,
        entry.bossinessRank
      )
      entry.blocks.forEach((candidate, position) =>
        block.run(
          run.id,
          entry.encounterNumber,
          position,
          candidate.role,
          candidate.challengeRating,
          candidate.challengeRatingCode,
          candidate.quantity,
          candidate.statblockSlots,
          candidate.unitXp
        )
      )
      entry.constraintDiagnostics.forEach((detail, position) =>
        diagnostic.run(
          run.id,
          entry.encounterNumber,
          position,
          detail.constraint,
          detail.value,
          detail.minimum,
          detail.maximum,
          detail.normalizedDistance
        )
      )
    }
  }

  private insertParameters(
    owner: 'warning' | 'audit',
    runId: string,
    position: number,
    parameters: Readonly<Record<string, string | number | boolean | null>>
  ): void {
    const positionColumn =
      owner === 'warning' ? 'warning_position' : 'audit_position'
    const insert = this.db.prepare(
      `INSERT INTO session_generation_${owner}_parameter (
         run_id, ${positionColumn}, parameter_key, value_type, text_value,
         number_value, boolean_value
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const [key, value] of Object.entries(parameters).toSorted(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)
    )) {
      const valueType =
        value === null
          ? 'null'
          : (typeof value as 'string' | 'number' | 'boolean')
      insert.run(
        runId,
        position,
        key,
        valueType,
        typeof value === 'string' ? value : null,
        typeof value === 'number' ? value : null,
        typeof value === 'boolean' ? Number(value) : null
      )
    }
  }

  private insertTreasures(run: GeneratedRun): void {
    new GeneratedRunChildrenStore(this.db).insert(run)
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
