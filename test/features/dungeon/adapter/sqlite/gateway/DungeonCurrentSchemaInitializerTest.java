package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonCurrentSchemaInitializerTest {

    @Test
    void freshOwnerRunsOneDirectCurrentTargetInitializer(@TempDir Path tempDir) throws Exception {
        Path databasePath = tempDir.resolve("current-target.db");
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE party_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO party_guard(payload) VALUES('kept')");
        }

        var definition = DungeonStoreDefinition.create();
        assertEquals(1, definition.migrations().size());
        assertEquals(DungeonSqliteSchemaManager.CURRENT_SCHEMA_VERSION,
                definition.migrations().getFirst().version());

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, definition).openConnection()) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("kept", scalarText(connection, "SELECT payload FROM party_guard"));
            assertTrue(tableExists(connection, "dungeon_maps"));
            assertTrue(tableExists(connection, "dungeon_authored_level_bounds"));
            assertTrue(tableExists(connection, "dungeon_corridor_route_dependencies"));
            assertTrue(indexExists(connection, "idx_dungeon_corridor_route_dependencies_by_cell"));
            assertEquals(DungeonIdentityKind.values().length, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_identity_sequences"));
            assertFalse(connection.createStatement().executeQuery("PRAGMA foreign_key_check").next());
        }
    }

    @Test
    void currentTargetRestartsWithoutReinitializingOrLosingAuthoredRows(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("restart.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            connection.createStatement().execute(
                    "INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(7,'kept',3)");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("kept", scalarText(connection,
                    "SELECT name FROM dungeon_maps WHERE dungeon_map_id=7"));
            assertEquals(3, scalarInt(connection,
                    "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=7"));
        }
    }

    @Test
    void preexistingDevelopmentShapeFailsClosedWithoutConversionOrDeletion(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("development-shape.db");
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute(
                    "CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY, legacy_name TEXT NOT NULL)");
            statement.execute("INSERT INTO dungeon_maps VALUES(7,'untouched')");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get(DungeonStoreDefinition.OWNER));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals("untouched", scalarText(connection,
                    "SELECT legacy_name FROM dungeon_maps WHERE dungeon_map_id=7"));
            assertFalse(tableExists(connection, "dungeon_authored_level_bounds"));
            assertFalse(tableExists(connection, "dungeon_identity_sequences"));
        }
    }

    @Test
    void formerDevelopmentOwnerLedgerFailsClosedWithoutInterpretingItsRows(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("development-ledger.db");
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions VALUES('dungeon',7)");
            statement.execute(
                    "CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY, legacy_name TEXT NOT NULL)");
            statement.execute("INSERT INTO dungeon_maps VALUES(7,'untouched')");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.NEWER_SCHEMA,
                    database.prepareRegisteredStores().get(DungeonStoreDefinition.OWNER));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(7, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("untouched", scalarText(connection,
                    "SELECT legacy_name FROM dungeon_maps WHERE dungeon_map_id=7"));
            assertFalse(tableExists(connection, "dungeon_authored_level_bounds"));
        }
    }

    @Test
    void incompleteCurrentTargetFailsClosedWithoutRepairingOrDeletingRows(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("incomplete-current.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            connection.createStatement().execute(
                    "INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(7,'untouched',1)");
        }
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute("DROP TABLE dungeon_authored_level_bounds");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get(DungeonStoreDefinition.OWNER));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("untouched", scalarText(connection,
                    "SELECT name FROM dungeon_maps WHERE dungeon_map_id=7"));
            assertFalse(tableExists(connection, "dungeon_authored_level_bounds"));
        }
    }

    @Test
    void recordedCurrentColumnsWithoutChunkMapRelationshipFailClosedWithoutMutation(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("missing-chunk-map-relationship.db");
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions VALUES('dungeon',1)");
            for (String sql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(
                        "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                                + "level_z        INTEGER NOT NULL,"
                                + "chunk_q        INTEGER NOT NULL,",
                        "dungeon_map_id INTEGER NOT NULL,"
                                + "level_z        INTEGER NOT NULL,"
                                + "chunk_q        INTEGER NOT NULL,"));
            }
            for (String sql : DungeonPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
        String before;
        try (Connection connection = open(databasePath)) {
            before = tableSql(connection, DungeonPersistenceSchema.CHUNKS_TABLE);
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get(DungeonStoreDefinition.OWNER));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(before, tableSql(connection, DungeonPersistenceSchema.CHUNKS_TABLE));
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
        }
    }

    @Test
    void recordedCurrentShapeWithAdjacentDevelopmentObjectFailsClosed(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("current-plus-development.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            connection.createStatement().execute("CREATE TABLE dungeon_retired(payload TEXT NOT NULL)");
            connection.createStatement().execute("INSERT INTO dungeon_retired VALUES('kept')");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get(DungeonStoreDefinition.OWNER));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM dungeon_retired"));
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
        }
    }

    @Test
    void missingCurrentIdentitySequenceFailsClosedWithoutRuntimeRepair(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("missing-identity-sequence.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection ignored = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            // Initialize the complete current target.
        }
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute(
                    "DELETE FROM dungeon_identity_sequences WHERE identity_kind='ROOM'");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var gateway = new DungeonSqliteIdentityGateway(
                    TestFeatureStores.store(database, DungeonStoreDefinition.create()));
            assertThrows(IllegalStateException.class,
                    () -> gateway.reserve(DungeonIdentityKind.ROOM, 1));
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_identity_sequences WHERE identity_kind='ROOM'"));
        }
    }

    private static Connection open(Path databasePath) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
        }
        return connection;
    }

    private static int scalarInt(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static String scalarText(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        return objectExists(connection, "table", table);
    }

    private static boolean indexExists(Connection connection, String index) throws SQLException {
        return objectExists(connection, "index", index);
    }

    private static String tableSql(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : "";
            }
        }
    }

    private static boolean objectExists(Connection connection, String type, String name) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next());
                return result.getInt(1) == 1;
            }
        }
    }
}
