import type Database from 'better-sqlite3'

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
      normal_treasure_count INTEGER NOT NULL CHECK(normal_treasure_count >= 0),
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

    CREATE TABLE IF NOT EXISTS session_generation_group_preset (
      run_id TEXT PRIMARY KEY NOT NULL REFERENCES session_generation_group_source(run_id)
        ON DELETE RESTRICT,
      preset_id TEXT NOT NULL,
      preset_revision INTEGER NOT NULL CHECK(preset_revision >= 0),
      preset_config_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_generation_reward_basis (
      run_id TEXT PRIMARY KEY NOT NULL REFERENCES session_generation_run(id)
        ON DELETE RESTRICT,
      target_gold_cp INTEGER NOT NULL CHECK(target_gold_cp >= 0),
      current_gold_cp INTEGER NOT NULL CHECK(current_gold_cp >= 0),
      gold_deficit_cp INTEGER NOT NULL CHECK(gold_deficit_cp >= 0),
      target_common INTEGER NOT NULL CHECK(target_common >= 0),
      target_uncommon INTEGER NOT NULL CHECK(target_uncommon >= 0),
      target_rare INTEGER NOT NULL CHECK(target_rare >= 0),
      target_very_rare INTEGER NOT NULL CHECK(target_very_rare >= 0),
      target_legendary INTEGER NOT NULL CHECK(target_legendary >= 0),
      current_common INTEGER NOT NULL CHECK(current_common >= 0),
      current_uncommon INTEGER NOT NULL CHECK(current_uncommon >= 0),
      current_rare INTEGER NOT NULL CHECK(current_rare >= 0),
      current_very_rare INTEGER NOT NULL CHECK(current_very_rare >= 0),
      current_legendary INTEGER NOT NULL CHECK(current_legendary >= 0),
      deficit_common INTEGER NOT NULL CHECK(deficit_common >= 0),
      deficit_uncommon INTEGER NOT NULL CHECK(deficit_uncommon >= 0),
      deficit_rare INTEGER NOT NULL CHECK(deficit_rare >= 0),
      deficit_very_rare INTEGER NOT NULL CHECK(deficit_very_rare >= 0),
      deficit_legendary INTEGER NOT NULL CHECK(deficit_legendary >= 0)
    );

    CREATE TABLE IF NOT EXISTS session_generation_reward_member (
      run_id TEXT NOT NULL REFERENCES session_generation_reward_basis(run_id)
        ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK(position >= 0),
      character_id TEXT NOT NULL,
      level INTEGER CHECK(level BETWEEN 1 AND 20),
      current_xp INTEGER NOT NULL CHECK(current_xp >= 0),
      projected_xp INTEGER NOT NULL CHECK(projected_xp >= 0),
      ledger_revision INTEGER NOT NULL CHECK(ledger_revision >= 0),
      current_non_magic_cp INTEGER NOT NULL CHECK(current_non_magic_cp >= 0),
      magic_common INTEGER NOT NULL CHECK(magic_common >= 0),
      magic_uncommon INTEGER NOT NULL CHECK(magic_uncommon >= 0),
      magic_rare INTEGER NOT NULL CHECK(magic_rare >= 0),
      magic_very_rare INTEGER NOT NULL CHECK(magic_very_rare >= 0),
      magic_legendary INTEGER NOT NULL CHECK(magic_legendary >= 0),
      PRIMARY KEY (run_id, position),
      UNIQUE (run_id, character_id)
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
      item_reference_json TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('compact_value','complex_value','useful','flavor','magic')),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      container_id TEXT,
      PRIMARY KEY (run_id, treasure_id, id),
      UNIQUE (run_id, treasure_id, position),
      FOREIGN KEY (run_id, treasure_id)
        REFERENCES session_generation_treasure(run_id, id)
        ON DELETE RESTRICT,
      FOREIGN KEY (run_id, treasure_id, container_id)
        REFERENCES session_generation_container(run_id, treasure_id, id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS session_generation_item_definition (
      run_id TEXT NOT NULL REFERENCES session_generation_run(id)
        ON DELETE RESTRICT,
      definition_id TEXT NOT NULL,
      reference_json TEXT NOT NULL,
      definition_json TEXT NOT NULL,
      PRIMARY KEY (run_id, definition_id),
      UNIQUE (run_id, reference_json)
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
        'magic_item_count','packing_validity','item_definition_complete',
        'item_value_consistency','container_capacity',
        'coin_denomination_integrity','role_magic_consistency',
        'stock_class_policy'
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
