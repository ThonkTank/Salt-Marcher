package features.encounter.adapter.sqlite.model;

import platform.persistence.SqliteTableSpec;

import static platform.persistence.SqliteTableSpec.column;
import static platform.persistence.SqliteTableSpec.table;

public final class EncounterPersistenceSchema {

    public static final SqliteTableSpec ENCOUNTER_PLANS = table(
            "saved_encounter_plans",
            column("plan_id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
            column("name", "TEXT NOT NULL"),
            column("generated_label", "TEXT NOT NULL DEFAULT ''"),
            column("created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"),
            column("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"));

    public static final SqliteTableSpec ENCOUNTER_PLAN_CREATURES = table(
            "saved_encounter_plan_creatures",
            column("plan_id", "INTEGER NOT NULL REFERENCES saved_encounter_plans(plan_id) ON DELETE CASCADE"),
            column("creature_id", "INTEGER NOT NULL CHECK(creature_id > 0)"),
            column("quantity", "INTEGER NOT NULL CHECK(quantity > 0)"),
            column("last_known_display_name", "TEXT NOT NULL DEFAULT ''"),
            column("sort_order", "INTEGER NOT NULL CHECK(sort_order >= 0)"));

    public static final String GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME =
            "generated_encounter_plan_batches";

    public static final String GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME =
            "generated_encounter_plan_origins";

    public static final String CREATE_ENCOUNTER_PLANS_SQL =
            "CREATE TABLE " + ENCOUNTER_PLANS.name() + " ("
                    + "plan_id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    + "name TEXT NOT NULL, "
                    + "generated_label TEXT NOT NULL DEFAULT '', "
                    + "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                    + "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")";

    public static final String CREATE_ENCOUNTER_PLAN_CREATURES_SQL =
            "CREATE TABLE " + ENCOUNTER_PLAN_CREATURES.name() + " ("
                    + "plan_id INTEGER NOT NULL REFERENCES " + ENCOUNTER_PLANS.name()
                    + "(plan_id) ON DELETE CASCADE, "
                    + "creature_id INTEGER NOT NULL CHECK(creature_id > 0), "
                    + "quantity INTEGER NOT NULL CHECK(quantity > 0), "
                    + "last_known_display_name TEXT NOT NULL DEFAULT '', "
                    + "sort_order INTEGER NOT NULL CHECK(sort_order >= 0), "
                    + "PRIMARY KEY(plan_id, creature_id)"
                    + ")";

    public static final String CREATE_ENCOUNTER_PLAN_UPDATED_INDEX_SQL =
            "CREATE INDEX idx_saved_encounter_plans_updated ON "
                    + ENCOUNTER_PLANS.name() + "(updated_at DESC, plan_id DESC)";

    public static final String CREATE_ENCOUNTER_PLAN_CREATURES_PLAN_INDEX_SQL =
            "CREATE INDEX idx_saved_encounter_plan_creatures_plan ON "
                    + ENCOUNTER_PLAN_CREATURES.name() + "(plan_id, sort_order)";

    public static final String CREATE_GENERATED_ENCOUNTER_PLAN_BATCHES_SQL =
            "CREATE TABLE " + GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME + " ("
                    + "engine_version TEXT NOT NULL, "
                    + "generation_id TEXT NOT NULL, "
                    + "preparation_id TEXT NOT NULL, "
                    + "batch_fingerprint TEXT NOT NULL, "
                    + "encounter_count INTEGER NOT NULL CHECK(encounter_count > 0), "
                    + "PRIMARY KEY(engine_version, generation_id)"
                    + ")";

    public static final String CREATE_GENERATED_ENCOUNTER_PLAN_ORIGINS_SQL =
            "CREATE TABLE " + GENERATED_ENCOUNTER_PLAN_ORIGINS_TABLE_NAME + " ("
                    + "engine_version TEXT NOT NULL, "
                    + "generation_id TEXT NOT NULL, "
                    + "encounter_number INTEGER NOT NULL CHECK(encounter_number > 0), "
                    + "batch_order INTEGER NOT NULL CHECK(batch_order >= 0), "
                    + "spec_fingerprint TEXT NOT NULL, "
                    + "roster_fingerprint TEXT NOT NULL, "
                    + "plan_id INTEGER NOT NULL UNIQUE REFERENCES " + ENCOUNTER_PLANS.name()
                    + "(plan_id) ON DELETE CASCADE, "
                    + "PRIMARY KEY(engine_version, generation_id, encounter_number), "
                    + "UNIQUE(engine_version, generation_id, batch_order), "
                    + "FOREIGN KEY(engine_version, generation_id) REFERENCES "
                    + GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
                    + "(engine_version, generation_id) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_GENERATED_PREPARATION_IDENTITY_INDEX_SQL =
            "CREATE UNIQUE INDEX idx_generated_encounter_preparation_identity ON "
                    + GENERATED_ENCOUNTER_PLAN_BATCHES_TABLE_NAME
                    + "(engine_version, preparation_id)";

    private EncounterPersistenceSchema() {
    }
}
