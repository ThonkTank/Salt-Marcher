package features.encountertable.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encountertable.adapter.sqlite.model.EncounterTablePersistenceSchema;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class EncounterTableCurrentSchemaInitializerTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesCurrentTargetAtVersionOneAndRestartsWithoutForeignOwnerFks() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-table-current.db");
        assertEquals(1, SqliteEncounterTableLocalGateway.storeDefinition().migrations().size());

        try (SqliteDatabase database = database(path)) {
            SqliteEncounterTableLocalGateway gateway = gateway(database);
            assertTrue(gateway.loadSummaries().isEmpty());
        }
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("INSERT INTO encounter_tables(table_id,name,description)"
                    + " VALUES(7,'Westmark Patrol','kept')");
            statement.execute("INSERT INTO encounter_table_entries(table_id,creature_id,weight)"
                    + " VALUES(7,99,4)");
            statement.execute("INSERT INTO encounter_table_loot_links(table_id,loot_table_id)"
                    + " VALUES(7,501)");
            assertEquals(List.of("encounter_tables"),
                    foreignTargets(connection, EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE));
            assertEquals(List.of("encounter_tables"),
                    foreignTargets(connection, EncounterTablePersistenceSchema.ENCOUNTER_TABLE_LOOT_LINKS_TABLE));
        }

        try (SqliteDatabase reopened = database(path)) {
            var summary = gateway(reopened).loadSummaries().getFirst();
            assertEquals(7L, summary.tableId());
            assertEquals("Westmark Patrol", summary.name());
            assertEquals(Long.valueOf(501L), summary.linkedLootTableId());
        }
        try (Connection connection = open(path)) {
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void unversionedPartialOwnerShapeFailsWithoutRepairOrLedgerFabrication() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-table-partial.db");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE encounter_tables(table_id INTEGER PRIMARY KEY, legacy_name TEXT)");
            statement.execute("INSERT INTO encounter_tables VALUES(7,'kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT legacy_name FROM encounter_tables"));
            assertFalse(schemaObjectExists(connection, "table",
                    EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE));
            assertEquals(0, ownerVersion(connection));
        }
    }

    @Test
    void recordedDamagedVersionOneFailsClosedWithoutMutation() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-table-damaged-v1.db");
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : EncounterTablePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(
                        "weight INTEGER NOT NULL DEFAULT 1 CHECK(weight BETWEEN 1 AND 10)",
                        "weight INTEGER NOT NULL DEFAULT 1"));
            }
            for (String sql : EncounterTablePersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
        String before;
        try (Connection connection = open(path)) {
            before = tableSql(connection, EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE);
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(before, tableSql(
                    connection, EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void recordedCurrentShapeWithAdjacentOwnerObjectFailsClosed() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-table-adjacent.db");
        createCurrentShape(path);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE encounter_table_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO encounter_table_retired VALUES('kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM encounter_table_retired"));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void newerDevelopmentVersionFailsWithoutConversionOrLedgerRewrite() throws Exception {
        Path path = temporaryDirectory.resolve("encounter-table-newer.db");
        createLedger(path, 2);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE encounter_table_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO encounter_table_retired VALUES('kept')");
        }

        assertUnavailable(path, FeatureStoreReadiness.NEWER_SCHEMA);

        try (Connection connection = open(path)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM encounter_table_retired"));
            assertEquals(2, ownerVersion(connection));
            assertFalse(schemaObjectExists(connection, "table",
                    EncounterTablePersistenceSchema.ENCOUNTER_TABLES_TABLE));
        }
    }

    private static SqliteEncounterTableLocalGateway gateway(SqliteDatabase database) {
        return new SqliteEncounterTableLocalGateway(TestFeatureStores.store(
                database, SqliteEncounterTableLocalGateway.storeDefinition()));
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected) {
        try (SqliteDatabase database = database(path)) {
            var store = database.featureStore(SqliteEncounterTableLocalGateway.storeDefinition());
            assertEquals(expected, database.prepareRegisteredStores().get("encounter-table"));
            FeatureStoreUnavailableException failure = assertThrows(
                    FeatureStoreUnavailableException.class, store::openConnection);
            assertEquals(expected, failure.readiness());
        }
    }

    private static void createCurrentShape(Path path) throws Exception {
        createLedger(path, 1);
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            for (String sql : EncounterTablePersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            for (String sql : EncounterTablePersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static void createLedger(Path path, int version) throws Exception {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("INSERT INTO sm_schema_versions VALUES('encounter-table', " + version + ")");
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
                     "SELECT version FROM sm_schema_versions WHERE owner='encounter-table'")) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static List<String> foreignTargets(Connection connection, String table) throws Exception {
        List<String> targets = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                targets.add(result.getString("table"));
            }
        }
        return List.copyOf(targets);
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
