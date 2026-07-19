package app.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.adapter.sqlite.repository.SqliteDungeonCatalogStore;
import features.hex.adapter.sqlite.repository.SqliteHexMapRepository;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.LinkedHashMap;
import java.util.Map;

final class SqliteDungeonHexPlannerAdaptersTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void sharesOneDatabaseAcrossFeatureAdaptersWithPersistentVersionedMigrations() throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dungeon-hex-planners.db"),
                NoopDiagnostics.INSTANCE)) {
            var stores =
                    TestFeatureStores.stores(
                            database,
                            features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition.create(),
                            SqliteHexMapRepository.storeDefinition(),
                            SqliteSessionPlanRepository.storeDefinition(),
                            SqliteWorldPlannerRepository.storeDefinition());
            var dungeonStore = stores.get("dungeon");
            SqliteDungeonCatalogStore dungeons = new SqliteDungeonCatalogStore(dungeonStore);
            SqliteHexMapRepository hexMaps = new SqliteHexMapRepository(stores.get("hex"));
            SqliteSessionPlanRepository sessions = new SqliteSessionPlanRepository(stores.get("session-planner"));
            SqliteWorldPlannerRepository world = new SqliteWorldPlannerRepository(stores.get("world-planner"));
            Map<String, Integer> expectedVersions = Map.of(
                "dungeon", 7,
                    "hex", 1,
                    "session-planner", 4,
                    "world-planner", 2);

            assertTrue(dungeons.search("").isEmpty());
            assertTrue(hexMaps.listMaps().isEmpty());
            assertTrue(sessions.listSessions().isEmpty());
            assertTrue(world.load().npcs().isEmpty());
            assertEquals(expectedVersions, featureVersions(dungeonStore));

            dungeons.first();
            hexMaps.loadSelected();
            sessions.loadCurrent();
            world.load();

            assertEquals(expectedVersions, featureVersions(dungeonStore));
        }
    }

    @Test
    void malformedCurrentDungeonAuthoredSchemaFailsWithoutBlockingHex() throws Exception {
        Path databasePath = temporaryDirectory.resolve("malformed-dungeon-authored.db");
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            TestFeatureStores.stores(
                    initial,
                    features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition.create(),
                    SqliteHexMapRepository.storeDefinition());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute("DROP TABLE dungeon_feature_markers");
            connection.createStatement().execute(
                    "CREATE TABLE dungeon_feature_markers(feature_marker_id INTEGER PRIMARY KEY)");
        }

        try (SqliteDatabase current = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var dungeon = current.featureStore(
                    features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition.create());
            current.featureStore(SqliteHexMapRepository.storeDefinition());

            var readiness = current.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("dungeon"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("hex"));
            assertThrows(FeatureStoreUnavailableException.class, dungeon::openConnection);
        }
    }

    private static Map<String, Integer> featureVersions(
            platform.persistence.FeatureStoreHandle store) throws Exception {
        Map<String, Integer> versions = new LinkedHashMap<>();
        try (var connection = store.openConnection();
             var result = connection.createStatement().executeQuery(
                                        "SELECT owner, version FROM sm_schema_versions ORDER BY"
                                            + " owner")) {
            while (result.next()) {
                versions.put(result.getString("owner"), result.getInt("version"));
            }
        }
        return versions;
    }
}
