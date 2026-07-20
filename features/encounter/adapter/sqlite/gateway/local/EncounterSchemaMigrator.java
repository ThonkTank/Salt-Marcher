package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import features.encounter.adapter.sqlite.model.EncounterPersistenceSchema;
import platform.persistence.SqliteSchemaColumnSupport;

final class EncounterSchemaMigrator {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLANS_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_CREATURES_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_UPDATED_INDEX_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_ENCOUNTER_PLAN_CREATURES_PLAN_INDEX_SQL);
        }
    }

    void ensureGeneratedPlanOrigins(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterPersistenceSchema.CREATE_GENERATED_ENCOUNTER_PLAN_BATCHES_SQL);
            statement.execute(EncounterPersistenceSchema.CREATE_GENERATED_ENCOUNTER_PLAN_ORIGINS_SQL);
        }
    }

    void ensureRuntimeContexts(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_meta ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK(singleton_id=1), "
                    + "source_revision INTEGER NOT NULL CHECK(source_revision>=0), "
                    + "focused_context_id TEXT NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_contexts ("
                    + "context_id TEXT PRIMARY KEY, mode INTEGER NOT NULL, status TEXT NOT NULL, "
                    + "location_id INTEGER NOT NULL, initial_plan_id INTEGER NOT NULL, "
                    + "active_saved_plan_id INTEGER NOT NULL, next_undo_token INTEGER NOT NULL, "
                    + "current_turn_index INTEGER NOT NULL, round_number INTEGER NOT NULL, "
                    + "target_difficulty TEXT NOT NULL, balance_level INTEGER NOT NULL, "
                    + "amount_value REAL NOT NULL, diversity_level INTEGER NOT NULL, "
                    + "builder_world_location_id INTEGER NOT NULL, "
                    + "result_defeated_count INTEGER NOT NULL, result_eligible_xp INTEGER NOT NULL, "
                    + "result_per_player_xp INTEGER NOT NULL, result_gold_summary TEXT NOT NULL, "
                    + "result_loot_detail TEXT NOT NULL, result_award_status TEXT NOT NULL, "
                    + "result_xp_awarded INTEGER NOT NULL, result_can_award_xp INTEGER NOT NULL, "
                    + "result_party_size INTEGER NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_party ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, party_member_id INTEGER NOT NULL, "
                    + "PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_npcs ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, world_npc_id INTEGER NOT NULL, statblock_id INTEGER NOT NULL, "
                    + "role TEXT NOT NULL, PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_builder_values ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "value_kind TEXT NOT NULL, sort_order INTEGER NOT NULL, text_value TEXT NOT NULL DEFAULT '', "
                    + "integer_key INTEGER NOT NULL DEFAULT 0, integer_value INTEGER NOT NULL DEFAULT 0, "
                    + "PRIMARY KEY(context_id, value_kind, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_builder_state ("
                    + "context_id TEXT PRIMARY KEY REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "selected_alternative_index INTEGER NOT NULL, generated_adjusted_xp INTEGER NOT NULL, "
                    + "generated_difficulty TEXT NOT NULL, generated_title TEXT NOT NULL, "
                    + "generation_history_present INTEGER NOT NULL, dirty INTEGER NOT NULL)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_generation_advisories ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, advisory TEXT NOT NULL, "
                    + "PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_generated_alternatives ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, title TEXT NOT NULL, difficulty_label TEXT NOT NULL, "
                    + "adjusted_xp INTEGER NOT NULL, PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_generated_alternative_advisories ("
                    + "context_id TEXT NOT NULL, alternative_order INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                    + "advisory TEXT NOT NULL, PRIMARY KEY(context_id, alternative_order, sort_order), "
                    + "FOREIGN KEY(context_id, alternative_order) "
                    + "REFERENCES encounter_runtime_generated_alternatives(context_id, sort_order) ON DELETE CASCADE)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_generated_alternative_roster ("
                    + "context_id TEXT NOT NULL, alternative_order INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                    + "row_id TEXT NOT NULL, creature_id INTEGER NOT NULL, world_npc_id INTEGER NOT NULL, "
                    + "name TEXT NOT NULL, challenge_rating TEXT NOT NULL, xp INTEGER NOT NULL, hp INTEGER NOT NULL, "
                    + "armor_class INTEGER NOT NULL, initiative_bonus INTEGER NOT NULL, creature_type TEXT NOT NULL, "
                    + "encounter_role TEXT NOT NULL, creature_count INTEGER NOT NULL, "
                    + "PRIMARY KEY(context_id, alternative_order, sort_order), "
                    + "FOREIGN KEY(context_id, alternative_order) "
                    + "REFERENCES encounter_runtime_generated_alternatives(context_id, sort_order) ON DELETE CASCADE)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_generated_alternative_roster_tags ("
                    + "context_id TEXT NOT NULL, alternative_order INTEGER NOT NULL, roster_order INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, tag TEXT NOT NULL, "
                    + "PRIMARY KEY(context_id, alternative_order, roster_order, sort_order), "
                    + "FOREIGN KEY(context_id, alternative_order, roster_order) "
                    + "REFERENCES encounter_runtime_generated_alternative_roster"
                    + "(context_id, alternative_order, sort_order) ON DELETE CASCADE)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_roster ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, row_id TEXT NOT NULL, creature_id INTEGER NOT NULL, "
                    + "world_npc_id INTEGER NOT NULL, name TEXT NOT NULL, challenge_rating TEXT NOT NULL, "
                    + "xp INTEGER NOT NULL, hp INTEGER NOT NULL, armor_class INTEGER NOT NULL, "
                    + "initiative_bonus INTEGER NOT NULL, creature_type TEXT NOT NULL, encounter_role TEXT NOT NULL, "
                    + "creature_count INTEGER NOT NULL, PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_roster_tags ("
                    + "context_id TEXT NOT NULL, roster_order INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                    + "tag TEXT NOT NULL, PRIMARY KEY(context_id, roster_order, sort_order), "
                    + "FOREIGN KEY(context_id, roster_order) REFERENCES encounter_runtime_roster(context_id, sort_order) "
                    + "ON DELETE CASCADE)");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_initiative ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, row_id TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL, "
                    + "initiative INTEGER NOT NULL, PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_combatants ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, combatant_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, "
                    + "creature_id INTEGER NOT NULL, world_npc_id INTEGER NOT NULL, current_hp INTEGER NOT NULL, "
                    + "max_hp INTEGER NOT NULL, armor_class INTEGER NOT NULL, initiative INTEGER NOT NULL, "
                    + "combatant_count INTEGER NOT NULL, xp INTEGER NOT NULL, detail TEXT NOT NULL, loot TEXT NOT NULL, "
                    + "turn_order INTEGER NOT NULL, PRIMARY KEY(context_id, sort_order))");
            statement.execute("CREATE TABLE IF NOT EXISTS encounter_runtime_result_enemies ("
                    + "context_id TEXT NOT NULL REFERENCES encounter_runtime_contexts(context_id) ON DELETE CASCADE, "
                    + "sort_order INTEGER NOT NULL, name TEXT NOT NULL, creature_id INTEGER NOT NULL, "
                    + "world_npc_id INTEGER NOT NULL, status TEXT NOT NULL, hp_loss INTEGER NOT NULL, xp INTEGER NOT NULL, "
                    + "defeated_by_default INTEGER NOT NULL, loot TEXT NOT NULL, PRIMARY KEY(context_id, sort_order))");
        }
    }

    void ensureGeneratedBatchV4(Connection connection) throws SQLException {
        addColumnIfMissing(connection, EncounterPersistenceSchema.ENCOUNTER_PLAN_CREATURES.name(),
                "last_known_display_name", "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(connection, EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME,
                "preparation_id", "TEXT");
        addColumnIfMissing(connection, EncounterPersistenceSchema.GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME,
                "roster_fingerprint", "TEXT NOT NULL DEFAULT ''");
        try (Statement statement = connection.createStatement()) {
            statement.execute(EncounterPersistenceSchema.CREATE_GENERATED_PREPARATION_IDENTITY_INDEX_SQL);
        }
    }

    void repairTargetSchema(Connection connection) throws SQLException {
        ensureSchema(connection);
        ensureGeneratedPlanOrigins(connection);
        ensureRuntimeContexts(connection);
        ensureGeneratedBatchV4(connection);
    }

    private static void addColumnIfMissing(
            Connection connection, String table, String column, String declaration
    ) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(connection, table, column)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + declaration);
            }
        }
    }
}
