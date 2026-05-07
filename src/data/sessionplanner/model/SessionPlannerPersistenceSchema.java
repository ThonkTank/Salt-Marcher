package src.data.sessionplanner.model;

import java.util.stream.Collectors;
import src.data.persistencecore.model.SqliteTableSpec;

import static src.data.persistencecore.model.SqliteTableSpec.column;
import static src.data.persistencecore.model.SqliteTableSpec.table;

public final class SessionPlannerPersistenceSchema {

    public static final String DATABASE_FILE_NAME = "game.db";
    private static final String SESSION_ID = "session_id";
    private static final String CHARACTER_ID = "character_id";
    private static final String ENCOUNTER_ID = "encounter_id";
    private static final String LEFT_ENCOUNTER_ID = "left_encounter_id";
    private static final String RIGHT_ENCOUNTER_ID = "right_encounter_id";
    private static final String LOOT_ID = "loot_id";
    private static final String SORT_ORDER = "sort_order";
    private static final String TEXT_REQUIRED = "TEXT NOT NULL";
    private static final String INTEGER_REQUIRED = "INTEGER NOT NULL";
    private static final String INTEGER_ONE_DEFAULT = "INTEGER NOT NULL DEFAULT 1";
    private static final String CREATE_TABLE_PREFIX = "CREATE TABLE IF NOT EXISTS ";
    private static final String CREATE_INDEX_PREFIX = "CREATE INDEX IF NOT EXISTS ";
    private static final String COLUMN_SEPARATOR = ", ";

    public static final SqliteTableSpec SESSION_PLANS = table(
            "session_planner_sessions",
            column(SESSION_ID, "INTEGER PRIMARY KEY"),
            column("encounter_days", TEXT_REQUIRED),
            column("selected_encounter_id", "INTEGER NOT NULL DEFAULT 0"),
            column("status_text", TEXT_REQUIRED + " DEFAULT ''"),
            column("next_encounter_id", INTEGER_ONE_DEFAULT),
            column("next_loot_id", INTEGER_ONE_DEFAULT),
            column("updated_at", TEXT_REQUIRED + " DEFAULT CURRENT_TIMESTAMP"));

    public static final SqliteTableSpec CURRENT_SESSION = table(
            "session_planner_current_session",
            column("singleton_id", "INTEGER PRIMARY KEY CHECK (singleton_id = 1)"),
            column(SESSION_ID, nullableSessionPlanReference()));

    public static final SqliteTableSpec SESSION_PARTICIPANTS = table(
            "session_planner_participants",
            column(SESSION_ID, requiredSessionPlanReference()),
            column(CHARACTER_ID, INTEGER_REQUIRED),
            column(SORT_ORDER, INTEGER_REQUIRED));

    public static final SqliteTableSpec SESSION_ENCOUNTERS = table(
            "session_planner_encounters",
            column(SESSION_ID, requiredSessionPlanReference()),
            column(ENCOUNTER_ID, INTEGER_REQUIRED),
            column("encounter_plan_id", "INTEGER NOT NULL"),
            column("budget_percentage", TEXT_REQUIRED),
            column(SORT_ORDER, INTEGER_REQUIRED));

    public static final SqliteTableSpec SESSION_RESTS = table(
            "session_planner_rests",
            column(SESSION_ID, requiredSessionPlanReference()),
            column(LEFT_ENCOUNTER_ID, INTEGER_REQUIRED),
            column(RIGHT_ENCOUNTER_ID, INTEGER_REQUIRED),
            column("rest_kind", TEXT_REQUIRED),
            column(SORT_ORDER, INTEGER_REQUIRED));

    public static final SqliteTableSpec SESSION_LOOT_PLACEHOLDERS = table(
            "session_planner_loot_placeholders",
            column(SESSION_ID, requiredSessionPlanReference()),
            column(LOOT_ID, INTEGER_REQUIRED),
            column("label", TEXT_REQUIRED),
            column(SORT_ORDER, INTEGER_REQUIRED));

    public static final String CREATE_SESSION_PLANS_SQL = SESSION_PLANS.createTableSql();

    public static final String CREATE_CURRENT_SESSION_SQL = CURRENT_SESSION.createTableSql();

    public static final String CREATE_SESSION_PARTICIPANTS_SQL =
            createCompositePrimaryKeyTableSql(SESSION_PARTICIPANTS, SESSION_ID, CHARACTER_ID);

    public static final String CREATE_SESSION_ENCOUNTERS_SQL =
            createCompositePrimaryKeyTableSql(SESSION_ENCOUNTERS, SESSION_ID, ENCOUNTER_ID);

    public static final String CREATE_SESSION_RESTS_SQL =
            createCompositePrimaryKeyTableSql(SESSION_RESTS, SESSION_ID, LEFT_ENCOUNTER_ID, RIGHT_ENCOUNTER_ID);

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_SQL =
            createCompositePrimaryKeyTableSql(SESSION_LOOT_PLACEHOLDERS, SESSION_ID, LOOT_ID);

    public static final String CREATE_SESSION_PARTICIPANTS_ORDER_INDEX_SQL =
            createIndexSql("idx_session_planner_participants_order", SESSION_PARTICIPANTS, SESSION_ID, SORT_ORDER);

    public static final String CREATE_SESSION_ENCOUNTERS_ORDER_INDEX_SQL =
            createIndexSql("idx_session_planner_encounters_order", SESSION_ENCOUNTERS, SESSION_ID, SORT_ORDER);

    public static final String CREATE_SESSION_RESTS_ORDER_INDEX_SQL =
            createIndexSql("idx_session_planner_rests_order", SESSION_RESTS, SESSION_ID, SORT_ORDER);

    public static final String CREATE_SESSION_LOOT_PLACEHOLDERS_ORDER_INDEX_SQL =
            createIndexSql("idx_session_planner_loot_order", SESSION_LOOT_PLACEHOLDERS, SESSION_ID, SORT_ORDER);

    private static String nullableSessionPlanReference() {
        return "INTEGER REFERENCES " + SESSION_PLANS.name() + "(" + SESSION_ID + ") ON DELETE SET NULL";
    }

    private static String requiredSessionPlanReference() {
        return INTEGER_REQUIRED + " REFERENCES " + SESSION_PLANS.name() + "(" + SESSION_ID + ") ON DELETE CASCADE";
    }

    private static String createCompositePrimaryKeyTableSql(SqliteTableSpec tableSpec, String... primaryKeyColumns) {
        return CREATE_TABLE_PREFIX + tableSpec.name() + " (" + renderColumns(tableSpec) + COLUMN_SEPARATOR
                + primaryKey(primaryKeyColumns) + ")";
    }

    private static String createIndexSql(String indexName, SqliteTableSpec tableSpec, String... columnNames) {
        return CREATE_INDEX_PREFIX + indexName + " ON " + tableSpec.name() + "(" + joinNames(columnNames) + ")";
    }

    private static String primaryKey(String... columnNames) {
        return "PRIMARY KEY(" + joinNames(columnNames) + ")";
    }

    private static String renderColumns(SqliteTableSpec tableSpec) {
        return tableSpec.columns().stream()
                .map(SessionPlannerPersistenceSchema::renderColumn)
                .collect(Collectors.joining(COLUMN_SEPARATOR));
    }

    private static String renderColumn(SqliteTableSpec.ColumnSpec columnSpec) {
        return columnSpec.name() + " " + columnSpec.definition();
    }

    private static String joinNames(String... names) {
        return String.join(COLUMN_SEPARATOR, names);
    }

    private SessionPlannerPersistenceSchema() {
    }
}
