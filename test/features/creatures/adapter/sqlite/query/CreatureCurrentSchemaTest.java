package features.creatures.adapter.sqlite.query;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSearchSpec;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;

final class CreatureCurrentSchemaTest {

    @TempDir
    Path directory;

    @Test
    void freshOwnerCreatesOneExactCurrentTargetAtVersionOne() throws Exception {
        Path path = directory.resolve("creatures-current.db");
        var definition = CreaturesServiceAssembly.storeDefinition();

        assertEquals(1, definition.migrations().size());
        assertEquals(1, definition.migrations().getFirst().version());

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(definition);
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get("creatures"));
            try (Connection connection = store.openConnection()) {
                assertEquals(1, featureVersion(connection));
                assertTrue(objectExists(connection, "table", "creatures"));
                assertTrue(objectExists(connection, "table", "creature_actions"));
                assertTrue(objectExists(connection, "index", "idx_creatures_name"));
                assertTrue(objectExists(
                        connection, "index", "idx_creature_actions_creature"));
            }
        }
    }

    @Test
    void currentRowsRemainReadableAfterRestart() throws Exception {
        Path path = directory.resolve("creatures-restart.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get("creatures"));
            try (Connection connection = store.openConnection();
                 Statement statement = connection.createStatement()) {
                statement.execute("INSERT INTO creatures(id,name,size,creature_type,alignment,cr,xp,hp,ac) "
                        + "VALUES(101,'Current Beast','Large','monstrosity','neutral','5',1800,80,15)");
                statement.execute(
                        "INSERT INTO creature_biomes(creature_id,biome) VALUES(101,'cavern')");
                statement.execute(
                        "INSERT INTO creature_subtypes(creature_id,subtype) VALUES(101,'ancient')");
                statement.execute("INSERT INTO creature_actions("
                        + "creature_id,action_type,name,description,to_hit_bonus) "
                        + "VALUES(101,'action','Claw','A current action.',7)");
            }
        }

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get("creatures"));
            var adapter = new SqliteCreatureCatalogQueryAdapter(store);
            var page = adapter.searchCatalog(new CatalogSearchSpec(
                    "Current Beast", null, null, List.of(), List.of(), List.of(), List.of(),
                    List.of(), "NAME", true, 25, 0));
            assertEquals(1, page.totalCount());
            assertEquals(101L, page.rows().getFirst().id());
            var detail = adapter.loadCreatureDetail(101L);
            assertNotNull(detail);
            assertEquals(List.of("cavern"), detail.biomes());
            assertEquals(List.of("ancient"), detail.subtypes());
            assertEquals("Claw", detail.actions().getFirst().name());
        }
    }

    @Test
    void unversionedDevelopmentShapeFailsWithoutRepairOrLedgerFabrication() throws Exception {
        Path path = directory.resolve("creatures-unversioned.db");
        seedPartialShape(path, null);

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM creatures WHERE id=7"));
            assertFalse(objectExists(connection, "table", "creature_actions"));
            assertFalse(featureVersionExists(connection));
        }
    }

    @Test
    void newerDevelopmentShapeFailsWithoutDowngradeOrMutation() throws Exception {
        Path path = directory.resolve("creatures-newer.db");
        seedPartialShape(path, Integer.valueOf(2));

        assertUnavailable(path, FeatureStoreReadiness.NEWER_SCHEMA);

        try (Connection connection = open(path)) {
            assertEquals(2, featureVersion(connection));
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM creatures WHERE id=7"));
            assertFalse(objectExists(connection, "table", "creature_actions"));
        }
    }

    @Test
    void malformedRecordedVersionOneFailsWithoutAddingMissingSchema() throws Exception {
        Path path = directory.resolve("creatures-malformed-v1.db");
        seedPartialShape(path, Integer.valueOf(1));

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(2, columnCount(connection, "creatures"));
            assertEquals("untouched", scalarText(connection,
                    "SELECT development_name FROM creatures WHERE id=7"));
            assertFalse(objectExists(connection, "index", "idx_creatures_name"));
        }
    }

    @Test
    void recordedVersionOneWithProviderSupersetFailsExactValidationWithoutRewritingIt()
            throws Exception {
        Path path = directory.resolve("creatures-provider-superset.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());
            assertEquals(FeatureStoreReadiness.READY,
                    database.prepareRegisteredStores().get("creatures"));
            try (Connection connection = store.openConnection();
                 Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE creatures ADD COLUMN provider_payload TEXT");
                statement.execute("INSERT INTO creatures(id,name,provider_payload) "
                        + "VALUES(9,'Provider row','untouched')");
            }
        }

        assertUnavailable(path, FeatureStoreReadiness.MIGRATION_FAILED);

        try (Connection connection = open(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals("untouched", scalarText(connection,
                    "SELECT provider_payload FROM creatures WHERE id=9"));
        }
    }

    private static void assertUnavailable(Path path, FeatureStoreReadiness expected)
            throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(CreaturesServiceAssembly.storeDefinition());
            assertEquals(expected, database.prepareRegisteredStores().get("creatures"));
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
                        + "VALUES('creatures'," + version + ")");
            }
            statement.execute("CREATE TABLE creatures "
                    + "(id INTEGER PRIMARY KEY, development_name TEXT NOT NULL)");
            statement.execute("INSERT INTO creatures VALUES(7,'untouched')");
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
                     "SELECT 1 FROM sm_schema_versions WHERE owner='creatures'")) {
            return result.next();
        }
    }

    private static int featureVersion(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner='creatures'")) {
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
