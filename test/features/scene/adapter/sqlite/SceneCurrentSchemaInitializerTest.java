package features.scene.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class SceneCurrentSchemaInitializerTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesCompleteCurrentTargetDirectlyAtVersionOne() throws Exception {
        Path path = temporaryDirectory.resolve("scene-current.db");
        assertEquals(1, SqliteSceneWorkspaceRepository.storeDefinition().migrations().size());

        try (SqliteDatabase database = database(path)) {
            new SqliteSceneWorkspaceRepository(TestFeatureStores.store(
                    database, SqliteSceneWorkspaceRepository.storeDefinition())).load();
        }

        try (Connection connection = open(path)) {
            assertEquals(1, ownerVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", ScenePersistenceSchema.MOB_TABLE));
            assertTrue(schemaObjectExists(connection, "table", ScenePersistenceSchema.STATE_TABLE));
            assertEquals(6, ownerTableCount(connection));
        }
    }

    @Test
    void unversionedPartialOwnerShapeFailsWithoutRepairOrLedgerFabrication() throws Exception {
        Path path = temporaryDirectory.resolve("scene-partial.db");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE scene_workspace(workspace_id INTEGER PRIMARY KEY, payload TEXT)");
            statement.execute("INSERT INTO scene_workspace VALUES(1, 'kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM scene_workspace"));
            assertFalse(schemaObjectExists(connection, "table", ScenePersistenceSchema.SCENE_TABLE));
            assertEquals(0, ownerVersion(connection));
        }
    }

    @Test
    void recordedDamagedCurrentShapeFailsClosedWithoutMutation() throws Exception {
        Path path = temporaryDirectory.resolve("scene-damaged-v1.db");
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : ScenePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(
                        "encounter_synchronized INTEGER NOT NULL CHECK(encounter_synchronized IN (0,1))",
                        "encounter_synchronized INTEGER NOT NULL"));
            }
        }
        String before;
        try (Connection connection = open(path)) {
            before = tableSql(connection, ScenePersistenceSchema.WORKSPACE_TABLE);
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(before, tableSql(connection, ScenePersistenceSchema.WORKSPACE_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void recordedCurrentShapeWithAdjacentOwnerObjectFailsClosed() throws Exception {
        Path path = temporaryDirectory.resolve("scene-adjacent.db");
        createCurrentShape(path);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE VIEW scene_retired AS SELECT 'kept' AS payload");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertTrue(schemaObjectExists(connection, "view", "scene_retired"));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void supersededAdditiveVersionFailsWithoutBackfillOrLedgerRewrite() throws Exception {
        Path path = temporaryDirectory.resolve("scene-v3.db");
        createLedger(path, 3);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE scene_workspace(workspace_id INTEGER PRIMARY KEY, payload TEXT)");
            statement.execute("INSERT INTO scene_workspace VALUES(1, 'kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.NEWER_SCHEMA);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM scene_workspace"));
            assertEquals(3, ownerVersion(connection));
            assertFalse(schemaObjectExists(connection, "table", ScenePersistenceSchema.MOB_TABLE));
        }
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected) {
        try (SqliteDatabase database = database(path)) {
            var store = database.featureStore(SqliteSceneWorkspaceRepository.storeDefinition());
            assertEquals(expected, database.prepareRegisteredStores().get("scene"));
            FeatureStoreUnavailableException failure = assertThrows(
                    FeatureStoreUnavailableException.class, store::openConnection);
            assertEquals(expected, failure.readiness());
        }
    }

    private static void createCurrentShape(Path path) throws Exception {
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : ScenePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static void createLedger(Path path, int version) throws Exception {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions VALUES('scene', " + version + ")");
        }
    }

    private static SqliteDatabase database(Path path) {
        return new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
    }

    private static Connection open(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }

    private static int ownerVersion(Connection connection) throws Exception {
        if (!schemaObjectExists(connection, "table", "sm_schema_versions")) {
            return 0;
        }
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner='scene'")) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static int ownerTableCount(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name GLOB 'scene_*'")) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static boolean schemaObjectExists(Connection connection, String type, String name) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
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

    private static String scalarText(Connection connection, String query) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(query)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }
}
