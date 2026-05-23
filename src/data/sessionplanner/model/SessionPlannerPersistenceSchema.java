package src.data.sessionplanner.model;

public final class SessionPlannerPersistenceSchema {

    public static final String DATABASE_FILE_NAME = String.valueOf("game.db");
    public static final String SESSION_PLANS_TABLE = "session_planner_sessions";
    public static final String CURRENT_SESSION_TABLE = "session_planner_current_session";
    public static final String SESSION_PARTICIPANTS_TABLE = "session_planner_participants";
    public static final String SESSION_ENCOUNTERS_TABLE = "session_planner_encounters";
    public static final String SESSION_RESTS_TABLE = "session_planner_rests";
    public static final String SESSION_LOOT_PLACEHOLDERS_TABLE = "session_planner_loot_placeholders";
    private static final String REQUIRED_SESSION_REFERENCE =
            "session_id INTEGER NOT NULL REFERENCES "
                    + SESSION_PLANS_TABLE
                    + "(session_id) ON DELETE CASCADE, ";

    public static final String CREATE_SESSION_PLANS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_PLANS_TABLE + " ("
                    + "session_id INTEGER PRIMARY KEY, "
                    + "encounter_days TEXT NOT NULL, "
                    + "selected_encounter_id INTEGER NOT NULL DEFAULT 0, "
                    + "status_text TEXT NOT NULL DEFAULT '', "
                    + "next_encounter_id INTEGER NOT NULL DEFAULT 1, "
                    + "next_loot_id INTEGER NOT NULL DEFAULT 1, "
                    + "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")";

    public static final String CREATE_CURRENT_SESSION_SQL =
            "CREATE TABLE IF NOT EXISTS " + CURRENT_SESSION_TABLE + " ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), "
                    + "session_id INTEGER REFERENCES " + SESSION_PLANS_TABLE + "(session_id) ON DELETE SET NULL"
                    + ")";

    public static final String CREATE_SESSION_PARTICIPANTS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_PARTICIPANTS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "character_id INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, character_id)"
                    + ")";

    public static final String CREATE_SESSION_ENCOUNTERS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_ENCOUNTERS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "encounter_id INTEGER NOT NULL, "
                    + "encounter_plan_id INTEGER NOT NULL, "
                    + "budget_percentage TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_RESTS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_RESTS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "left_encounter_id INTEGER NOT NULL, "
                    + "right_encounter_id INTEGER NOT NULL, "
                    + "rest_kind TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, left_encounter_id, right_encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_SQL =
            "CREATE TABLE IF NOT EXISTS " + SESSION_LOOT_PLACEHOLDERS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "loot_id INTEGER NOT NULL, "
                    + "label TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, loot_id)"
                    + ")";

    public static final String CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_participants_order "
                    + "ON " + SESSION_PARTICIPANTS_TABLE + "(session_id, sort_order)";

    public static final String CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_encounters_order "
                    + "ON " + SESSION_ENCOUNTERS_TABLE + "(session_id, sort_order)";

    public static final String CREATE_SESSION_RESTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_rests_order "
                    + "ON " + SESSION_RESTS_TABLE + "(session_id, sort_order)";

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_loot_order "
                    + "ON " + SESSION_LOOT_PLACEHOLDERS_TABLE + "(session_id, sort_order)";

    private SessionPlannerPersistenceSchema() {
    }
}
