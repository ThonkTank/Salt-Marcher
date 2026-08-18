import type Database from 'better-sqlite3'
import type {
  GeneratedRun,
  GroupRewardGeneratedRun
} from '../../shared/contracts/session-generation.js'
import { GeneratedRunRewardBasisStore } from './generated-run-reward-basis-store.js'
import { GeneratedRunChildrenStore } from './generated-run-children-store.js'

export class GroupRewardGeneratedRunRepository {
  constructor(private readonly db: Database.Database) {}

  save(run: GroupRewardGeneratedRun): void {
    this.db.transaction(() => this.insertGroupReward(run)).immediate()
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
