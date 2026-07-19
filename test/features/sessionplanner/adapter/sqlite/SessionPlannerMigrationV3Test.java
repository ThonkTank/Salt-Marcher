package features.sessionplanner.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.domain.session.SessionPlan;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SessionPlannerMigrationV3Test {

    @TempDir
    Path temporaryDirectory;

    @Test
    void migratesRevisionAndEveryLegacyManualNoteWithZeroAnchorFallback() throws Exception {
        Path path = temporaryDirectory.resolve("session-planner-v2.db");
        createVersionTwoFixture(path);

        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(database);
        SessionPlan loaded = repository.loadById(9L).orElseThrow();

        assertEquals(1L, loaded.revision().value());
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
        database.close();
    }

    private static void createVersionTwoFixture(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT NULL)");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES ('session-planner', 2)");
            statement.execute("PRAGMA user_version = 1");
            statement.execute("CREATE TABLE session_planner_sessions ("
                    + "session_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, encounter_days TEXT NOT NULL, "
                    + "selected_encounter_id INTEGER NOT NULL, status_text TEXT NOT NULL, "
                    + "next_encounter_id INTEGER NOT NULL, next_loot_id INTEGER NOT NULL, updated_at TEXT NOT NULL)");
            statement.execute("CREATE TABLE session_planner_current_session ("
                    + "singleton_id INTEGER PRIMARY KEY, session_id INTEGER REFERENCES session_planner_sessions(session_id))");
            statement.execute("CREATE TABLE session_planner_participants ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "character_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, character_id))");
            statement.execute("CREATE TABLE session_planner_encounters ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "encounter_id INTEGER NOT NULL, encounter_plan_id INTEGER NOT NULL, budget_percentage TEXT NOT NULL, "
                    + "scene_title TEXT NOT NULL, scene_notes TEXT NOT NULL, location_id INTEGER NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, encounter_id))");
            statement.execute("CREATE TABLE session_planner_rests ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "left_encounter_id INTEGER NOT NULL, right_encounter_id INTEGER NOT NULL, "
                    + "rest_kind TEXT NOT NULL, sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, left_encounter_id, right_encounter_id))");
            statement.execute("CREATE TABLE session_planner_loot_placeholders ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "loot_id INTEGER NOT NULL, encounter_id INTEGER NOT NULL, label TEXT NOT NULL, "
                    + "sort_order INTEGER NOT NULL, PRIMARY KEY(session_id, loot_id))");
            statement.execute("CREATE TABLE session_planner_generated_rewards ("
                    + "session_id INTEGER NOT NULL REFERENCES session_planner_sessions(session_id) ON DELETE CASCADE, "
                    + "scene_id INTEGER NOT NULL, generation_id TEXT NOT NULL, treasure_id INTEGER NOT NULL, "
                    + "last_known_label TEXT NOT NULL, sort_order INTEGER NOT NULL, "
                    + "PRIMARY KEY(session_id, generation_id, treasure_id), "
                    + "FOREIGN KEY(session_id, scene_id) REFERENCES session_planner_encounters(session_id, encounter_id))");
            statement.execute("INSERT INTO session_planner_sessions VALUES "
                    + "(9, 'Legacy', '0.6', 12, '', 14, 43, CURRENT_TIMESTAMP)");
            statement.execute("INSERT INTO session_planner_encounters VALUES "
                    + "(9, 13, 101, '50', 'Second', '', 0, 1), "
                    + "(9, 12, 102, '50', 'First', '', 0, 0)");
            statement.execute("INSERT INTO session_planner_loot_placeholders VALUES "
                    + "(9, 42, 13, 'Explicit anchor note', 1), "
                    + "(9, 41, 0, 'Zero anchor note', 0)");
            statement.execute("INSERT INTO session_planner_generated_rewards VALUES "
                    + "(9, 12, 'legacy-run', 7, 'Legacy cache', 0)");
        }
    }
}
