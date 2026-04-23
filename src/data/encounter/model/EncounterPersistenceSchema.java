package src.data.encounter.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

public final class EncounterPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";
    public static final String REFERENCED_CREATURES_TABLE_NAME = "creatures";

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
            column("creature_id", "INTEGER NOT NULL REFERENCES " + REFERENCED_CREATURES_TABLE_NAME
                    + "(id) ON DELETE RESTRICT"),
            column("quantity", "INTEGER NOT NULL CHECK(quantity > 0)"),
            column("sort_order", "INTEGER NOT NULL"));

    public static final String CREATE_ENCOUNTER_PLANS_SQL = ENCOUNTER_PLANS.createTableSql();

    public static final String CREATE_ENCOUNTER_PLAN_CREATURES_SQL =
            "CREATE TABLE IF NOT EXISTS " + ENCOUNTER_PLAN_CREATURES.name() + " ("
                    + "plan_id INTEGER NOT NULL REFERENCES " + ENCOUNTER_PLANS.name()
                    + "(plan_id) ON DELETE CASCADE, "
                    + "creature_id INTEGER NOT NULL REFERENCES " + REFERENCED_CREATURES_TABLE_NAME
                    + "(id) ON DELETE RESTRICT, "
                    + "quantity INTEGER NOT NULL CHECK(quantity > 0), "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(plan_id, creature_id)"
                    + ")";

    public static final String CREATE_ENCOUNTER_PLAN_UPDATED_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_saved_encounter_plans_updated ON "
                    + ENCOUNTER_PLANS.name() + "(updated_at DESC, plan_id DESC)";

    public static final String CREATE_ENCOUNTER_PLAN_CREATURES_PLAN_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_saved_encounter_plan_creatures_plan ON "
                    + ENCOUNTER_PLAN_CREATURES.name() + "(plan_id, sort_order)";

    private EncounterPersistenceSchema() {
    }
}
