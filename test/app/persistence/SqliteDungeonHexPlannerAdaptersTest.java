package app.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonMapRepository;
import features.hex.adapter.sqlite.repository.SqliteHexMapRepository;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;

final class SqliteDungeonHexPlannerAdaptersTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void sharesOneDatabaseAcrossFeatureAdaptersWithPersistentVersionedMigrations() throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dungeon-hex-planners.db"),
                NoopDiagnostics.INSTANCE)) {
            SqliteDungeonMapRepository dungeons = new SqliteDungeonMapRepository(database);
            SqliteHexMapRepository hexMaps = new SqliteHexMapRepository(database);
            SqliteSessionPlanRepository sessions = new SqliteSessionPlanRepository(database);
            SqliteWorldPlannerRepository world = new SqliteWorldPlannerRepository(database);
            Map<String, Integer> expectedVersions = Map.of(
                    "dungeon", 1,
                    "hex", 1,
                    "session-planner", 1,
                    "world-planner", 1);

            assertTrue(dungeons.searchByName("").isEmpty());
            assertTrue(hexMaps.listMaps().isEmpty());
            assertTrue(sessions.listSessions().isEmpty());
            assertTrue(world.load().npcs().isEmpty());
            assertEquals(expectedVersions, featureVersions(database));

            dungeons.firstMap();
            hexMaps.loadSelected();
            sessions.loadCurrent();
            world.load();

            assertEquals(expectedVersions, featureVersions(database));
        }
    }

    private static Map<String, Integer> featureVersions(SqliteDatabase database) throws Exception {
        Map<String, Integer> versions = new LinkedHashMap<>();
        try (var connection = database.connections("test-inspection").openConnection();
             var result = connection.createStatement().executeQuery(
                     "SELECT owner, version FROM sm_schema_versions ORDER BY owner")) {
            while (result.next()) {
                versions.put(result.getString("owner"), result.getInt("version"));
            }
        }
        return versions;
    }
}
