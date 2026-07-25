package features.campaign.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.CampaignFeature;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;

final class CampaignRegistryCurrentSchemaTest {

    @TempDir
    Path directory;

    @Test
    void freshOwnerCreatesOneExactCurrentTargetAtVersionOne() throws Exception {
        Path path = directory.resolve("campaign-registry-current.db");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE unrelated_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO unrelated_guard VALUES('kept')");
        }
        var definition = CampaignFeature.storeDefinition();

        assertEquals(1, definition.migrations().size());
        assertEquals(1, definition.migrations().getFirst().version());

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(definition);
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get(CampaignRegistrySchema.OWNER));
            try (Connection connection = store.openConnection()) {
                assertEquals(1, featureVersion(connection));
                assertTrue(objectExists(
                        connection, "table", "campaign_registry_campaigns"));
                assertTrue(objectExists(
                        connection, "table", "campaign_registry_activation"));
                assertEquals("kept", scalarText(
                        connection, "SELECT payload FROM unrelated_guard"));
            }
        }
    }

    @Test
    void unversionedDevelopmentShapeFailsWithoutRepairOrLedgerFabrication() throws Exception {
        Path path = directory.resolve("campaign-registry-unversioned.db");
        seedPartialShape(path, null);

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM campaign_registry_campaigns "
                            + "WHERE campaign_id='alpha'"));
            assertFalse(objectExists(
                    connection, "table", "campaign_registry_activation"));
            assertFalse(featureVersionExists(connection));
        }
    }

    @Test
    void newerDevelopmentShapeFailsWithoutDowngradeOrMutation() throws Exception {
        Path path = directory.resolve("campaign-registry-newer.db");
        seedPartialShape(path, Integer.valueOf(2));

        assertUnavailable(path, FeatureStoreReadiness.NEWER_SCHEMA);

        try (Connection connection = open(path)) {
            assertEquals(2, featureVersion(connection));
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM campaign_registry_campaigns "
                            + "WHERE campaign_id='alpha'"));
            assertFalse(objectExists(
                    connection, "table", "campaign_registry_activation"));
        }
    }

    @Test
    void malformedRecordedVersionOneFailsWithoutAddingMissingSchema() throws Exception {
        Path path = directory.resolve("campaign-registry-malformed-v1.db");
        seedPartialShape(path, Integer.valueOf(1));

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(2, columnCount(connection, "campaign_registry_campaigns"));
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM campaign_registry_campaigns "
                            + "WHERE campaign_id='alpha'"));
            assertFalse(objectExists(
                    connection, "table", "campaign_registry_activation"));
        }
    }

    @Test
    void adjacentRecordedOwnerObjectFailsExactInventoryWithoutDroppingIt() throws Exception {
        Path path = directory.resolve("campaign-registry-adjacent-object.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CampaignFeature.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get(CampaignRegistrySchema.OWNER));
            try (Connection connection = store.openConnection();
                 Statement statement = connection.createStatement()) {
                statement.execute("CREATE TABLE campaign_registry_retired(payload TEXT NOT NULL)");
                statement.execute("INSERT INTO campaign_registry_retired VALUES('untouched')");
            }
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals("untouched", scalarText(
                    connection, "SELECT payload FROM campaign_registry_retired"));
        }
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected)
            throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CampaignFeature.storeDefinition());
            assertEquals(expected,
                    database.prepareRegisteredStores().get(CampaignRegistrySchema.OWNER));
            var failure = assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
            assertEquals(expected, failure.readiness());
        }
    }

    private static void seedPartialShape(Path path, Integer version) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            if (version != null) {
                statement.execute("INSERT INTO sm_schema_versions(owner,version) "
                        + "VALUES('campaign-registry'," + version + ")");
            }
            statement.execute("CREATE TABLE campaign_registry_campaigns "
                    + "(campaign_id TEXT PRIMARY KEY, development_name TEXT NOT NULL)");
            statement.execute(
                    "INSERT INTO campaign_registry_campaigns VALUES('alpha','untouched')");
        }
    }

    private static Connection open(Path path) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }

    private static boolean featureVersionExists(Connection connection) throws SQLException {
        if (!objectExists(connection, "table", "sm_schema_versions")) {
            return false;
        }
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT 1 FROM sm_schema_versions WHERE owner='campaign-registry'")) {
            return result.next();
        }
    }

    private static int featureVersion(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner='campaign-registry'")) {
            assertTrue(result.next());
            return result.getInt(1);
        }
    }

    private static boolean objectExists(Connection connection, String type, String name)
            throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static int columnCount(Connection connection, String table) throws SQLException {
        int count = 0;
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                count++;
            }
        }
        return count;
    }

    private static String scalarText(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }
}
