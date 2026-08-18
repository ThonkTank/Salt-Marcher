import type Database from 'better-sqlite3'
import type {
  GeneratedRun,
  SessionGeneratedRun
} from '../../shared/contracts/session-generation.js'
import { GeneratedRunRewardBasisStore } from './generated-run-reward-basis-store.js'
import { GeneratedRunChildrenStore } from './generated-run-children-store.js'

export class SessionGeneratedRunRepository {
  constructor(private readonly db: Database.Database) {}

  save(run: SessionGeneratedRun): void {
    this.db.transaction(() => this.insertSession(run)).immediate()
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
}
