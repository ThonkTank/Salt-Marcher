package features.sessionplanner.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.domain.session.SessionPlan;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class SessionPlannerCurrentSchemaTest {

    private static final String DEVELOPMENT_LOOT_TABLE = "session_planner_loot_placeholders";
    private static final String DEVELOPMENT_LOOT_INDEX = "idx_session_planner_loot_order";

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesCurrentTargetDirectlyAtVersionOne() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-fresh.db");

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            repository(database).readWorkspace();
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", "session_planner_manual_loot_notes"));
            assertTrue(schemaObjectExists(connection, "table", "session_planner_generated_rewards"));
            assertTrue(schemaObjectExists(
                    connection, "index", "idx_session_planner_manual_loot_notes_order"));
            assertFalse(schemaObjectExists(connection, "table", DEVELOPMENT_LOOT_TABLE));
            assertFalse(schemaObjectExists(connection, "index", DEVELOPMENT_LOOT_INDEX));
        }
    }

    @Test
    void currentManualNotesRemainReadableAfterRestart() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-restart.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            repository(database).readWorkspace();
        }
        insertCurrentSessionWithManualNote(path);

        SessionPlan loaded;
        try (SqliteDatabase reopened = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            loaded = repository(reopened).loadById(9L).orElseThrow();
        }

        assertEquals(7L, loaded.revision().value());
        assertEquals(43L, loaded.nextLootId());
        assertEquals(1, loaded.manualLootNotes().size());
        assertEquals(41L, loaded.manualLootNotes().getFirst().noteId());
        assertEquals(12L, loaded.manualLootNotes().getFirst().sceneId());
        assertEquals("Current note", loaded.manualLootNotes().getFirst().authoredText());
    }

    @Test
    void incompleteUnversionedDevelopmentShapeFailsAndRollsBackInitializer() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-incomplete.db");
        createIncompleteDevelopmentShape(path, false);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> repository(database).readWorkspace());
        }

        try (Connection connection = rawConnection(path)) {
            assertTrue(schemaObjectExists(connection, "table", "session_planner_sessions"));
            assertFalse(schemaObjectExists(connection, "table", "session_planner_current_session"),
                    "initializer-created tables must roll back when target validation fails");
            assertFalse(featureVersionExists(connection));
        }
    }

    @Test
    void recordedIncompleteVersionOneFailsClosedWithoutRepair() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-incomplete-v1.db");
        createIncompleteDevelopmentShape(path, true);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> repository(database).readWorkspace());
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(9, columnCount(connection, "session_planner_sessions"));
            assertFalse(schemaObjectExists(connection, "table", "session_planner_current_session"));
        }
    }

    @Test
    void recordedCurrentColumnsWithoutParticipantRelationshipFailClosedWithoutMutation() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-missing-fk.db");
        createCurrentShape(path, sql -> sql.replace(
                "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                        + "character_id INTEGER NOT NULL",
                "session_id INTEGER NOT NULL, character_id INTEGER NOT NULL"));
        String before;
        try (Connection connection = rawConnection(path)) {
            before = tableSql(connection, SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE);
        }

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> repository(database).readWorkspace());
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(before, tableSql(
                    connection, SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE));
            assertEquals(1, featureVersion(connection));
        }
    }

    @Test
    void recordedCurrentShapeWithAdjacentDevelopmentObjectFailsClosed() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-current-plus-development.db");
        createCurrentShape(path, java.util.function.UnaryOperator.identity());
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE session_planner_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO session_planner_retired VALUES('kept')");
        }

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> repository(database).readWorkspace());
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM session_planner_retired"));
            assertEquals(1, featureVersion(connection));
        }
    }

    @Test
    void supersededDevelopmentVersionFailsClosedWithoutCopyOrDrop() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-development-v2.db");
        createSupersededDevelopmentShape(path);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> repository(database).readWorkspace());
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(2, featureVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", DEVELOPMENT_LOOT_TABLE));
            assertTrue(schemaObjectExists(connection, "index", DEVELOPMENT_LOOT_INDEX));
            assertEquals("Development-only row", scalarText(connection,
                    "SELECT label FROM " + DEVELOPMENT_LOOT_TABLE + " WHERE loot_id = 41"));
            assertFalse(schemaObjectExists(connection, "table", "session_planner_manual_loot_notes"));
        }
    }

    private static SqliteSessionPlanRepository repository(SqliteDatabase database) {
        return new SqliteSessionPlanRepository(
                TestFeatureStores.store(database, SqliteSessionPlanRepository.storeDefinition()));
    }

    private static void insertCurrentSessionWithManualNote(Path path) throws Exception {
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("INSERT INTO session_planner_sessions "
                    + "(session_id, revision, display_name, encounter_days, selected_encounter_id, "
                    + "status_text, next_encounter_id, next_loot_id) VALUES "
                    + "(9, 7, 'Current', '0.6', 12, '', 13, 43)");
            statement.execute("INSERT INTO session_planner_encounters "
                    + "(session_id, encounter_id, encounter_plan_id, budget_percentage, scene_title, "
                    + "scene_notes, location_id, sort_order) VALUES "
                    + "(9, 12, 0, '50', 'Current scene', '', 0, 0)");
            statement.execute("INSERT INTO session_planner_manual_loot_notes "
                    + "(session_id, note_id, scene_id, note_text, sort_order) VALUES "
                    + "(9, 41, 12, 'Current note', 0)");
        }
    }

    private static void createIncompleteDevelopmentShape(Path path, boolean recordVersion) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute(SessionPlannerPersistenceSchema.CREATE_SESSION_PLANS_SQL);
            if (recordVersion) {
                statement.execute("INSERT INTO sm_schema_versions(owner, version) "
                        + "VALUES ('session-planner', 1)");
            }
        }
    }

    private static void createSupersededDevelopmentShape(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions(owner, version) "
                    + "VALUES ('session-planner', 2)");
            statement.execute("CREATE TABLE " + DEVELOPMENT_LOOT_TABLE + " ("
                    + "session_id INTEGER NOT NULL, loot_id INTEGER NOT NULL, label TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, loot_id))");
            statement.execute("CREATE INDEX " + DEVELOPMENT_LOOT_INDEX + " ON "
                    + DEVELOPMENT_LOOT_TABLE + "(session_id, sort_order)");
            statement.execute("INSERT INTO " + DEVELOPMENT_LOOT_TABLE
                    + " VALUES (9, 41, 'Development-only row', 0)");
        }
    }

    private static void createCurrentShape(
            Path path,
            java.util.function.UnaryOperator<String> tableSqlTransform
    ) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions(owner, version) "
                    + "VALUES ('session-planner', 1)");
            for (String sql : SessionPlannerPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(tableSqlTransform.apply(sql));
            }
            for (String sql : SessionPlannerPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static String tableSql(Connection connection, String table) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : "";
            }
        }
    }

    private static Connection rawConnection(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }

    private static int featureVersion(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner = 'session-planner'")) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static boolean featureVersionExists(Connection connection) throws Exception {
        if (!schemaObjectExists(connection, "table", "sm_schema_versions")) {
            return false;
        }
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT 1 FROM sm_schema_versions WHERE owner = 'session-planner'")) {
            return result.next();
        }
    }

    private static boolean schemaObjectExists(Connection connection, String type, String name) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static int columnCount(Connection connection, String table) throws Exception {
        int count = 0;
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                count++;
            }
        }
        return count;
    }

    private static String scalarText(Connection connection, String query) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }
}
