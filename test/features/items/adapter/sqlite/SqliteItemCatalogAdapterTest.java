package features.items.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.items.api.ItemsCatalogApi;
import features.items.application.ItemsApplicationService;
import features.items.domain.catalog.ItemCatalogAccessException;
import features.items.domain.catalog.ItemCatalogData;
import features.items.domain.importing.ImportedItem;
import features.items.domain.importing.ItemImportBatch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;

class SqliteItemCatalogAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void usesSharedLifecycleForQueriesBackupAndAtomicTableReplacement() {
        Path databasePath = temporaryDirectory.resolve("game.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = TestFeatureStores.store(database, SqliteItemCatalogAdapter.storeDefinition());
            SqliteItemCatalogAdapter adapter = new SqliteItemCatalogAdapter(store);
            SqliteItemImportStore importer =
                    new SqliteItemImportStore(database.maintenanceFor(store));
            assertFalse(adapter.isAvailable());

            importer.initialize();
            assertNotNull(importer.createVerifiedBackup().createdAt());
            importer.replaceAll(validBatch(List.of("Light")));

            assertTrue(adapter.isAvailable());
            ItemCatalogData.CatalogPage page = adapter.search(new ItemCatalogData.SearchSpec(
                    "club", "Weapon", "Simple", null, false, null, 0, 100,
                    ItemCatalogData.SortField.COST, false, 50, 0));
            assertEquals(1, page.totalCount());
            assertEquals("Club", page.rows().getFirst().name());
            assertEquals("Light", adapter.loadDetail("equipment:club").properties().getFirst());
            assertEquals(List.of("Adventuring Gear", "Weapon"),
                    adapter.loadFilterValues().categories());

            assertThrows(IllegalStateException.class,
                    () -> importer.replaceAll(validBatch(List.of("Duplicate", "Duplicate"))));
            assertEquals("Club", adapter.loadDetail("equipment:club").row().name());
            assertEquals(2, adapter.search(new ItemCatalogData.SearchSpec(
                    null, null, null, null, null, null, null, null,
                    ItemCatalogData.SortField.NAME, true, 50, 0)).totalCount());
        }
    }

    @Test
    void migratesLegacyNumericShapeAndRetainsIdentityDetailsTagsAndProvenance() throws Exception {
        Path databasePath = temporaryDirectory.resolve("legacy.db");
        seedLegacy(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = preparedAdapter(database);
            assertEquals(FeatureStoreReadiness.READY, database.prepareRegisteredStores().get("items"));

            ItemCatalogData.Detail detail = adapter.loadDetail("legacy:moon-blade");
            assertNotNull(detail);
            assertEquals("Moon Blade", detail.row().name());
            assertTrue(detail.row().magic());
            assertEquals("25 gp", detail.row().costDisplay());
            assertEquals(List.of("Finesse", "Silvered"), detail.properties());
            assertEquals("Legacy SRD", detail.sourceVersion());
            assertEquals("", detail.sourceUrl());
            ItemCatalogData.Detail unattributed = adapter.loadDetail("legacy:plain-rope");
            assertNotNull(unattributed);
            assertEquals("", unattributed.sourceVersion());
            assertEquals("", unattributed.sourceUrl());
        }

        try (Connection connection = open(databasePath)) {
            assertFalse(tableExists(connection, "items"));
            assertFalse(tableExists(connection, "item_tags"));
            assertTrue(tableExists(connection, ItemsSchema.ENTRIES_TABLE));
            assertEquals(2, ownerVersion(connection));
            try (var result = connection.createStatement().executeQuery("""
                    SELECT legacy_id, attunement_condition, source_properties_text, source_tags_text
                    FROM items_catalog_entries WHERE source_key='legacy:moon-blade'
                    """)) {
                assertTrue(result.next());
                assertEquals(7L, result.getLong("legacy_id"));
                assertEquals("by a good creature", result.getString("attunement_condition"));
                assertEquals("Finesse, Silvered", result.getString("source_properties_text"));
                assertEquals("legacy-tag-text", result.getString("source_tags_text"));
            }
        }

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = preparedAdapter(reopened);
            assertEquals("Moon Blade", adapter.loadDetail("legacy:moon-blade").row().name());
        }
        try (Connection connection = open(databasePath)) {
            assertEquals(2, ownerVersion(connection));
            assertEquals(2, count(connection, "SELECT COUNT(*) FROM items_catalog_entries"));
            assertEquals(2, count(connection, "SELECT COUNT(*) FROM items_catalog_tags"));
        }
    }

    @Test
    void migratesIntermediateSourceKeyShapeExactlyOnce() throws Exception {
        Path databasePath = temporaryDirectory.resolve("intermediate.db");
        seedIntermediate(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = preparedAdapter(database);
            ItemCatalogData.Detail detail = adapter.loadDetail("equipment:shield");
            assertNotNull(detail);
            assertEquals("Shield", detail.row().name());
            assertEquals(List.of("Armor"), detail.properties());
            assertEquals("2014 SRD", detail.sourceVersion());
            assertEquals("https://example.invalid/shield", detail.sourceUrl());
        }

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = preparedAdapter(reopened);
            assertEquals(1, adapter.search(new ItemCatalogData.SearchSpec(
                    null, null, null, null, null, null, null, null,
                    ItemCatalogData.SortField.NAME, true, 50, 0)).totalCount());
        }
        try (Connection connection = open(databasePath)) {
            assertEquals(2, ownerVersion(connection));
            assertFalse(tableExists(connection, "items"));
            assertEquals(1, count(connection, "SELECT COUNT(*) FROM items_catalog_entries"));
        }
    }

    @Test
    void unknownSignatureRollsBackAndDoesNotBlockCreatureProvider() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unknown.db");
        seedUnknown(databasePath);
        String beforeSchema;
        try (Connection connection = open(databasePath)) {
            beforeSchema = tableSql(connection, "items");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var itemsStore = database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            var creaturesStore =
                    database.featureStore(SqliteCreatureCatalogQueryAdapter.storeDefinition());
            SqliteItemCatalogAdapter items = new SqliteItemCatalogAdapter(itemsStore);
            SqliteCreatureCatalogQueryAdapter creatures = new SqliteCreatureCatalogQueryAdapter(creaturesStore);

            var readiness = database.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("items"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("creatures"));
            assertTrue(creatures.loadFilterValues().types().isEmpty());
            ItemCatalogAccessException failure = assertThrows(
                    ItemCatalogAccessException.class,
                    items::isAvailable);
            assertEquals(ItemCatalogAccessException.Reason.INCOMPATIBLE, failure.reason());

            ItemsApplicationService application = new ItemsApplicationService(
                    items,
                    DirectExecutionLane.INSTANCE,
                    NoopDiagnostics.INSTANCE);
            assertEquals(
                    ItemsCatalogApi.CatalogStatus.INCOMPATIBLE,
                    application.search(ItemsCatalogApi.ItemQuery.firstPage())
                            .toCompletableFuture().join().status());
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(beforeSchema, tableSql(connection, "items"));
            try (var result = connection.createStatement()
                    .executeQuery("SELECT note FROM items WHERE id=1")) {
                assertTrue(result.next());
                assertEquals("kept", result.getString(1));
            }
            assertFalse(tableExists(connection, ItemsSchema.ENTRIES_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    private static ItemImportBatch validBatch(List<String> equipmentProperties) {
        return new ItemImportBatch(List.of(
                new ImportedItem(
                        "equipment:club", "Club", "Weapon", "Simple", false, "", false,
                        10, "1 sp", 2.0, "1d4 Bludgeoning", "", equipmentProperties,
                        "A wooden club.", "2014 SRD",
                        "https://www.dnd5eapi.co/api/2014/equipment/club"),
                new ImportedItem(
                        "magic-item:ring", "Ring", "Adventuring Gear", "Magic Item", true,
                        "Rare", true, null, "", null, "", "", List.of(),
                        "Requires attunement.", "2014 SRD",
                        "https://www.dnd5eapi.co/api/2014/magic-items/ring")));
    }

    private static SqliteItemCatalogAdapter preparedAdapter(SqliteDatabase database) {
        var store = TestFeatureStores.store(database, SqliteItemCatalogAdapter.storeDefinition());
        return new SqliteItemCatalogAdapter(store);
    }

    private static void seedLegacy(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            statement.execute("""
                    CREATE TABLE items (
                        id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT, category TEXT,
                        subcategory TEXT, is_magic INTEGER DEFAULT 0, rarity TEXT,
                        requires_attunement INTEGER DEFAULT 0, attunement_condition TEXT,
                        cost TEXT, cost_cp INTEGER DEFAULT 0, weight REAL DEFAULT 0.0,
                        damage TEXT, properties TEXT, armor_class TEXT, description TEXT,
                        source TEXT, tags TEXT DEFAULT '')
                    """);
            statement.execute("""
                    CREATE TABLE item_tags (
                        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                        tag TEXT NOT NULL, PRIMARY KEY (item_id, tag))
                    """);
            statement.execute("""
                    INSERT INTO items VALUES(
                        7, 'Moon Blade', 'moon-blade', 'Weapon', 'Sword', 1, 'Rare', 1,
                        'by a good creature', '25 gp', 2500, 3.0, '1d8', 'Finesse, Silvered', '',
                        'A pale blade.', 'Legacy SRD', 'legacy-tag-text')
                    """);
            statement.execute("""
                    INSERT INTO items VALUES(
                        8, 'Plain Rope', 'plain-rope', 'Gear', NULL, 0, NULL, 0,
                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
                    """);
            statement.execute("INSERT INTO item_tags VALUES(7, 'Finesse')");
            statement.execute("INSERT INTO item_tags VALUES(7, 'Silvered')");
        }
    }

    private static void seedIntermediate(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            statement.execute("""
                    CREATE TABLE items (
                        source_key TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
                        subcategory TEXT NOT NULL DEFAULT '', magic INTEGER NOT NULL,
                        rarity TEXT NOT NULL DEFAULT '', attunement INTEGER NOT NULL, cost_cp INTEGER,
                        cost_display TEXT NOT NULL DEFAULT '', weight REAL, damage TEXT NOT NULL DEFAULT '',
                        armor_class TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
                        source_version TEXT NOT NULL, source_url TEXT NOT NULL)
                    """);
            statement.execute("""
                    CREATE TABLE item_tags (
                        item_source_key TEXT NOT NULL REFERENCES items(source_key) ON DELETE CASCADE,
                        tag TEXT NOT NULL, PRIMARY KEY (item_source_key, tag))
                    """);
            statement.execute("""
                    INSERT INTO items VALUES(
                        'equipment:shield', 'Shield', 'Armor', 'Shield', 0, '', 0, 1000,
                        '10 gp', 6.0, '', 'AC 2', 'A shield.', '2014 SRD',
                        'https://example.invalid/shield')
                    """);
            statement.execute("INSERT INTO item_tags VALUES('equipment:shield', 'Armor')");
        }
    }

    private static void seedUnknown(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            statement.execute("CREATE TABLE items(id INTEGER PRIMARY KEY, note TEXT NOT NULL)");
            statement.execute("CREATE TABLE item_tags(item_id INTEGER, tag TEXT)");
            statement.execute("INSERT INTO items VALUES(1, 'kept')");
        }
    }

    private static void createLedger(java.sql.Statement statement) throws Exception {
        statement.execute("PRAGMA user_version=1");
        statement.execute(
                "CREATE TABLE sm_schema_versions(owner TEXT PRIMARY KEY, version INTEGER NOT"
                    + " NULL)");
        statement.execute("INSERT INTO sm_schema_versions VALUES('items', 1)");
    }

    private static Connection open(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        connection.createStatement().execute("PRAGMA foreign_keys=ON");
        return connection;
    }

    private static boolean tableExists(Connection connection, String table) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static String tableSql(Connection connection, String table) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (var result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : "";
            }
        }
    }

    private static int ownerVersion(Connection connection) throws Exception {
        try (var result = connection.createStatement().executeQuery(
                "SELECT version FROM sm_schema_versions WHERE owner='items'")) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static int count(Connection connection, String sql) throws Exception {
        try (var result = connection.createStatement().executeQuery(sql)) {
            return result.next() ? result.getInt(1) : 0;
        }
    }
}
