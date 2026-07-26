package features.hex.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.hex.adapter.sqlite.model.HexMapRecord;
import features.hex.adapter.sqlite.model.HexMapSnapshotRecord;
import features.hex.adapter.sqlite.model.HexPersistenceSchema;
import features.hex.adapter.sqlite.model.HexTileRecord;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class HexCurrentSchemaInitializerTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesCurrentTargetDirectlyAtVersionOneAndRestarts() throws Exception {
        Path path = temporaryDirectory.resolve("hex-current.db");
        assertEquals(1, SqliteHexMapLocalGateway.storeDefinition().migrations().size());

        try (SqliteDatabase database = database(path)) {
            SqliteHexMapLocalGateway gateway = gateway(database);
            gateway.save(new HexMapSnapshotRecord(
                    new HexMapRecord(7L, "Westmark", 0),
                    List.of(new HexTileRecord(7L, 0, 0)),
                    List.of(),
                    List.of()));
            gateway.setSelectedMap(7L);
        }

        try (SqliteDatabase reopened = database(path)) {
            HexMapSnapshotRecord loaded = gateway(reopened).loadSelected().orElseThrow();
            assertEquals("Westmark", loaded.map().displayName());
            assertEquals(List.of(new HexTileRecord(7L, 0, 0)), loaded.tiles());
        }

        try (Connection connection = open(path)) {
            assertEquals(1, ownerVersion(connection));
            assertTrue(schemaObjectExists(connection, "table", HexPersistenceSchema.MARKERS_TABLE));
            assertFalse(schemaObjectExists(connection, "table", "sm_hex_v1_maps_archive"));
        }
    }

    @Test
    void unversionedPartialOwnerShapeFailsWithoutRepairOrLedgerFabrication() throws Exception {
        Path path = temporaryDirectory.resolve("hex-partial.db");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE hex_maps(map_id INTEGER PRIMARY KEY, legacy_name TEXT NOT NULL)");
            statement.execute("INSERT INTO hex_maps VALUES(7, 'kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT legacy_name FROM hex_maps WHERE map_id=7"));
            assertFalse(schemaObjectExists(connection, "table", HexPersistenceSchema.TILES_TABLE));
            assertEquals(0, ownerVersion(connection));
        }
    }

    @Test
    void recordedDamagedVersionOneFailsClosedWithoutMutation() throws Exception {
        Path path = temporaryDirectory.resolve("hex-damaged-v1.db");
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : HexPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(
                        "terrain TEXT NOT NULL",
                        "terrain TEXT"));
            }
            for (String sql : HexPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
        String before;
        try (Connection connection = open(path)) {
            before = tableSql(connection, HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE);
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(before, tableSql(connection, HexPersistenceSchema.TERRAIN_OVERRIDES_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void recordedCurrentTargetWithAdjacentRetiredObjectFailsClosed() throws Exception {
        Path path = temporaryDirectory.resolve("hex-adjacent.db");
        createCurrentShape(path);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE sm_hex_v2_staging(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO sm_hex_v2_staging VALUES('kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM sm_hex_v2_staging"));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void supersededDevelopmentVersionFailsWithoutConversionCopyOrDrop() throws Exception {
        Path path = temporaryDirectory.resolve("hex-newer.db");
        createLedger(path, 2);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE sm_hex_v1_maps_archive(map_id INTEGER PRIMARY KEY, payload TEXT)");
            statement.execute("INSERT INTO sm_hex_v1_maps_archive VALUES(7, 'kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.NEWER_SCHEMA);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection,
                    "SELECT payload FROM sm_hex_v1_maps_archive WHERE map_id=7"));
            assertEquals(2, ownerVersion(connection));
            assertFalse(schemaObjectExists(connection, "table", HexPersistenceSchema.CURRENT_MAP_TABLE));
        }
    }

    private static SqliteHexMapLocalGateway gateway(SqliteDatabase database) {
        return new SqliteHexMapLocalGateway(
                TestFeatureStores.store(database, SqliteHexMapLocalGateway.storeDefinition()));
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected) {
        try (SqliteDatabase database = database(path)) {
            var store = database.featureStore(SqliteHexMapLocalGateway.storeDefinition());
            assertEquals(expected, database.prepareRegisteredStores().get("hex"));
            FeatureStoreUnavailableException failure = assertThrows(
                    FeatureStoreUnavailableException.class, store::openConnection);
            assertEquals(expected, failure.readiness());
        }
    }

    private static void createCurrentShape(Path path) throws Exception {
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : HexPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            for (String sql : HexPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static void createLedger(Path path, int version) throws Exception {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions VALUES('hex', " + version + ")");
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
                     "SELECT version FROM sm_schema_versions WHERE owner='hex'")) {
            return result.next() ? result.getInt(1) : 0;
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
