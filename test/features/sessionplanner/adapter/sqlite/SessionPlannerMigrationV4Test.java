package features.sessionplanner.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

final class SessionPlannerMigrationV4Test {

    private static final String LEGACY_TABLE = "session_planner_loot_placeholders";
    private static final String LEGACY_INDEX = "idx_session_planner_loot_order";

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesOnlyCanonicalVersionFourSchema() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-fresh.db");

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            new SqliteSessionPlanRepository(database).readWorkspace();
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(4, featureVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", "session_planner_manual_loot_notes"));
            assertFalse(schemaObjectExists(connection, "table", LEGACY_TABLE));
            assertFalse(schemaObjectExists(connection, "index", LEGACY_INDEX));
        }
    }

    @Test
    void versionTwoCopiesEveryLegacyRowThenRetiresLegacySchema() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-v2.db");
        createVersionTwoFixture(path);

        SessionPlan loaded;
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            loaded = new SqliteSessionPlanRepository(database).loadById(9L).orElseThrow();
        }

        assertEquals(1L, loaded.revision().value());
        assertEquals(43L, loaded.nextLootId());
        assertEquals(2, loaded.manualLootNotes().size());
        assertEquals(41L, loaded.manualLootNotes().get(0).noteId());
        assertEquals(12L, loaded.manualLootNotes().get(0).sceneId());
        assertEquals("Zero anchor note", loaded.manualLootNotes().get(0).authoredText());
        assertEquals(42L, loaded.manualLootNotes().get(1).noteId());
        assertEquals(13L, loaded.manualLootNotes().get(1).sceneId());
        assertEquals("Explicit anchor note", loaded.manualLootNotes().get(1).authoredText());
        assertEquals(1, loaded.generatedRewards().size());
        assertEquals(12L, loaded.generatedRewards().getFirst().sceneId());
        assertEquals("legacy-run", loaded.generatedRewards().getFirst().generationId());
        assertEquals(7L, loaded.generatedRewards().getFirst().treasureId());
        assertEquals("Legacy cache", loaded.generatedRewards().getFirst().lastKnownLabel());

        try (Connection connection = rawConnection(path)) {
            assertEquals(4, featureVersion(connection));
            assertFalse(schemaObjectExists(connection, "table", LEGACY_TABLE));
            assertFalse(schemaObjectExists(connection, "index", LEGACY_INDEX));
            assertEquals(2, rowCount(connection, "session_planner_manual_loot_notes"));
        }
    }

    @Test
    void versionThreeKeepsEditedCanonicalTruthAndOnlyDropsStaleLegacy() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-v3.db");
        createVersionThreeFixture(path, false);

        SessionPlan loaded;
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            loaded = new SqliteSessionPlanRepository(database).loadById(9L).orElseThrow();
        }

        assertEquals(9L, loaded.revision().value());
        assertEquals(43L, loaded.nextLootId());
        assertEquals(1, loaded.manualLootNotes().size(),
                "the deleted canonical note must not be restored from stale legacy data");
        assertEquals(41L, loaded.manualLootNotes().getFirst().noteId());
        assertEquals(13L, loaded.manualLootNotes().getFirst().sceneId());
        assertEquals("Canonically edited note", loaded.manualLootNotes().getFirst().authoredText());

        try (Connection connection = rawConnection(path)) {
            assertEquals(4, featureVersion(connection));
            assertFalse(schemaObjectExists(connection, "table", LEGACY_TABLE));
            assertFalse(schemaObjectExists(connection, "index", LEGACY_INDEX));
            assertEquals(1, rowCount(connection, "session_planner_manual_loot_notes"));
        }
    }

    @Test
    void versionFourFailureRollsBackVersionIndexTableAndData() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-v3-rollback.db");
        createVersionThreeFixture(path, true);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(database);
            assertThrows(IllegalStateException.class, () -> repository.loadById(9L));
        }

        try (Connection connection = rawConnection(path)) {
            assertEquals(3, featureVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", LEGACY_TABLE));
            assertTrue(schemaObjectExists(connection, "index", LEGACY_INDEX));
            assertEquals(2, rowCount(connection, LEGACY_TABLE));
            assertEquals("Zero anchor note", scalarText(connection,
                    "SELECT label FROM " + LEGACY_TABLE + " WHERE loot_id = 41"));
            assertEquals("Explicit anchor note", scalarText(connection,
                    "SELECT label FROM " + LEGACY_TABLE + " WHERE loot_id = 42"));
            assertEquals(1, rowCount(connection, "session_planner_manual_loot_notes"));
            assertEquals("Canonically edited note", scalarText(connection,
                    "SELECT note_text FROM session_planner_manual_loot_notes WHERE note_id = 41"));
            assertEquals(1, rowCount(connection, "test_legacy_loot_reference"));
        }
    }

    private static void createVersionTwoFixture(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT NULL)");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES ('session-planner', 2)");
            statement.execute("PRAGMA user_version = 1");
            createVersionTwoSchema(statement);
            insertVersionTwoData(statement);
        }
    }

    private static void createVersionThreeFixture(Path path, boolean blockLegacyDrop) throws Exception {
        createVersionTwoFixture(path);
        try (Connection connection = rawConnection(path);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("ALTER TABLE session_planner_sessions "
                    + "ADD COLUMN revision INTEGER NOT NULL DEFAULT 1");
            statement.execute("UPDATE session_planner_sessions SET revision = 9 WHERE session_id = 9");
            statement.execute("CREATE TABLE session_planner_manual_loot_notes ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "note_id INTEGER NOT NULL, scene_id INTEGER NOT NULL, note_text TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, note_id), "
                    + "FOREIGN KEY(session_id, scene_id) "
                    + "REFERENCES session_planner_encounters(session_id, encounter_id) ON DELETE CASCADE)");
            statement.execute("CREATE INDEX idx_session_planner_manual_loot_notes_order "
                    + "ON session_planner_manual_loot_notes(session_id, sort_order)");
            statement.execute("INSERT INTO session_planner_manual_loot_notes VALUES "
                    + "(9, 41, 13, 'Canonically edited note', 0)");
            statement.execute("UPDATE sm_schema_versions SET version = 3 WHERE owner = 'session-planner'");
            if (blockLegacyDrop) {
                statement.execute("CREATE TABLE test_legacy_loot_reference ("
                        + "session_id INTEGER NOT NULL, loot_id INTEGER NOT NULL, "
                        + "FOREIGN KEY(session_id, loot_id) REFERENCES " + LEGACY_TABLE
                        + "(session_id, loot_id) ON DELETE RESTRICT)");
                statement.execute("INSERT INTO test_legacy_loot_reference VALUES (9, 41)");
            }
        }
    }

    private static void createVersionTwoSchema(Statement statement) throws Exception {
        statement.execute("CREATE TABLE session_planner_sessions ("
                + "session_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, encounter_days TEXT NOT NULL, "
                + "selected_encounter_id INTEGER NOT NULL, status_text TEXT NOT NULL, "
                + "next_encounter_id INTEGER NOT NULL, next_loot_id INTEGER NOT NULL, updated_at TEXT NOT NULL)");
        statement.execute("CREATE TABLE session_planner_current_session ("
                + "singleton_id INTEGER PRIMARY KEY, "
                + "session_id INTEGER REFERENCES session_planner_sessions(session_id))");
        statement.execute("CREATE TABLE session_planner_participants ("
                + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                + "character_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                + "PRIMARY KEY(session_id, character_id))");
        statement.execute("CREATE TABLE session_planner_encounters ("
                + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                + "encounter_id INTEGER NOT NULL, encounter_plan_id INTEGER NOT NULL, "
                + "budget_percentage TEXT NOT NULL, scene_title TEXT NOT NULL, scene_notes TEXT NOT NULL, "
                + "location_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, "
                + "PRIMARY KEY(session_id, encounter_id))");
        statement.execute("CREATE TABLE session_planner_rests ("
                + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                + "left_encounter_id INTEGER NOT NULL, right_encounter_id INTEGER NOT NULL, "
                + "rest_kind TEXT NOT NULL, sort_order INTEGER NOT NULL, "
                + "PRIMARY KEY(session_id, left_encounter_id, right_encounter_id))");
        statement.execute("CREATE TABLE " + LEGACY_TABLE + " ("
                + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                + "loot_id INTEGER NOT NULL, encounter_id INTEGER NOT NULL, label TEXT NOT NULL, "
                + "sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, loot_id))");
        statement.execute("CREATE INDEX " + LEGACY_INDEX + " ON " + LEGACY_TABLE + "(session_id, sort_order)");
        statement.execute("CREATE TABLE session_planner_generated_rewards ("
                + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                + "scene_id INTEGER NOT NULL, generation_id TEXT NOT NULL, treasure_id INTEGER NOT NULL, "
                + "last_known_label TEXT NOT NULL, sort_order INTEGER NOT NULL, "
                + "PRIMARY KEY(session_id, generation_id, treasure_id), "
                + "FOREIGN KEY(session_id, scene_id) "
                + "REFERENCES session_planner_encounters(session_id, encounter_id))");
    }

    private static void insertVersionTwoData(Statement statement) throws Exception {
        statement.execute("INSERT INTO session_planner_sessions VALUES "
                + "(9, 'Legacy', '0.6', 12, '', 14, 43, CURRENT_TIMESTAMP)");
        statement.execute("INSERT INTO session_planner_encounters VALUES "
                + "(9, 13, 101, '50', 'Second', '', 0, 1), "
                + "(9, 12, 102, '50', 'First', '', 0, 0)");
        statement.execute("INSERT INTO " + LEGACY_TABLE + " VALUES "
                + "(9, 42, 13, 'Explicit anchor note', 1), "
                + "(9, 41, 0, 'Zero anchor note', 0)");
        statement.execute("INSERT INTO session_planner_generated_rewards VALUES "
                + "(9, 12, 'legacy-run', 7, 'Legacy cache', 0)");
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

    private static int rowCount(Connection connection, String table) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static String scalarText(Connection connection, String query) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }
}
