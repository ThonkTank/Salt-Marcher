package features.sessionplanner.adapter.sqlite.model;

public final class SessionPlannerPersistenceSchema {

    public static final String DATABASE_FILE_NAME = String.valueOf("game.db");
    public static final String SESSION_PLANS_TABLE = "session_planner_sessions";
    public static final String CURRENT_SESSION_TABLE = "session_planner_current_session";
    public static final String SESSION_PARTICIPANTS_TABLE = "session_planner_participants";
    // Persisted compatibility identifiers retain encounter wording. Rename
    // them only through an explicit data-safe schema migration.
    public static final String SESSION_ENCOUNTERS_TABLE = "session_planner_encounters";
    public static final String SESSION_RESTS_TABLE = "session_planner_rests";
    public static final String SESSION_LOOT_PLACEHOLDERS_TABLE = "session_planner_loot_placeholders";
    public static final String SESSION_MANUAL_LOOT_NOTES_TABLE = "session_planner_manual_loot_notes";
    public static final String SESSION_GENERATED_REWARDS_TABLE = "session_planner_generated_rewards";
    public static final String SESSION_LOOT_ENCOUNTER_ID_COLUMN = "encounter_id";
    public static final String SESSION_ENCOUNTER_SCENE_TITLE_COLUMN = "scene_title";
    public static final String SESSION_ENCOUNTER_SCENE_NOTES_COLUMN = "scene_notes";
    public static final String SESSION_ENCOUNTER_LOCATION_ID_COLUMN = "location_id";
    private static final String CREATE_TABLE_IF_NOT_EXISTS = "CREATE TABLE IF NOT EXISTS ";
    private static final String REQUIRED_SESSION_REFERENCE =
            "session_id INTEGER NOT NULL REFERENCES "
                    + SESSION_PLANS_TABLE
                    + "(session_id) ON DELETE CASCADE, ";
    private static final String SORT_ORDER_COLUMN_DECLARATION = "sort_order INTEGER NOT NULL, ";
    private static final String SESSION_ORDER_INDEX_COLUMNS = "(session_id, sort_order)";

    public static final String CREATE_SESSION_PLANS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_PLANS_TABLE + " ("
                    + "session_id INTEGER PRIMARY KEY, "
                    + "revision INTEGER NOT NULL DEFAULT 1, "
                    + "display_name TEXT NOT NULL DEFAULT '', "
                    + "encounter_days TEXT NOT NULL, "
                    + "selected_encounter_id INTEGER NOT NULL DEFAULT 0, "
                    + "status_text TEXT NOT NULL DEFAULT '', "
                    + "next_encounter_id INTEGER NOT NULL DEFAULT 1, "
                    + "next_loot_id INTEGER NOT NULL DEFAULT 1, "
                    + "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
                    + ")";

    public static final String CREATE_CURRENT_SESSION_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + CURRENT_SESSION_TABLE + " ("
                    + "singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), "
                    + "session_id INTEGER REFERENCES " + SESSION_PLANS_TABLE + "(session_id) ON DELETE SET NULL"
                    + ")";

    public static final String CREATE_SESSION_PARTICIPANTS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_PARTICIPANTS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "character_id INTEGER NOT NULL, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, character_id)"
                    + ")";

    public static final String CREATE_SESSION_ENCOUNTERS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_ENCOUNTERS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "encounter_id INTEGER NOT NULL, "
                    + "encounter_plan_id INTEGER NOT NULL, "
                    + "budget_percentage TEXT NOT NULL, "
                    + SESSION_ENCOUNTER_SCENE_TITLE_COLUMN + " TEXT NOT NULL DEFAULT '', "
                    + SESSION_ENCOUNTER_SCENE_NOTES_COLUMN + " TEXT NOT NULL DEFAULT '', "
                    + SESSION_ENCOUNTER_LOCATION_ID_COLUMN + " INTEGER NOT NULL DEFAULT 0, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_RESTS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_RESTS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "left_encounter_id INTEGER NOT NULL, "
                    + "right_encounter_id INTEGER NOT NULL, "
                    + "rest_kind TEXT NOT NULL, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, left_encounter_id, right_encounter_id)"
                    + ")";

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_LOOT_PLACEHOLDERS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "loot_id INTEGER NOT NULL, "
                    + SESSION_LOOT_ENCOUNTER_ID_COLUMN + " INTEGER NOT NULL DEFAULT 0, "
                    + "label TEXT NOT NULL, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, loot_id)"
                    + ")";

    public static final String CREATE_SESSION_GENERATED_REWARDS_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_GENERATED_REWARDS_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "scene_id INTEGER NOT NULL, "
                    + "generation_id TEXT NOT NULL, "
                    + "treasure_id INTEGER NOT NULL, "
                    + "last_known_label TEXT NOT NULL, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, generation_id, treasure_id), "
                    + "FOREIGN KEY(session_id, scene_id) REFERENCES "
                    + SESSION_ENCOUNTERS_TABLE
                    + "(session_id, encounter_id) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_SESSION_MANUAL_LOOT_NOTES_SQL =
            CREATE_TABLE_IF_NOT_EXISTS + SESSION_MANUAL_LOOT_NOTES_TABLE + " ("
                    + REQUIRED_SESSION_REFERENCE
                    + "note_id INTEGER NOT NULL, "
                    + "scene_id INTEGER NOT NULL, "
                    + "note_text TEXT NOT NULL, "
                    + SORT_ORDER_COLUMN_DECLARATION
                    + "PRIMARY KEY(session_id, note_id), "
                    + "FOREIGN KEY(session_id, scene_id) REFERENCES "
                    + SESSION_ENCOUNTERS_TABLE
                    + "(session_id, encounter_id) ON DELETE CASCADE"
                    + ")";

    public static final String CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_participants_order ON "
                    + SESSION_PARTICIPANTS_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    public static final String CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_encounters_order ON "
                    + SESSION_ENCOUNTERS_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    public static final String CREATE_SESSION_RESTS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_rests_order ON "
                    + SESSION_RESTS_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_loot_order ON "
                    + SESSION_LOOT_PLACEHOLDERS_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    public static final String CREATE_SESSION_GENERATED_REWARDS_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_generated_rewards_order ON "
                    + SESSION_GENERATED_REWARDS_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    public static final String CREATE_SESSION_MANUAL_LOOT_NOTES_ORDER_INDEX_SQL =
            "CREATE INDEX IF NOT EXISTS idx_session_planner_manual_loot_notes_order ON "
                    + SESSION_MANUAL_LOOT_NOTES_TABLE + SESSION_ORDER_INDEX_COLUMNS;

    private SessionPlannerPersistenceSchema() {
    }
}
