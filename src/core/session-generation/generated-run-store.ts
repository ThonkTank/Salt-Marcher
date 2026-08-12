import type Database from 'better-sqlite3'
import {
  generatedRunSchema,
  groupRewardGeneratedRunSchema,
  sessionGeneratedRunSchema,
  type GeneratedRun,
  type GroupRewardGeneratedRun,
  type SessionGeneratedRun
} from '../../shared/contracts/session-generation.js'

type RunRootRow = Readonly<{
  id: string
  runKind: 'session' | 'group_reward'
  originFingerprint: string
  generatedAt: string
  encounterEngineVersion: string
  rewardEngineVersion: string
  catalogVersion: string
  catalogContentHash: string
  presetId: string
  presetRevision: number
  presetConfigHash: string
  adventureDayFraction: string
  encounterCountInput: number | null
  seed: number
  partyCount: number
  dayXpBudget: number
  sessionXpTarget: number
  averageLevel: number
  resolvedEncounterCount: number
  goldBudgetCp: number
  normalTreasureCount: number
  overstockTreasureCount: number
  magicCommon: number
  magicUncommon: number
  magicRare: number
  magicVeryRare: number
  magicLegendary: number
  normalValueCp: number
  overstockValueCp: number
  magicCount: number
}>

export function initializeSessionGenerationSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_generation_run (
      id TEXT PRIMARY KEY NOT NULL,
      run_kind TEXT NOT NULL CHECK(run_kind IN ('session', 'group_reward')),
      origin_fingerprint TEXT NOT NULL UNIQUE,
      generated_at TEXT NOT NULL,
      encounter_engine_version TEXT,
      reward_engine_version TEXT NOT NULL,
      catalog_version TEXT NOT NULL,
      catalog_content_hash TEXT NOT NULL,
      preset_id TEXT,
      preset_revision INTEGER CHECK(preset_revision IS NULL OR preset_revision >= 0),
      preset_config_hash TEXT,
      seed INTEGER NOT NULL CHECK(seed >= 0),
      UNIQUE(id, run_kind),
      CHECK(
        (run_kind = 'session' AND encounter_engine_version IS NOT NULL AND
         preset_id IS NOT NULL AND preset_revision IS NOT NULL AND
         preset_config_hash IS NOT NULL) OR
        (run_kind = 'group_reward' AND encounter_engine_version IS NULL AND
         preset_id IS NULL AND preset_revision IS NULL AND
         preset_config_hash IS NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS session_generation_party_level (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 20),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      PRIMARY KEY (run_id, position),
      UNIQUE (run_id, level),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_session (
      run_id TEXT PRIMARY KEY NOT NULL,
      run_kind TEXT NOT NULL DEFAULT 'session' CHECK(run_kind = 'session'),
      adventure_day_fraction TEXT NOT NULL,
      encounter_count_input INTEGER CHECK(encounter_count_input BETWEEN 1 AND 10),
      party_count INTEGER NOT NULL CHECK(party_count > 0),
      day_xp_budget INTEGER NOT NULL CHECK(day_xp_budget >= 0),
      session_xp_target INTEGER NOT NULL CHECK(session_xp_target >= 0),
      average_level REAL NOT NULL CHECK(average_level BETWEEN 1 AND 20),
      resolved_encounter_count INTEGER NOT NULL CHECK(resolved_encounter_count BETWEEN 1 AND 10),
      gold_budget_cp INTEGER NOT NULL CHECK(gold_budget_cp >= 0),
      normal_treasure_count INTEGER NOT NULL CHECK(normal_treasure_count > 0),
      overstock_treasure_count INTEGER NOT NULL CHECK(overstock_treasure_count BETWEEN 0 AND 1),
      magic_common INTEGER NOT NULL CHECK(magic_common >= 0),
      magic_uncommon INTEGER NOT NULL CHECK(magic_uncommon >= 0),
      magic_rare INTEGER NOT NULL CHECK(magic_rare >= 0),
      magic_very_rare INTEGER NOT NULL CHECK(magic_very_rare >= 0),
      magic_legendary INTEGER NOT NULL CHECK(magic_legendary >= 0),
      normal_value_cp INTEGER NOT NULL CHECK(normal_value_cp >= 0),
      overstock_value_cp INTEGER NOT NULL CHECK(overstock_value_cp >= 0),
      magic_count INTEGER NOT NULL CHECK(magic_count >= 0),
      FOREIGN KEY (run_id, run_kind)
        REFERENCES session_generation_run(id, run_kind)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_group_source (
      run_id TEXT PRIMARY KEY NOT NULL,
      run_kind TEXT NOT NULL DEFAULT 'group_reward'
        CHECK(run_kind = 'group_reward'),
      scene_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      scene_revision INTEGER NOT NULL CHECK(scene_revision >= 0),
      group_revision INTEGER CHECK(group_revision IS NULL OR group_revision >= 0),
      party_revision INTEGER NOT NULL CHECK(party_revision >= 0),
      campaign_rules_revision INTEGER NOT NULL CHECK(campaign_rules_revision >= 0),
      reward_xp_basis TEXT NOT NULL CHECK(reward_xp_basis IN ('base', 'adjusted')),
      base_xp INTEGER NOT NULL CHECK(base_xp >= 0),
      adjusted_xp INTEGER NOT NULL CHECK(adjusted_xp >= 0),
      reward_xp INTEGER NOT NULL CHECK(reward_xp >= 0),
      gold_budget_cp INTEGER NOT NULL CHECK(gold_budget_cp >= 0),
      magic_common INTEGER NOT NULL CHECK(magic_common >= 0),
      magic_uncommon INTEGER NOT NULL CHECK(magic_uncommon >= 0),
      magic_rare INTEGER NOT NULL CHECK(magic_rare >= 0),
      magic_very_rare INTEGER NOT NULL CHECK(magic_very_rare >= 0),
      magic_legendary INTEGER NOT NULL CHECK(magic_legendary >= 0),
      normal_value_cp INTEGER NOT NULL CHECK(normal_value_cp >= 0),
      magic_count INTEGER NOT NULL CHECK(magic_count >= 0),
      FOREIGN KEY (run_id, run_kind)
        REFERENCES session_generation_run(id, run_kind)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_group_entry (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      creature_id TEXT NOT NULL,
      alive_quantity INTEGER NOT NULL CHECK(alive_quantity >= 0),
      dead_quantity INTEGER NOT NULL CHECK(dead_quantity >= 0),
      PRIMARY KEY (run_id, position),
      UNIQUE (run_id, creature_id),
      FOREIGN KEY (run_id) REFERENCES session_generation_group_source(run_id)
        ON DELETE RESTRICT,
      CHECK(alive_quantity + dead_quantity > 0)
    );

    CREATE TABLE IF NOT EXISTS session_generation_encounter (
      run_id TEXT NOT NULL,
      encounter_number INTEGER NOT NULL CHECK(encounter_number > 0),
      target_xp INTEGER NOT NULL CHECK(target_xp >= 0),
      adjusted_xp INTEGER NOT NULL CHECK(adjusted_xp >= 0),
      xp_delta INTEGER NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('EASY','MEDIUM','HARD','DEADLY')),
      pattern_id TEXT NOT NULL,
      monster_count INTEGER NOT NULL CHECK(monster_count > 0),
      statblock_count INTEGER NOT NULL CHECK(statblock_count > 0),
      effective_monster_count REAL NOT NULL CHECK(effective_monster_count > 0),
      xp_multiplier REAL NOT NULL CHECK(xp_multiplier > 0),
      bossiness_rank INTEGER NOT NULL CHECK(bossiness_rank > 0),
      PRIMARY KEY (run_id, encounter_number),
      FOREIGN KEY (run_id) REFERENCES session_generation_session(run_id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_encounter_block (
      run_id TEXT NOT NULL,
      encounter_number INTEGER NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      role TEXT NOT NULL CHECK(role IN ('Minion','Support','Standard','Elite','Boss')),
      challenge_rating TEXT NOT NULL,
      challenge_rating_code INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      statblock_slots INTEGER NOT NULL CHECK(statblock_slots > 0),
      unit_xp INTEGER NOT NULL CHECK(unit_xp >= 0),
      PRIMARY KEY (run_id, encounter_number, position),
      FOREIGN KEY (run_id, encounter_number)
        REFERENCES session_generation_encounter(run_id, encounter_number)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_encounter_diagnostic (
      run_id TEXT NOT NULL,
      encounter_number INTEGER NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      constraint_code TEXT NOT NULL CHECK(constraint_code IN ('statblocks','monsters','initiativeSlots')),
      actual_value REAL NOT NULL,
      minimum_value REAL NOT NULL,
      maximum_value REAL NOT NULL,
      normalized_distance REAL NOT NULL CHECK(normalized_distance >= 0),
      PRIMARY KEY (run_id, encounter_number, position),
      FOREIGN KEY (run_id, encounter_number)
        REFERENCES session_generation_encounter(run_id, encounter_number)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_treasure (
      run_id TEXT NOT NULL,
      run_kind TEXT NOT NULL CHECK(run_kind IN ('session', 'group_reward')),
      id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      stock_class TEXT NOT NULL CHECK(stock_class IN ('normal','overstock')),
      reward_channel TEXT NOT NULL CHECK(reward_channel IN ('encounter','quest','environment')),
      anchor_encounter_number INTEGER CHECK(anchor_encounter_number IS NULL OR anchor_encounter_number > 0),
      theme_id TEXT NOT NULL,
      theme TEXT NOT NULL,
      target_value_cp TEXT NOT NULL,
      actual_value_cp INTEGER NOT NULL CHECK(actual_value_cp >= 0),
      PRIMARY KEY (run_id, id),
      UNIQUE (run_id, position),
      FOREIGN KEY (run_id, run_kind)
        REFERENCES session_generation_run(id, run_kind)
        ON DELETE RESTRICT,
      CHECK(
        run_kind = 'session' OR
        (stock_class = 'normal' AND reward_channel = 'encounter')
      )
    );

    CREATE TABLE IF NOT EXISTS session_generation_container (
      run_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      catalog_container_id TEXT,
      name TEXT NOT NULL,
      capacity REAL NOT NULL CHECK(capacity >= 0),
      PRIMARY KEY (run_id, treasure_id, id),
      UNIQUE (run_id, treasure_id, position),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_item (
      run_id TEXT NOT NULL,
      treasure_id TEXT NOT NULL,
      id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      catalog_item_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('compact_value','complex_value','useful','flavor','magic')),
      name TEXT NOT NULL,
      modifier TEXT,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_value_cp INTEGER NOT NULL CHECK(unit_value_cp >= 0),
      total_value_cp INTEGER NOT NULL CHECK(total_value_cp >= 0),
      stackable INTEGER NOT NULL CHECK(stackable IN (0,1)),
      magic INTEGER NOT NULL CHECK(magic IN (0,1)),
      rarity TEXT CHECK(rarity IS NULL OR rarity IN ('Common','Uncommon','Rare','Very Rare','Legendary')),
      curse_name TEXT,
      curse_effect TEXT,
      container_id TEXT,
      capacity REAL NOT NULL CHECK(capacity >= 0),
      PRIMARY KEY (run_id, treasure_id, id),
      UNIQUE (run_id, treasure_id, position),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (run_id, treasure_id, container_id)
        REFERENCES session_generation_container(run_id, treasure_id, id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_warning (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      code TEXT NOT NULL CHECK(code IN ('candidate_outside_tolerance','constraints_approximated')),
      encounter_number INTEGER NOT NULL CHECK(encounter_number > 0),
      PRIMARY KEY (run_id, position),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_warning_parameter (
      run_id TEXT NOT NULL,
      warning_position INTEGER NOT NULL CHECK(warning_position >= 0),
      parameter_key TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK(value_type IN ('string','number','boolean','null')),
      text_value TEXT,
      number_value REAL,
      boolean_value INTEGER CHECK(boolean_value IN (0,1)),
      CHECK(
        (value_type = 'string' AND text_value IS NOT NULL AND number_value IS NULL AND boolean_value IS NULL) OR
        (value_type = 'number' AND text_value IS NULL AND number_value IS NOT NULL AND boolean_value IS NULL) OR
        (value_type = 'boolean' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NOT NULL) OR
        (value_type = 'null' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NULL)
      ),
      PRIMARY KEY (run_id, warning_position, parameter_key),
      FOREIGN KEY (run_id, warning_position)
        REFERENCES session_generation_warning(run_id, position)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_audit (
      run_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      code TEXT NOT NULL CHECK(code IN (
        'encounter_target_sum','candidate_coverage','encounter_selector_fit',
        'deterministic_seed_path','treasure_count','unique_encounter_anchors',
        'treasure_assignment_complete','normal_loot_budget_tolerance',
        'magic_item_count','packing_validity'
      )),
      passed INTEGER NOT NULL CHECK(passed IN (0,1)),
      hard INTEGER NOT NULL CHECK(hard IN (0,1)),
      PRIMARY KEY (run_id, position),
      FOREIGN KEY (run_id) REFERENCES session_generation_run(id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_audit_parameter (
      run_id TEXT NOT NULL,
      audit_position INTEGER NOT NULL CHECK(audit_position >= 0),
      parameter_key TEXT NOT NULL,
      value_type TEXT NOT NULL CHECK(value_type IN ('string','number','boolean','null')),
      text_value TEXT,
      number_value REAL,
      boolean_value INTEGER CHECK(boolean_value IN (0,1)),
      CHECK(
        (value_type = 'string' AND text_value IS NOT NULL AND number_value IS NULL AND boolean_value IS NULL) OR
        (value_type = 'number' AND text_value IS NULL AND number_value IS NOT NULL AND boolean_value IS NULL) OR
        (value_type = 'boolean' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NOT NULL) OR
        (value_type = 'null' AND text_value IS NULL AND number_value IS NULL AND boolean_value IS NULL)
      ),
      PRIMARY KEY (run_id, audit_position, parameter_key),
      FOREIGN KEY (run_id, audit_position)
        REFERENCES session_generation_audit(run_id, position)
        ON DELETE RESTRICT
    );
  `)
}

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
  save(run: GeneratedRun): GeneratedRun
  save(run: GeneratedRun): GeneratedRun {
    const parsed = generatedRunSchema.parse(run)
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
        run.session.normalTreasureCount,
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
    const treasure = this.db.prepare(
      `INSERT INTO session_generation_treasure (
         run_id, run_kind, id, position, stock_class, reward_channel,
         anchor_encounter_number, theme_id, theme, target_value_cp,
         actual_value_cp
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const container = this.db.prepare(
      `INSERT INTO session_generation_container (
         run_id, treasure_id, id, position, catalog_container_id, name,
         capacity
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const item = this.db.prepare(
      `INSERT INTO session_generation_item (
         run_id, treasure_id, id, position, catalog_item_id, role, name,
         modifier, quantity, unit_value_cp, total_value_cp, stackable, magic,
         rarity, curse_name, curse_effect, container_id, capacity
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    run.treasures.forEach((entry, position) => {
      treasure.run(
        run.id,
        run.runKind,
        entry.id,
        position,
        entry.stockClass,
        entry.rewardChannel,
        entry.anchorEncounterNumber,
        entry.themeId,
        entry.theme,
        entry.targetValueCp,
        entry.actualValueCp
      )
      entry.containers.forEach((candidate) =>
        container.run(
          run.id,
          entry.id,
          candidate.id,
          candidate.position,
          candidate.catalogContainerId,
          candidate.name,
          candidate.capacity
        )
      )
      entry.items.forEach((candidate) =>
        item.run(
          run.id,
          entry.id,
          candidate.id,
          candidate.position,
          candidate.catalogItemId,
          candidate.role,
          candidate.name,
          candidate.modifier,
          candidate.quantity,
          candidate.unitValueCp,
          candidate.totalValueCp,
          Number(candidate.stackable),
          Number(candidate.magic),
          candidate.rarity,
          candidate.curseName,
          candidate.curseEffect,
          candidate.containerId,
          candidate.capacity
        )
      )
    })
  }

  private readRoot(where: string, value: string): GeneratedRun | null {
    const row = this.db
      .prepare(
        `${runRootSelect}
          WHERE run.${where}`
      )
      .get(value) as RunRootRow | undefined
    if (!row) return null
    return row.runKind === 'session'
      ? this.hydrateSession(row)
      : this.hydrateGroupReward(row)
  }

  private hydrateSession(row: RunRootRow): SessionGeneratedRun {
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
    return deepFreeze(
      sessionGeneratedRunSchema.parse({
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
          normalTreasureCount: row.normalTreasureCount,
          overstockTreasureCount: row.overstockTreasureCount,
          magicTargets: {
            Common: row.magicCommon,
            Uncommon: row.magicUncommon,
            Rare: row.magicRare,
            'Very Rare': row.magicVeryRare,
            Legendary: row.magicLegendary
          }
        },
        encounters,
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

  private hydrateGroupReward(row: RunRootRow): GroupRewardGeneratedRun {
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
      groupRewardGeneratedRunSchema.parse({
        runKind: 'group_reward',
        id: row.id,
        originFingerprint: row.originFingerprint,
        generatedAt: row.generatedAt,
        rewardEngineVersion: row.rewardEngineVersion,
        catalogVersion: row.catalogVersion,
        catalogContentHash: row.catalogContentHash,
        input: {
          party,
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
        goldBudgetCp: source.goldBudgetCp,
        magicTargets: {
          Common: source.magicCommon,
          Uncommon: source.magicUncommon,
          Rare: source.magicRare,
          'Very Rare': source.magicVeryRare,
          Legendary: source.magicLegendary
        },
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
    const treasureRows = this.db
      .prepare(
        `SELECT id, stock_class AS stockClass,
                reward_channel AS rewardChannel,
                anchor_encounter_number AS anchorEncounterNumber,
                theme_id AS themeId, theme, target_value_cp AS targetValueCp,
                actual_value_cp AS actualValueCp
           FROM session_generation_treasure
          WHERE run_id = ? ORDER BY position`
      )
      .all(runId) as Array<Record<string, unknown> & { id: string }>
    const containers = this.db
      .prepare(
        `SELECT treasure_id AS treasureId, id,
                catalog_container_id AS catalogContainerId, name, capacity,
                position
           FROM session_generation_container
          WHERE run_id = ? ORDER BY treasure_id, position`
      )
      .all(runId) as Array<Record<string, unknown> & { treasureId: string }>
    const items = (
      this.db
        .prepare(
          `SELECT treasure_id AS treasureId, id,
                  catalog_item_id AS catalogItemId, role, name, modifier,
                  quantity, unit_value_cp AS unitValueCp,
                  total_value_cp AS totalValueCp, stackable, magic, rarity,
                  curse_name AS curseName, curse_effect AS curseEffect,
                  container_id AS containerId, capacity, position
             FROM session_generation_item
            WHERE run_id = ? ORDER BY treasure_id, position`
        )
        .all(runId) as Array<
        Record<string, unknown> & {
          treasureId: string
          stackable: number
          magic: number
        }
      >
    ).map((entry) => ({
      ...entry,
      stackable: Boolean(entry.stackable),
      magic: Boolean(entry.magic)
    }))
    return treasureRows.map((entry) => ({
      ...entry,
      containers: containers
        .filter((candidate) => candidate.treasureId === entry.id)
        .map(({ treasureId, ...candidate }) => {
          void treasureId
          return candidate
        }),
      items: items
        .filter((candidate) => candidate.treasureId === entry.id)
        .map((candidate) => candidate)
    })) as GeneratedRun['treasures']
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

const runRootSelect = `
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

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
