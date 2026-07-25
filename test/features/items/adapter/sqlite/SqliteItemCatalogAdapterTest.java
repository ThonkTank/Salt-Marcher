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
import java.util.ArrayList;
import java.util.List;

class SqliteItemCatalogAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void usesSharedLifecycleForQueriesBackupAndAtomicTableReplacement() throws Exception {
        Path databasePath = temporaryDirectory.resolve("items.sqlite");
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
        try (Connection connection = open(databasePath)) {
            assertEquals(1, ownerVersion(connection));
            assertEquals(List.of(
                            "source_key", "name", "category", "subcategory", "magic", "rarity",
                            "attunement", "cost_cp", "cost_display", "weight", "damage",
                            "armor_class", "description", "source_version", "source_url"),
                    columns(connection, ItemsSchema.ENTRIES_TABLE));
        }
        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteItemCatalogAdapter adapter = preparedAdapter(reopened);
            assertTrue(adapter.isAvailable());
            assertEquals("Club", adapter.loadDetail("equipment:club").row().name());
        }
    }

    @Test
    void olderDevelopmentShapeFailsClosedAndDoesNotBlockCreatureProvider() throws Exception {
        Path databasePath = temporaryDirectory.resolve("older-development.db");
        seedOlderDevelopmentShape(databasePath);
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

    @Test
    void incompleteCurrentDevelopmentShapeFailsClosedWithoutMutation() throws Exception {
        Path databasePath = temporaryDirectory.resolve("incomplete-current.db");
        seedIncompleteCurrentShape(databasePath);
        String beforeSchema;
        try (Connection connection = open(databasePath)) {
            beforeSchema = tableSql(connection, ItemsSchema.ENTRIES_TABLE);
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("items"));
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(beforeSchema, tableSql(connection, ItemsSchema.ENTRIES_TABLE));
            assertFalse(tableExists(connection, ItemsSchema.TAGS_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void recordedCurrentShapeWithWeakenedCheckFailsClosedWithoutMutation() throws Exception {
        Path databasePath = temporaryDirectory.resolve("weakened-current-check.db");
        seedCurrentShape(databasePath, sql -> sql.replace(
                "magic INTEGER NOT NULL CHECK (magic IN (0, 1))",
                "magic INTEGER NOT NULL"));
        String beforeSchema;
        try (Connection connection = open(databasePath)) {
            beforeSchema = tableSql(connection, ItemsSchema.ENTRIES_TABLE);
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("items"));
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(beforeSchema, tableSql(connection, ItemsSchema.ENTRIES_TABLE));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void recordedCurrentShapeWithAdjacentOwnerTableFailsClosed() throws Exception {
        Path databasePath = temporaryDirectory.resolve("current-plus-adjacent-owner.db");
        seedCurrentShape(databasePath, java.util.function.UnaryOperator.identity());
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE items_catalog_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO items_catalog_retired VALUES('kept')");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("items"));
        }

        try (Connection connection = open(databasePath);
             var result = connection.createStatement()
                     .executeQuery("SELECT payload FROM items_catalog_retired")) {
            assertTrue(result.next());
            assertEquals("kept", result.getString(1));
            assertEquals(1, ownerVersion(connection));
        }
    }

    @Test
    void newerOwnerVersionReturnsIncompatibleThroughApplicationAndPreservesStoreExactly()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("items-owner-v2.db");
        seedCurrentShape(databasePath, java.util.function.UnaryOperator.identity());
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            statement.execute("UPDATE sm_schema_versions SET version=2 WHERE owner='items'");
            statement.execute("INSERT INTO items_catalog_entries("
                    + "source_key,name,category,subcategory,magic,rarity,attunement,cost_cp,"
                    + "cost_display,weight,damage,armor_class,description,source_version,source_url) "
                    + "VALUES('kept:item','Kept','Gear','',0,'',0,NULL,'',NULL,'','',"
                    + "'preserved','current','https://example.invalid/kept')");
        }
        byte[] before = java.nio.file.Files.readAllBytes(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            SqliteItemCatalogAdapter adapter = new SqliteItemCatalogAdapter(store);
            assertEquals(
                    FeatureStoreReadiness.NEWER_SCHEMA,
                    database.prepareRegisteredStores().get("items"));

            ItemsApplicationService application = new ItemsApplicationService(
                    adapter, DirectExecutionLane.INSTANCE, NoopDiagnostics.INSTANCE);
            assertEquals(
                    ItemsCatalogApi.CatalogStatus.INCOMPATIBLE,
                    application.search(ItemsCatalogApi.ItemQuery.firstPage())
                            .toCompletableFuture().join().status());
        }

        assertEquals(2, readOwnerVersionWithoutLifecycle(databasePath));
        assertTrue(rowExists(databasePath, "kept:item"));
        assertEquals(before.length, java.nio.file.Files.readAllBytes(databasePath).length);
        org.junit.jupiter.api.Assertions.assertArrayEquals(
                before, java.nio.file.Files.readAllBytes(databasePath));
        assertFalse(java.nio.file.Files.exists(
                databasePath.resolveSibling(databasePath.getFileName() + "-wal")));
        assertFalse(java.nio.file.Files.exists(
                databasePath.resolveSibling(databasePath.getFileName() + "-shm")));
        assertFalse(java.nio.file.Files.exists(
                databasePath.resolveSibling(databasePath.getFileName() + "-journal")));
    }

    @Test
    void unversionedPartialOwnerNamespaceFailsWithoutCreatingTablesOrLedgerEntry() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unversioned-partial-namespace.db");
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE VIEW items_catalog_unfinished AS SELECT 'kept' AS payload");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            database.featureStore(SqliteItemCatalogAdapter.storeDefinition());
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("items"));
        }

        try (Connection connection = open(databasePath)) {
            assertTrue(schemaObjectExists(connection, "view", "items_catalog_unfinished"));
            assertFalse(tableExists(connection, ItemsSchema.ENTRIES_TABLE));
            assertFalse(tableExists(connection, ItemsSchema.TAGS_TABLE));
            assertEquals(0, ownerVersion(connection));
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

    private static void seedOlderDevelopmentShape(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            statement.execute("CREATE TABLE items(id INTEGER PRIMARY KEY, note TEXT NOT NULL)");
            statement.execute("CREATE TABLE item_tags(item_id INTEGER, tag TEXT)");
            statement.execute("INSERT INTO items VALUES(1, 'kept')");
        }
    }

    private static void seedIncompleteCurrentShape(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            statement.execute("""
                    CREATE TABLE items_catalog_entries (
                        source_key TEXT PRIMARY KEY,
                        name TEXT NOT NULL
                    )
                    """);
        }
    }

    private static void seedCurrentShape(
            Path databasePath,
            java.util.function.UnaryOperator<String> tableSqlTransform
    ) throws Exception {
        try (Connection connection = open(databasePath); var statement = connection.createStatement()) {
            createLedger(statement);
            for (String sql : ItemsSchema.CREATE_TABLE_SQL) {
                statement.execute(tableSqlTransform.apply(sql));
            }
            for (String sql : ItemsSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
        }
    }

    private static void createLedger(java.sql.Statement statement) throws Exception {
        TestFeatureStores.createCurrentPlatformLedger(statement);
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

    private static boolean schemaObjectExists(Connection connection, String type, String name) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
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
        if (!tableExists(connection, "sm_schema_versions")) {
            return 0;
        }
        try (var result = connection.createStatement().executeQuery(
                "SELECT version FROM sm_schema_versions WHERE owner='items'")) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static int readOwnerVersionWithoutLifecycle(Path databasePath) throws Exception {
        try (Connection connection = open(databasePath)) {
            return ownerVersion(connection);
        }
    }

    private static boolean rowExists(Path databasePath, String sourceKey) throws Exception {
        try (Connection connection = open(databasePath);
             var statement = connection.prepareStatement(
                     "SELECT 1 FROM items_catalog_entries WHERE source_key=?")) {
            statement.setString(1, sourceKey);
            try (var result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static List<String> columns(Connection connection, String table) throws Exception {
        List<String> names = new ArrayList<>();
        try (var result = connection.createStatement().executeQuery("PRAGMA table_info(" + table + ")")) {
            while (result.next()) {
                names.add(result.getString("name"));
            }
        }
        return List.copyOf(names);
    }
}
