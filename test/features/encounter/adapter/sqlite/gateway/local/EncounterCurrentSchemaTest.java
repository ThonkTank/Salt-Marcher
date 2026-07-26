package features.encounter.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
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

final class EncounterCurrentSchemaTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshOwnerCreatesOneExactCurrentTargetWithoutCrossStoreForeignKeys() throws Exception {
        Path campaignPath = temporaryDirectory.resolve("fresh-campaign.sqlite");
        var definition = SqliteEncounterPlanRepository.storeDefinition();

        assertEquals(1, definition.migrations().size());
        assertEquals(1, definition.migrations().getFirst().version());

        try (SqliteDatabase database = new SqliteDatabase(campaignPath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, definition).openConnection()) {
            assertEquals(1, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='encounter'"));
            assertTrue(tableExists(connection, "saved_encounter_plans"));
            assertTrue(tableExists(connection, "generated_encounter_plan_origins"));
            assertTrue(tableExists(connection, "encounter_runtime_result_enemies"));
            assertFalse(tableExists(connection, "creatures"));
            assertEquals(List.of("saved_encounter_plans"), foreignKeyTargets(
                    connection, "saved_encounter_plan_creatures"));
            assertTrue(indexExists(connection, "idx_generated_encounter_preparation_identity"));
            assertFalse(connection.createStatement().executeQuery("PRAGMA foreign_key_check").next());
        }
    }

    @Test
    void unversionedDevelopmentShapeFailsWithoutChangingBytesOrRows() throws Exception {
        Path campaignPath = temporaryDirectory.resolve("unversioned-development.sqlite");
        seedPartialShape(campaignPath, null);
        byte[] originalBytes = Files.readAllBytes(campaignPath);

        assertUnavailable(campaignPath, FeatureStoreReadiness.MIGRATION_FAILED);

        assertArrayEquals(originalBytes, Files.readAllBytes(campaignPath));
        try (Connection connection = open(campaignPath)) {
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM saved_encounter_plans WHERE plan_id=7"));
            assertFalse(tableExists(connection, "saved_encounter_plan_creatures"));
            assertFalse(featureVersionExists(connection));
        }
    }

    @Test
    void newerDevelopmentShapeFailsWithoutChangingBytesOrRows() throws Exception {
        Path campaignPath = temporaryDirectory.resolve("newer-development.sqlite");
        seedPartialShape(campaignPath, Integer.valueOf(2));
        byte[] originalBytes = Files.readAllBytes(campaignPath);

        assertUnavailable(campaignPath, FeatureStoreReadiness.NEWER_SCHEMA);

        assertArrayEquals(originalBytes, Files.readAllBytes(campaignPath));
        try (Connection connection = open(campaignPath)) {
            assertEquals(2, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='encounter'"));
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM saved_encounter_plans WHERE plan_id=7"));
            assertFalse(tableExists(connection, "generated_encounter_plan_batches"));
        }
    }

    @Test
    void incompleteCurrentTargetFailsExactValidationWithoutRepairingRowsOrIndex() throws Exception {
        Path campaignPath = temporaryDirectory.resolve("incomplete-current.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(campaignPath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(
                     database, SqliteEncounterPlanRepository.storeDefinition()).openConnection()) {
            connection.createStatement().executeUpdate(
                    "INSERT INTO saved_encounter_plans(plan_id,name,generated_label) "
                            + "VALUES(7,'untouched','')");
        }
        try (Connection connection = open(campaignPath)) {
            connection.createStatement().execute("DROP INDEX idx_saved_encounter_plans_updated");
        }
        byte[] originalBytes = Files.readAllBytes(campaignPath);

        assertUnavailable(campaignPath, FeatureStoreReadiness.MIGRATION_FAILED);

        assertArrayEquals(originalBytes, Files.readAllBytes(campaignPath));
        try (Connection connection = open(campaignPath)) {
            assertEquals("untouched", scalarText(connection,
                    "SELECT name FROM saved_encounter_plans WHERE plan_id=7"));
            assertFalse(indexExists(connection, "idx_saved_encounter_plans_updated"));
        }
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected) throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(SqliteEncounterPlanRepository.storeDefinition());
            assertEquals(expected, database.prepareRegisteredStores().get("encounter"));
            FeatureStoreUnavailableException failure = assertThrows(
                    FeatureStoreUnavailableException.class, store::openConnection);
            assertEquals(expected, failure.readiness());
        }
    }

    private static void seedPartialShape(Path path, Integer version) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            if (version != null) {
                statement.execute("INSERT INTO sm_schema_versions(owner,version) "
                        + "VALUES('encounter'," + version + ")");
            }
            statement.execute("CREATE TABLE saved_encounter_plans "
                    + "(plan_id INTEGER PRIMARY KEY, development_name TEXT NOT NULL)");
            statement.execute("INSERT INTO saved_encounter_plans VALUES(7,'untouched')");
        }
    }

    private static Connection open(Path path) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
        }
        return connection;
    }

    private static List<String> foreignKeyTargets(Connection connection, String table) throws SQLException {
        List<String> targets = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_list(" + table + ")")) {
            while (result.next()) {
                targets.add(result.getString("table"));
            }
        }
        return List.copyOf(targets);
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        return objectExists(connection, "table", table);
    }

    private static boolean indexExists(Connection connection, String index) throws SQLException {
        return objectExists(connection, "index", index);
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

    private static boolean featureVersionExists(Connection connection) throws SQLException {
        if (!tableExists(connection, "sm_schema_versions")) {
            return false;
        }
        return scalarInt(connection,
                "SELECT COUNT(*) FROM sm_schema_versions WHERE owner='encounter'") > 0;
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
}
