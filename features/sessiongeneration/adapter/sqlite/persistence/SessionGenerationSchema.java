package features.sessiongeneration.adapter.sqlite.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class SessionGenerationSchema {

    static final String RUNS = "session_generation_runs";
    static final String PARTY = "session_generation_party_levels";
    static final String TARGETS = "session_generation_encounter_targets";
    static final String ENCOUNTERS = "session_generation_encounters";
    static final String ENCOUNTER_BLOCKS = "session_generation_encounter_blocks";
    static final String TREASURES = "session_generation_treasures";
    static final String LOOT = "session_generation_loot_items";
    static final String PACKING = "session_generation_packing";
    static final String AUDITS = "session_generation_audits";

    private static final String RUN_REFERENCE = "run_id TEXT NOT NULL REFERENCES " + RUNS + "(run_id), ";

    void migrate(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + RUNS + " ("
                    + "run_id TEXT PRIMARY KEY, "
                    + "owner TEXT NOT NULL CHECK(owner = 'session-generation'), "
                    + "schema_version INTEGER NOT NULL CHECK(schema_version = 1), "
                    + "engine_version TEXT NOT NULL, catalog_version TEXT NOT NULL, catalog_hash TEXT NOT NULL, "
                    + "seed INTEGER NOT NULL, adventure_fraction TEXT NOT NULL, encounter_count INTEGER NOT NULL, "
                    + "party_count INTEGER NOT NULL, day_xp_budget INTEGER NOT NULL, session_xp_target INTEGER NOT NULL, "
                    + "average_level TEXT NOT NULL, normal_budget_cp INTEGER NOT NULL, overstock_budget_cp INTEGER NOT NULL, "
                    + "nonmagic_slots INTEGER NOT NULL, normal_magic INTEGER NOT NULL, overstock_magic INTEGER NOT NULL, "
                    + "treasure_count INTEGER NOT NULL, normal_actual_cp INTEGER NOT NULL, overstock_actual_cp INTEGER NOT NULL, "
                    + "magic_count INTEGER NOT NULL, formatted_text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")");
            statement.execute("CREATE TABLE IF NOT EXISTS " + PARTY + " (" + RUN_REFERENCE
                    + "level INTEGER NOT NULL, players INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(run_id, level), UNIQUE(run_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + TARGETS + " (" + RUN_REFERENCE
                    + "encounter_no INTEGER NOT NULL, target_xp INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(run_id, encounter_no), UNIQUE(run_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + ENCOUNTERS + " (" + RUN_REFERENCE
                    + "encounter_no INTEGER NOT NULL, target_xp INTEGER NOT NULL, adjusted_xp INTEGER NOT NULL, "
                    + "difficulty TEXT NOT NULL, candidate_id TEXT NOT NULL, monster_summary TEXT NOT NULL, "
                    + "monster_count INTEGER NOT NULL, multiplier TEXT NOT NULL, max_challenge_code INTEGER NOT NULL, "
                    + "boss_score TEXT NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(run_id, encounter_no), "
                    + "UNIQUE(run_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + ENCOUNTER_BLOCKS + " (" + RUN_REFERENCE
                    + "encounter_no INTEGER NOT NULL, block_order INTEGER NOT NULL, block_id TEXT NOT NULL, role TEXT NOT NULL, "
                    + "challenge_code INTEGER NOT NULL, challenge_label TEXT NOT NULL, unit_xp INTEGER NOT NULL, "
                    + "quantity INTEGER NOT NULL, PRIMARY KEY(run_id, encounter_no, block_order), "
                    + "FOREIGN KEY(run_id, encounter_no) REFERENCES " + ENCOUNTERS + "(run_id, encounter_no))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + TREASURES + " (" + RUN_REFERENCE
                    + "treasure_id INTEGER NOT NULL, stock_class TEXT NOT NULL, reward_channel TEXT NOT NULL, "
                    + "anchor_encounter_no INTEGER NOT NULL, theme TEXT NOT NULL, magic_type TEXT NOT NULL, "
                    + "target_cp INTEGER NOT NULL, nonmagic_slots INTEGER NOT NULL, magic_slots INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(run_id, treasure_id), UNIQUE(run_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + LOOT + " (" + RUN_REFERENCE
                    + "line_id INTEGER NOT NULL, treasure_id INTEGER NOT NULL, role TEXT NOT NULL, item_id TEXT NOT NULL, "
                    + "display_text TEXT NOT NULL, quantity INTEGER NOT NULL, unit_cp INTEGER NOT NULL, actual_cp INTEGER NOT NULL, "
                    + "total_capacity TEXT NOT NULL, allowed_containers TEXT NOT NULL, magic_rarity TEXT NOT NULL, "
                    + "cursed INTEGER NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(run_id, line_id), "
                    + "UNIQUE(run_id, sort_order), FOREIGN KEY(run_id, treasure_id) REFERENCES "
                    + TREASURES + "(run_id, treasure_id))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + PACKING + " (" + RUN_REFERENCE
                    + "line_id INTEGER NOT NULL, treasure_id INTEGER NOT NULL, container_type TEXT NOT NULL, "
                    + "container_count INTEGER NOT NULL, container_id TEXT NOT NULL, valid INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(run_id, line_id), UNIQUE(run_id, sort_order), "
                    + "FOREIGN KEY(run_id, line_id) REFERENCES " + LOOT + "(run_id, line_id), "
                    + "FOREIGN KEY(run_id, treasure_id) REFERENCES " + TREASURES + "(run_id, treasure_id))");
            statement.execute("CREATE TABLE IF NOT EXISTS " + AUDITS + " (" + RUN_REFERENCE
                    + "audit_order INTEGER NOT NULL, code TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, "
                    + "PRIMARY KEY(run_id, audit_order))");
        }
    }
}
