package src.data.sessionplanner.model;

import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

public final class SessionPlannerPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";

    public static final SqliteTableSpec SESSION_PLANS = table(
            "session_planner_sessions",
            column("session_id", "INTEGER PRIMARY KEY"),
            column("encounter_days", "TEXT NOT NULL"),
            column("selected_encounter_id", "INTEGER NOT NULL DEFAULT 0"),
            column("status_text", "TEXT NOT NULL DEFAULT ''"),
            column("next_encounter_id", "INTEGER NOT NULL DEFAULT 1"),
            column("next_loot_id", "INTEGER NOT NULL DEFAULT 1"),
            column("updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"));

    public static final SqliteTableSpec CURRENT_SESSION = table(
            "session_planner_current_session",
            column("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
            column("session_id", "INTEGER REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE SET NULL"));

    public static final SqliteTableSpec SESSION_PARTICIPANTS = table(
            "session_planner_participants",
            column("session_id", "INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE"),
            column("character_id", "INTEGER NOT NULL"),
            column("sort_order", "INTEGER NOT NULL"));

    public static final SqliteTableSpec SESSION_ENCOUNTERS = table(
            "session_planner_encounters",
            column("session_id", "INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE"),
            column("encounter_id", "INTEGER NOT NULL"),
            column("encounter_plan_id", "INTEGER NOT NULL"),
            column("budget_percentage", "TEXT NOT NULL"),
            column("sort_order", "INTEGER NOT NULL"));

    public static final SqliteTableSpec SESSION_RESTS = table(
            "session_planner_rests",
            column("session_id", "INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE"),
            column("left_encounter_id", "INTEGER NOT NULL"),
            column("right_encounter_id", "INTEGER NOT NULL"),
            column("rest_kind", "TEXT NOT NULL"),
            column("sort_order", "INTEGER NOT NULL"));

    public static final SqliteTableSpec SESSION_LOOT_PLACEHOLDERS = table(
            "session_planner_loot_placeholders",
            column("session_id", "INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE"),
            column("loot_id", "INTEGER NOT NULL"),
            column("label", "TEXT NOT NULL"),
            column("sort_order", "INTEGER NOT NULL"));

    public static final String CREATE_SESSION_PLANS_SQL = SESSION_PLANS.createTableSql();

    public static final String CREATE_CURRENT_SESSION_SQL = CURRENT_SESSION.createTableSql();

    public static final String CREATE_SESSION_PARTICIPANTS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_PARTICIPANTS.name() + " ("
                    + "session_id INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE, "
                    + "character_id INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, character_id)"
                    + ")";

    public static final String CREATE_SESSION_ENCOUNTERS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_ENCOUNTERS.name() + " ("
                    + "session_id INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE, "
                    + "encounter_id INTEGER NOT NULL, "
                    + "encounter_plan_id INTEGER NOT NULL, "
                    + "budget_percentage TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_RESTS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_RESTS.name() + " ("
                    + "session_id INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE, "
                    + "left_encounter_id INTEGER NOT NULL, "
                    + "right_encounter_id INTEGER NOT NULL, "
                    + "rest_kind TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, left_encounter_id, right_encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_LOOT_PLACEHOLDERS.name() + " ("
                    + "session_id INTEGER NOT NULL REFERENCES " + SESSION_PLANS.name() + "(session_id) ON DELETE CASCADE, "
                    + "loot_id INTEGER NOT NULL, "
                    + "label TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, loot_id)"
                    + ")";

    public static final String CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_participants_order ON "
                    + SESSION_PARTICIPANTS.name() + "(session_id, sort_order)";

    public static final String CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_encounters_order ON "
                    + SESSION_ENCOUNTERS.name() + "(session_id, sort_order)";

    public static final String CREATE_SESSION_RESTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_rests_order ON "
                    + SESSION_RESTS.name() + "(session_id, sort_order)";

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_loot_order ON "
                    + SESSION_LOOT_PLACEHOLDERS.name() + "(session_id, sort_order)";

    private SessionPlannerPersistenceSchema() {
    }
}
