package features.scene.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.scene.domain.RunningScene;
import features.scene.domain.SceneWorkspace;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;

class SqliteSceneWorkspaceRepositoryTest {

    @Test
    void relationalRoundTripKeepsStableForeignIdsWithoutCrossOwnerForeignKeys(@TempDir Path temporary) throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(temporary.resolve("scene.sqlite"), NoopDiagnostics.INSTANCE)) {
            SqliteSceneWorkspaceRepository repository = new SqliteSceneWorkspaceRepository(database);
            SceneWorkspace expected = workspace();

            repository.save(expected);
            SceneWorkspace actual = repository.load().orElseThrow();

            assertEquals(expected, actual);
            SqliteConnectionSource probe = database.connections("scene-test-probe");
            try (Connection connection = probe.openConnection()) {
                assertEquals(List.of("scene_running_scene"), foreignTargets(connection, "scene_party_member"));
                assertEquals(List.of("scene_running_scene"), foreignTargets(connection, "scene_npc"));
                assertEquals(List.of(), foreignTargets(connection, "scene_running_scene"));
            }
        }
    }

    private static SceneWorkspace workspace() {
        RunningScene defaultScene = new RunningScene(
                1L, "Standard", "", 0L, 0L, "", 0L, 20L, List.of(1001L), List.of(2001L));
        RunningScene imported = new RunningScene(
                2L, "Torhaus", "Wachen", 91L, 44L, "Abend", 301L, 20L,
                List.of(1002L), List.of(2002L));
        return new SceneWorkspace(8L, 3L, 1L, 2L, false, "Ausstehend", List.of(defaultScene, imported));
    }

    private static List<String> foreignTargets(Connection connection, String table) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            java.util.ArrayList<String> targets = new java.util.ArrayList<>();
            while (rows.next()) {
                targets.add(rows.getString("table"));
            }
            return List.copyOf(targets);
        }
    }
}
