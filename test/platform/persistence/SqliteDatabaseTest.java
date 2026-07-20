package platform.persistence;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

final class SqliteDatabaseTest {

    private static final byte[] ROLLBACK_JOURNAL_MAGIC = {
            (byte) 0xd9, (byte) 0xd5, 0x05, (byte) 0xf9, 0x20, (byte) 0xa1, 0x63, (byte) 0xd7
    };
    private static final byte[] UNCOMMITTED_MARKER =
            "UNCOMMITTED-ON-DISK-MARKER".getBytes(StandardCharsets.UTF_8);

    @TempDir
    Path temporaryDirectory;

    @Test
    void preservesXdgAndFallbackDatabaseLocations() {
        assertEquals(
                Path.of("/tmp/xdg", "salt-marcher", "game.db"),
                SqliteDatabase.resolveDatabasePath("game.db", "/tmp/xdg", "/home/test"));
        assertEquals(
                Path.of("/home/test", ".local", "share", "salt-marcher", "game.db"),
                SqliteDatabase.resolveDatabasePath("game.db", "", "/home/test"));
    }

    @Test
    void createsVerifiedOwnerOnlySnapshotWithoutMigratingTheSource() throws Exception {
        Path source = temporaryDirectory.resolve("source.db");
        Path target = temporaryDirectory.resolve("snapshots").resolve("copy.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + source)) {
            try (var statement = connection.createStatement()) {
                statement.execute("PRAGMA journal_mode = WAL");
                statement.execute("CREATE TABLE source_rows(id INTEGER PRIMARY KEY, value TEXT)");
                statement.execute("INSERT INTO source_rows VALUES(1, 'preserved')");
            }

            SqliteDatabase.createVerifiedSnapshot(source, target);
        }

        assertTrue(Files.isRegularFile(target));
        assertEquals(
                java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"),
                Files.getPosixFilePermissions(target));
        try (var snapshot = DriverManager.getConnection("jdbc:sqlite:" + target);
             var result = snapshot.createStatement()
                     .executeQuery("SELECT value FROM source_rows WHERE id=1")) {
            assertTrue(result.next());
            assertEquals("preserved", result.getString(1));
        }
        assertThrows(SQLException.class, () -> SqliteDatabase.createVerifiedSnapshot(source, target));
    }

    @Test
    void unpreparedHandleFailsClosedWithoutCreatingOrMigratingTheDatabase() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unprepared.db");
        AtomicInteger migrations = new AtomicInteger();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> {})) {
            FeatureStoreHandle handle =
                    database.featureStore(
                            definition(
                                    "unprepared",
                                    new SqliteMigration(
                                            1, connection -> migrations.incrementAndGet())));

            assertThrows(FeatureStoreNotPreparedException.class, handle::openConnection);
            FeatureStoreMaintenance maintenance = database.maintenanceFor(handle);
            assertFalse(FeatureStoreMaintenance.class.isAssignableFrom(handle.getClass()));
            assertThrows(FeatureStoreNotPreparedException.class, maintenance::createVerifiedBackup);
            assertEquals(0, migrations.get());
            assertFalse(Files.exists(databasePath));
        }
    }

    @Test
    void duplicateOwnerRegistrationIsRejectedEvenAtTheSameVersion() {
        try (SqliteDatabase database =
                new SqliteDatabase(
                        temporaryDirectory.resolve("duplicate-owner.db"), (id, type) -> {})) {
            database.featureStore(
                    definition(
                            "duplicate", new SqliteMigration(1, connection -> {})));

            assertThrows(
                    IllegalArgumentException.class,
                    () ->
                            database.featureStore(
                                    FeatureStoreDefinition.validated(
                                            "duplicate",
                                            connection ->
                                                    connection
                                                            .createStatement()
                                                            .execute("SELECT 1"),
                                            new SqliteMigration(
                                                    1,
                                                    connection ->
                                                            connection
                                                                    .createStatement()
                                                                    .execute(
                                                                            "CREATE TABLE"
                                                                                + " changed(id"
                                                                                + " INTEGER)")))));
        }
    }

    @Test
    void configuresConnectionsAndRunsVersionedMigrationExactlyOnce() throws Exception {
        Path databasePath = temporaryDirectory.resolve("game.db");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        AtomicInteger migrations = new AtomicInteger();
        SqliteMigration migration = new SqliteMigration(1, connection -> {
            migrations.incrementAndGet();
            connection.createStatement().execute(
                                            "CREATE TABLE owned_data(id INTEGER PRIMARY KEY, value"
                                                + " TEXT)");
        });
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);
        FeatureStoreHandle source = TestFeatureStores.store(database, "test-feature", migration);

        try (var connection = source.openConnection()) {
            assertEquals(1, pragmaInt(connection, "PRAGMA foreign_keys"));
            assertEquals(5_000, pragmaInt(connection, "PRAGMA busy_timeout"));
            assertEquals("wal", pragmaText(connection, "PRAGMA journal_mode"));
            connection.createStatement().execute("INSERT INTO owned_data(id, value) VALUES(1, 'kept')");
        }
        try (var ignored = source.openConnection()) {
            assertEquals(1, migrations.get());
        }
        database.close();

        assertThrows(SQLException.class, source::openConnection);
        assertTrue(diagnostics.ids.isEmpty());
    }

    @Test
    void concurrentConnectionInitializationSerializesMigrationMetadataWithoutSerializingUse() throws Exception {
        Path databasePath = temporaryDirectory.resolve("concurrent-open.db");
        AtomicInteger migrations = new AtomicInteger();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
                var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            FeatureStoreHandle source =
                    TestFeatureStores.store(
                            database,
                            "concurrent", new SqliteMigration(1, connection -> {
                migrations.incrementAndGet();
                connection.createStatement().execute(
                                                        "CREATE TABLE concurrent_rows(id INTEGER"
                                                            + " PRIMARY KEY, value TEXT NOT NULL)");
            }));
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            List<java.util.concurrent.Future<Void>> opened = new ArrayList<>();
            for (int id = 1; id <= 2; id++) {
                int rowId = id;
                opened.add(workers.submit(() -> {
                    ready.countDown();
                    start.await();
                    try (var connection = source.openConnection();
                            var statement = connection.prepareStatement(
                                                            "INSERT INTO concurrent_rows(id, value)"
                                                                + " VALUES(?, ?)")) {
                        statement.setInt(1, rowId);
                        statement.setString(2, "row-" + rowId);
                        statement.executeUpdate();
                    }
                    return null;
                }));
            }
            ready.await();
            start.countDown();
            for (var openedConnection : opened) {
                openedConnection.get();
            }
            assertEquals(1, migrations.get());
            try (var connection = source.openConnection();
                    var rows = connection.createStatement().executeQuery("SELECT COUNT(*) FROM concurrent_rows")) {
                assertTrue(rows.next());
                assertEquals(2, rows.getInt(1));
            }
        }
    }

    @Test
    void maintenanceBackupIsIntegrityCheckedAndRestoreTestedBeforePublication() throws Exception {
        Path databasePath = temporaryDirectory.resolve("maintenance.db");
        SqliteMigration migration = seedMigration();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle store = TestFeatureStores.store(database, "seed", migration);
            try (var connection = store.openConnection()) {
                connection
                        .createStatement()
                        .execute("INSERT INTO recovery_data(id, value) VALUES(1, 'recoverable')");
            }
            FeatureStoreBackup receipt = database.maintenanceFor(store).createVerifiedBackup();
            assertEquals("seed", receipt.owner());
        }

        Path backup;
        try (var files = Files.list(temporaryDirectory)) {
            backup = files.filter(path -> path.getFileName().toString()
                            .startsWith("maintenance.db.maintenance-seed-"))
                    .findFirst()
                    .orElseThrow();
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup)) {
            assertEquals("recoverable", storedValue(connection));
            assertEquals("ok", pragmaText(connection, "PRAGMA integrity_check"));
        }
        try (var files = Files.walk(temporaryDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString().equals("restore-probe.db")));
        }
    }

    @Test
    void newerOwnerAloneDoesNotCreateBackupButOtherPendingOwnerDoes() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-isolation.db");
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, (id, type) -> { })) {
            initial.featureStore(definition(
                    "future-owner",
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                            "CREATE TABLE future_rows(id INTEGER"
                                                                + " PRIMARY KEY)")),
                    new SqliteMigration(2, connection -> connection.createStatement().execute(
                                                            "ALTER TABLE future_rows ADD COLUMN"
                                                                + " label TEXT"))));
            initial.featureStore(definition(
                    "healthy-owner",
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                            "CREATE TABLE healthy_rows(id INTEGER"
                                                                + " PRIMARY KEY)"))));
            assertEquals(
                    FeatureStoreReadiness.READY,
                    initial.prepareRegisteredStores().get("future-owner"));
        }

        try (SqliteDatabase current = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle future = current.featureStore(definition(
                    "future-owner",
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                                    "CREATE TABLE future_rows(id"
                                                                        + " INTEGER PRIMARY"
                                                                        + " KEY)"))));
            FeatureStoreHandle healthy = current.featureStore(definition(
                    "healthy-owner",
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                                    "CREATE TABLE healthy_rows(id"
                                                                        + " INTEGER PRIMARY"
                                                                        + " KEY)"))));

            var readiness = current.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, readiness.get("future-owner"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("healthy-owner"));
            assertFalse(Files.exists(backup));
            FeatureStoreUnavailableException unavailable = assertThrows(
                    FeatureStoreUnavailableException.class,
                    future::openConnection);
            assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, unavailable.readiness());
            try (var connection = healthy.openConnection()) {
                connection.createStatement().execute("INSERT INTO healthy_rows(id) VALUES(1)");
            }
        }

        try (SqliteDatabase pending = new SqliteDatabase(databasePath, (id, type) -> { })) {
            var stores = TestFeatureStores.stores(
                    pending,
                    definition(
                            "future-owner",
                            new SqliteMigration(1, connection -> connection.createStatement().execute(
                                    "CREATE TABLE future_rows(id INTEGER PRIMARY KEY)"))),
                    definition(
                            "healthy-owner",
                            new SqliteMigration(1, connection -> connection.createStatement().execute(
                                    "CREATE TABLE healthy_rows(id INTEGER PRIMARY KEY)"))),
                    definition(
                            "pending-owner",
                            new SqliteMigration(1, connection -> connection.createStatement().execute(
                                    "CREATE TABLE pending_rows(id INTEGER PRIMARY KEY)"))));

            assertThrows(FeatureStoreUnavailableException.class,
                    stores.get("future-owner")::openConnection);
            try (var connection = stores.get("pending-owner").openConnection()) {
                connection.createStatement().execute("INSERT INTO pending_rows(id) VALUES(1)");
            }
            assertTrue(Files.isRegularFile(backup));
        }
    }

    @Test
    void fullyCurrentStartupDoesNotCreateOrReplaceRecoveryBackup() throws Exception {
        Path withoutBackup = temporaryDirectory.resolve("current-without-backup.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(withoutBackup, migration);
        Path absent = withoutBackup.resolveSibling(
                withoutBackup.getFileName() + ".backup-v1.sqlite");

        try (SqliteDatabase current = new SqliteDatabase(withoutBackup, (id, type) -> { });
             var ignored = TestFeatureStores.store(current, "seed", migration).openConnection()) {
            assertFalse(Files.exists(absent));
        }
        assertFalse(Files.exists(absent));

        Path withBackup = temporaryDirectory.resolve("current-with-backup.db");
        createSeedDatabase(withBackup, migration);
        createPendingMigrationBackup(withBackup, migration);
        Path existing = withBackup.resolveSibling(
                withBackup.getFileName() + ".backup-v1.sqlite");
        byte[] backupBeforeCurrentStartup = Files.readAllBytes(existing);

        try (SqliteDatabase current = new SqliteDatabase(withBackup, (id, type) -> { })) {
            TestFeatureStores.stores(
                    current,
                    definition("seed", migration),
                    backupTriggerDefinition());
        }

        assertArrayEquals(backupBeforeCurrentStartup, Files.readAllBytes(existing));
        try (var files = Files.list(temporaryDirectory)) {
            assertEquals(1L, files.filter(path -> path.getFileName().toString()
                    .startsWith("current-with-backup.db.backup-v")).count());
        }
    }

    @Test
    void pendingPlatformMetadataUpgradeCreatesPreMigrationBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("platform-upgrade.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute(
                    "CREATE TABLE legacy_rows(id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
            connection.createStatement().execute(
                    "INSERT INTO legacy_rows(id, value) VALUES(1, 'preserved')");
        }
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v0.sqlite");

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
             var ignored = TestFeatureStores.store(
                     database, FeatureStoreDefinition.of("metadata-owner")).openConnection()) {
            assertTrue(Files.isRegularFile(backup));
            assertEquals(1, pragmaInt(ignored, "PRAGMA user_version"));
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup)) {
            assertEquals(0, pragmaInt(connection, "PRAGMA user_version"));
            try (var row = connection.createStatement().executeQuery(
                    "SELECT value FROM legacy_rows WHERE id=1")) {
                assertTrue(row.next());
                assertEquals("preserved", row.getString(1));
            }
        }
    }

    @Test
    void failedOwnerRollsBackAndLeavesOtherPreparedOwnerUsable() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-failure-isolation.db");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics)) {
            FeatureStoreHandle broken = database.featureStore(FeatureStoreDefinition.validated(
                    "broken-owner",
                    connection -> {
                        throw new SQLException("private payload");
                    },
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                                    "CREATE TABLE partial_rows(id"
                                                                        + " INTEGER)"))));
            FeatureStoreHandle healthy = database.featureStore(definition(
                    "healthy-owner",
                    new SqliteMigration(1, connection -> connection.createStatement().execute(
                                                                    "CREATE TABLE complete_rows(id"
                                                                        + " INTEGER PRIMARY"
                                                                        + " KEY)"))));

            var readiness = database.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("broken-owner"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("healthy-owner"));
            assertThrows(FeatureStoreUnavailableException.class, broken::openConnection);
            try (var connection = healthy.openConnection();
                    var partial = connection.prepareStatement(
                                    "SELECT name FROM sqlite_master WHERE type='table' AND"
                                        + " name='partial_rows'");
                    var partialResult = partial.executeQuery()) {
                assertFalse(partialResult.next());
                connection.createStatement().execute("INSERT INTO complete_rows(id) VALUES(1)");
            }
        }
        assertEquals(List.of("persistence.migration-failure"), diagnostics.ids);
    }

    @Test
    void targetVersionMissingAndWrongOwnerSchemasFailWithoutBlockingHealthyOwner() throws Exception {
        Path databasePath = temporaryDirectory.resolve("target-signature-isolation.db");
        SqliteMigration missingMigration = new SqliteMigration(
                1, connection -> connection.createStatement().execute("SELECT 1"));
        SqliteMigration wrongMigration = new SqliteMigration(
                1, connection -> connection.createStatement().execute(
                        "CREATE TABLE wrong_owner_rows(id INTEGER PRIMARY KEY)"));
        SqliteMigration healthyMigration = new SqliteMigration(
                1, connection -> connection.createStatement().execute(
                        "CREATE TABLE healthy_owner_rows(id INTEGER PRIMARY KEY, label TEXT NOT NULL)"));
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, (id, type) -> { })) {
            TestFeatureStores.stores(
                    initial,
                    definition("missing-schema", missingMigration),
                    definition("wrong-schema", wrongMigration),
                    definition("healthy-schema", healthyMigration));
        }

        SqliteSchemaValidator missingTarget = SqliteSchemaValidator.builder()
                .table("missing_owner_rows", "id")
                .primaryKey("missing_owner_rows", "id")
                .build();
        SqliteSchemaValidator wrongTarget = SqliteSchemaValidator.builder()
                .table("wrong_owner_rows", "id", "label")
                .primaryKey("wrong_owner_rows", "id")
                .build();
        SqliteSchemaValidator healthyTarget = SqliteSchemaValidator.builder()
                .table("healthy_owner_rows", "id", "label")
                .primaryKey("healthy_owner_rows", "id")
                .build();
        try (SqliteDatabase current = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle healthy = current.featureStore(FeatureStoreDefinition.validated(
                    "healthy-schema", healthyTarget, healthyMigration));
            current.featureStore(FeatureStoreDefinition.validated(
                    "missing-schema", missingTarget, missingMigration));
            current.featureStore(FeatureStoreDefinition.validated(
                    "wrong-schema", wrongTarget, wrongMigration));

            var readiness = current.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("missing-schema"));
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("wrong-schema"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("healthy-schema"));
            try (var connection = healthy.openConnection()) {
                connection.createStatement().execute(
                        "INSERT INTO healthy_owner_rows(id, label) VALUES(1, 'ready')");
            }
        }
    }

    @Test
    void tableColumnValidationDistinguishesExactTargetsFromRequiredProviderProjections() throws Exception {
        Path databasePath = temporaryDirectory.resolve("column-signatures.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute(
                    "CREATE TABLE provider_rows(id INTEGER PRIMARY KEY, label TEXT NOT NULL, provider_payload TEXT)");

            SqliteSchemaValidator.builder()
                    .tableContaining("provider_rows", "id", "label")
                    .primaryKey("provider_rows", "id")
                    .build()
                    .validate(connection);

            SqliteSchemaValidator exact = SqliteSchemaValidator.builder()
                    .table("provider_rows", "id", "label")
                    .primaryKey("provider_rows", "id")
                    .build();
            SQLException extraColumn = assertThrows(SQLException.class, () -> exact.validate(connection));
            assertEquals(
                    "owner table columns do not match the target signature: provider_rows",
                    extraColumn.getMessage());

            SqliteSchemaValidator missingRequiredColumn = SqliteSchemaValidator.builder()
                    .tableContaining("provider_rows", "id", "label", "required_value")
                    .primaryKey("provider_rows", "id")
                    .build();
            SQLException missingColumn = assertThrows(
                    SQLException.class, () -> missingRequiredColumn.validate(connection));
            assertEquals(
                    "owner table is missing required columns: provider_rows",
                    missingColumn.getMessage());
        }
    }

    @Test
    void migrationFailureRollsBackSchemaAndVersion() throws Exception {
        Path databasePath = temporaryDirectory.resolve("rollback.db");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);
        FeatureStoreHandle source =
                TestFeatureStores.store(
                        database,
                        "broken", new SqliteMigration(1, connection -> {
            connection.createStatement().execute("CREATE TABLE partial_data(id INTEGER)");
            throw new SQLException("authored payload must not enter diagnostics");
        }));

        assertThrows(SQLException.class, source::openConnection);

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var table = connection.prepareStatement(
                     "SELECT name FROM sqlite_master WHERE type='table' "
                             + "AND name IN ('partial_data', 'sm_schema_versions')");
             var result = table.executeQuery()) {
            assertFalse(result.next());
            assertEquals(0, pragmaInt(connection, "PRAGMA user_version"));
        }
        assertEquals(List.of("persistence.migration-failure"), diagnostics.ids);
    }

    @Test
    void restoresCorruptPrimaryFromVerifiedVersionedBackupAndPreservesOriginal() throws Exception {
        Path databasePath = temporaryDirectory.resolve("recover.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);

        createPendingMigrationBackup(databasePath, migration);
        Path backup = temporaryDirectory.resolve("recover.db.backup-v1.sqlite");
        assertTrue(Files.isRegularFile(backup));

        Files.write(databasePath, new byte[] {0x13, 0x37, 0x01, 0x02});
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        try (SqliteDatabase recovered = new SqliteDatabase(databasePath, diagnostics);
             var connection =
                        TestFeatureStores.store(recovered, "seed", migration).openConnection()) {
            assertEquals("kept", storedValue(connection));
        }

        assertEquals(List.of("persistence.integrity-failure"), diagnostics.ids);
        try (var files = Files.list(temporaryDirectory)) {
            assertTrue(files.anyMatch(path -> path.getFileName().toString().startsWith("recover.db.corrupt-")));
        }
    }

    @Test
    void versionedBackupIncludesCommittedWalStateDuringConcurrentCheckpoint() throws Exception {
        Path databasePath = temporaryDirectory.resolve("wal.db");
        SqliteMigration migration = seedMigration();
        SqliteDatabase writerLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
        try (var writer =
                TestFeatureStores.store(writerLifecycle, "seed", migration).openConnection()) {
            writer.createStatement().execute("INSERT INTO recovery_data(id, value) VALUES(1, 'from-wal')");
        }

        CountDownLatch firstConcurrentCommit = new CountDownLatch(1);
        AtomicReference<Throwable> concurrentFailure = new AtomicReference<>();
        Thread checkpointWriter = new Thread(() -> {
            try (var concurrent = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
                try (var statement = concurrent.createStatement()) {
                    statement.execute("PRAGMA busy_timeout = 5000");
                }
                for (int index = 0; index < 100; index++) {
                    try (var statement = concurrent.createStatement()) {
                        statement.execute(
                                                "INSERT INTO recovery_data(id, value) VALUES(2,"
                                                    + " 'checkpoint-"
                                                        + index + "') ON CONFLICT(id) DO UPDATE SET"
                                                        + " value=excluded.value");
                    }
                    firstConcurrentCommit.countDown();
                    try (var statement = concurrent.createStatement()) {
                        statement.execute("PRAGMA wal_checkpoint(PASSIVE)");
                    }
                }
            } catch (Throwable failure) {
                concurrentFailure.set(failure);
            }
        });
        checkpointWriter.start();
        if (!firstConcurrentCommit.await(5, TimeUnit.SECONDS)) {
            throw new AssertionError("concurrent WAL writer did not commit", concurrentFailure.get());
        }
        try (SqliteDatabase backupLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
             var reader = TestFeatureStores.stores(
                     backupLifecycle,
                     definition("seed", migration),
                     backupTriggerDefinition()).get("seed").openConnection()) {
            assertEquals("from-wal", storedValue(reader));
            assertTrue(storedValue(reader, 2).startsWith("checkpoint-"));
        }
        checkpointWriter.join();
        if (concurrentFailure.get() != null) {
            throw new AssertionError("concurrent WAL writer failed", concurrentFailure.get());
        }
        writerLifecycle.close();

        Files.write(databasePath, new byte[] {0x55, 0x66});
        try (SqliteDatabase recovered = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection =
                        TestFeatureStores.store(recovered, "seed", migration).openConnection()) {
            assertEquals("from-wal", storedValue(connection));
            assertTrue(storedValue(connection, 2).startsWith("checkpoint-"));
        }
    }

    @Test
    void corruptionWithoutBackupFailsClosedAndLeavesPrimaryUntouched() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unrecoverable.db");
        byte[] corrupt = new byte[] {0x01, 0x02, 0x03, 0x04};
        Files.write(databasePath, corrupt);
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);

        FeatureStoreUnavailableException unavailable = assertThrows(
                FeatureStoreUnavailableException.class,
                () ->
                                TestFeatureStores.store(database, "seed", seedMigration()).openConnection());

        assertEquals(FeatureStoreReadiness.CORRUPT, unavailable.readiness());
        assertArrayEquals(corrupt, Files.readAllBytes(databasePath));
        assertEquals(
                List.of("persistence.integrity-failure", "persistence.recovery-failure"),
                diagnostics.ids);
    }

    @Test
    void subtleDeleteJournalCorruptionWithoutBackupDoesNotMutateDatabaseFamily() throws Exception {
        Path databasePath = temporaryDirectory.resolve("subtle-corruption.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            assertEquals("delete", pragmaText(connection, "PRAGMA journal_mode = DELETE"));
            connection.createStatement().execute(
                            "CREATE TABLE authored_data(id INTEGER PRIMARY KEY, value TEXT NOT"
                                + " NULL)");
            connection.createStatement().execute(
                    "INSERT INTO authored_data(id, value) VALUES(1, 'kept')");
        }
        byte[] corrupt = Files.readAllBytes(databasePath);
        int pageSize = ((corrupt[16] & 0xff) << 8) | (corrupt[17] & 0xff);
        if (pageSize == 1) {
            pageSize = 65_536;
        }
        corrupt[pageSize] = 0;
        Files.write(databasePath, corrupt);
        Path wal = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
        Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
        assertFalse(Files.exists(wal));
        assertFalse(Files.exists(shm));

        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });

        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", seedMigration()).openConnection());
        assertArrayEquals(corrupt, Files.readAllBytes(databasePath));
        assertFalse(Files.exists(wal));
        assertFalse(Files.exists(shm));
    }

    @Test
    void sidecarQuarantineMoveFailureRestoresEveryAlreadyMovedFile() throws Exception {
        assertSidecarQuarantineMoveFailureRestoresFamily("-wal");
        assertSidecarQuarantineMoveFailureRestoresFamily("-shm");
        assertSidecarQuarantineMoveFailureRestoresFamily("-journal");
    }

    private void assertSidecarQuarantineMoveFailureRestoresFamily(String failingSuffix) throws Exception {
        Path databasePath = temporaryDirectory.resolve("sidecar-move" + failingSuffix + ".db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        createPendingMigrationBackup(databasePath, migration);
        assertTrue(Files.isRegularFile(backup));

        byte[] corruptPrimary = new byte[] {0x12, 0x34, 0x56, 0x78};
        byte[] originalWal = new byte[] {0x01, 0x23, 0x45};
        byte[] originalShm = new byte[] {0x67, 0x01, 0x23};
        byte[] originalJournal = new byte[] {0x45, 0x67, 0x01};
        Files.write(databasePath, corruptPrimary);
        Path wal = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
        Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
        Path journal = databasePath.resolveSibling(databasePath.getFileName() + "-journal");
        Files.write(wal, originalWal);
        Files.write(shm, originalShm);
        Files.write(journal, originalJournal);
        Path failingSidecar = databasePath.resolveSibling(databasePath.getFileName() + failingSuffix);
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics, (source, target) -> {
            if (source.equals(failingSidecar)) {
                throw new IOException("injected sidecar move failure");
            }
            Files.move(source, target);
        });

        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", migration).openConnection());

        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
        assertArrayEquals(originalWal, Files.readAllBytes(wal));
        assertArrayEquals(originalShm, Files.readAllBytes(shm));
        assertArrayEquals(originalJournal, Files.readAllBytes(journal));
        try (var files = Files.list(temporaryDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString()
                    .startsWith(databasePath.getFileName() + ".corrupt-")));
        }
        assertEquals(
                List.of("persistence.integrity-failure", "persistence.recovery-failure"),
                diagnostics.ids);

        Files.delete(backup);
        SqliteDatabase retry = new SqliteDatabase(databasePath, (id, type) -> { });
        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(retry, "seed", migration).openConnection());
        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
        assertArrayEquals(originalWal, Files.readAllBytes(wal));
        assertArrayEquals(originalShm, Files.readAllBytes(shm));
        assertArrayEquals(originalJournal, Files.readAllBytes(journal));
    }

    @Test
    void recoveryPreservesHotRollbackJournalAndNoBackupCaseLeavesFamilyUntouched() throws Exception {
        Path recoverable = temporaryDirectory.resolve("hot-journal-recoverable.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(recoverable, migration);
        createPendingMigrationBackup(recoverable, migration);
        assertTrue(Files.isRegularFile(
                recoverable.resolveSibling(recoverable.getFileName() + ".backup-v1.sqlite")));
        Path recoverableJournal = createHotRollbackJournal(recoverable);
        byte[] recoverableJournalBytes = Files.readAllBytes(recoverableJournal);
        byte[] corruptRecoverable = corruptHeader(recoverable);

        try (SqliteDatabase recovered = new SqliteDatabase(recoverable, (id, type) -> { });
             var connection =
                        TestFeatureStores.store(recovered, "seed", migration).openConnection()) {
            assertEquals("kept", storedValue(connection));
        }
        Path quarantine;
        try (var files = Files.list(temporaryDirectory)) {
            quarantine = files.filter(path -> path.getFileName().toString()
                            .startsWith("hot-journal-recoverable.db.corrupt-"))
                    .filter(path -> path.getFileName().toString().endsWith(".sqlite"))
                    .findFirst()
                    .orElseThrow();
        }
        assertArrayEquals(corruptRecoverable, Files.readAllBytes(quarantine));
        assertArrayEquals(
                recoverableJournalBytes,
                Files.readAllBytes(quarantine.resolveSibling(quarantine.getFileName() + "-journal")));

        Path unrecoverable = temporaryDirectory.resolve("hot-journal-unrecoverable.db");
        createSeedDatabase(unrecoverable, migration);
        Path unrecoverableJournal = createHotRollbackJournal(unrecoverable);
        byte[] journalBytes = Files.readAllBytes(unrecoverableJournal);
        byte[] corruptPrimary = corruptHeader(unrecoverable);

        SqliteDatabase failed = new SqliteDatabase(unrecoverable, (id, type) -> { });
        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(failed, "seed", migration).openConnection());
        assertArrayEquals(corruptPrimary, Files.readAllBytes(unrecoverable));
        assertArrayEquals(journalBytes, Files.readAllBytes(unrecoverableJournal));
    }

    @Test
    void validHotRollbackJournalIsRecoveredOnlyOnIsolatedCopyBeforeBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("valid-hot-journal.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        assertFalse(Files.exists(backup));
        Path journal = createHotRollbackJournal(databasePath);
        byte[] primaryBeforePrepare = Files.readAllBytes(databasePath);
        byte[] journalBeforePrepare = Files.readAllBytes(journal);
        assertTrue(contains(primaryBeforePrepare, UNCOMMITTED_MARKER));

        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
        FeatureStoreHandle seed = database.featureStore(
                definition("seed", migration));
        database.featureStore(backupTriggerDefinition());
        database.prepare();

        assertTrue(Files.isRegularFile(backup));
        assertArrayEquals(primaryBeforePrepare, Files.readAllBytes(databasePath));
        assertArrayEquals(journalBeforePrepare, Files.readAllBytes(journal));
        database.prepareRegisteredStores();
        try (var connection = seed.openConnection()) {
            assertEquals("kept", storedValue(connection));
            assertEquals(1, storedRowCount(connection));
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup)) {
            assertEquals("kept", storedValue(connection));
            assertEquals(1, storedRowCount(connection));
        }
    }

    @Test
    void activeRollbackJournalWriterPreventsBackupSnapshot() throws Exception {
        Path databasePath = temporaryDirectory.resolve("active-journal-writer.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        Path ready = temporaryDirectory.resolve("active-writer.ready");
        Path release = temporaryDirectory.resolve("active-writer.release");
        Process writer = startActiveRollbackJournalWriter(databasePath, ready, release);
        try {
            awaitFile(ready, writer);
            assertTrue(Files.isRegularFile(
                    databasePath.resolveSibling(databasePath.getFileName() + "-journal")));

            SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
            assertThrows(SQLException.class, database::prepare);
            assertFalse(Files.exists(
                    databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite")));
        } finally {
            Files.writeString(release, "release");
            assertEquals(0, writer.waitFor());
        }
    }

    @Test
    void rejectsBackupWhoseInternalVersionDoesNotMatchCompatibleFileName() throws Exception {
        Path databasePath = temporaryDirectory.resolve("mislabeled-backup.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        createPendingMigrationBackup(databasePath, migration);
        assertTrue(Files.isRegularFile(backup));
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup)) {
            connection.createStatement().execute("PRAGMA user_version = 99");
        }
        byte[] corruptPrimary = corruptHeader(databasePath);

        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", migration).openConnection());

        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
        try (var files = Files.list(temporaryDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString()
                    .startsWith("mislabeled-backup.db.corrupt-")));
        }
    }

    @Test
    void foreignKeyViolationFailsClosedWithoutRestoringOlderBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("logical-inconsistency.db");
        SqliteMigration migration = new SqliteMigration(1, connection -> {
            connection.createStatement().execute("CREATE TABLE parent(id INTEGER PRIMARY KEY)");
            connection.createStatement().execute(
                                            "CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id"
                                                + " INTEGER NOT NULL REFERENCES parent(id))");
        });
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection =
                        TestFeatureStores.store(initial, "seed", migration).openConnection()) {
            connection.createStatement().execute("INSERT INTO parent(id) VALUES(1)");
        }
        createPendingMigrationBackup(databasePath, migration);
        assertTrue(Files.isRegularFile(
                temporaryDirectory.resolve("logical-inconsistency.db.backup-v1.sqlite")));
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute("PRAGMA foreign_keys = OFF");
            connection.createStatement().execute("INSERT INTO child(id, parent_id) VALUES(1, 999)");
        }
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);

        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", migration).openConnection());

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var result = connection.createStatement().executeQuery("SELECT parent_id FROM child WHERE id=1")) {
            assertTrue(result.next());
            assertEquals(999, result.getInt(1));
        }
        try (var files = Files.list(temporaryDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString()
                    .startsWith("logical-inconsistency.db.corrupt-")));
        }
        assertEquals(List.of("persistence.integrity-failure"), diagnostics.ids);
    }

    @Test
    void rejectsUnknownFuturePlatformVersionWithoutReplacingIt() throws Exception {
        Path databasePath = temporaryDirectory.resolve("future.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute("PRAGMA user_version = 99");
        }
        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });

        FeatureStoreUnavailableException unavailable = assertThrows(
                FeatureStoreUnavailableException.class,
                () ->
                                TestFeatureStores.store(database, "seed", seedMigration()).openConnection());

        assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, unavailable.readiness());
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            assertEquals(99, pragmaInt(connection, "PRAGMA user_version"));
        }
    }

    @Test
    void rejectsUnknownFutureFeatureVersionWithoutDowngrade() throws Exception {
        Path databasePath = temporaryDirectory.resolve("future-feature.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute(
                    "UPDATE sm_schema_versions SET version=2 WHERE owner='seed'");
        }
        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });

        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", migration).openConnection());

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var result = connection.createStatement().executeQuery(
                                        "SELECT version FROM sm_schema_versions WHERE"
                                            + " owner='seed'")) {
            assertTrue(result.next());
            assertEquals(2, result.getInt(1));
        }
    }

    private void createSeedDatabase(Path databasePath, SqliteMigration migration) throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection =
                        TestFeatureStores.store(database, "seed", migration).openConnection()) {
            connection.createStatement().execute("INSERT INTO recovery_data(id, value) VALUES(1, 'kept')");
        }
    }

    private void createPendingMigrationBackup(Path databasePath, SqliteMigration migration)
            throws Exception {
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        assertFalse(Files.exists(backup));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            var stores = TestFeatureStores.stores(
                    database,
                    definition("seed", migration),
                    backupTriggerDefinition());
            try (var ignored = stores.get("seed").openConnection()) {
                assertTrue(Files.isRegularFile(backup));
            }
        }
    }

    private static FeatureStoreDefinition backupTriggerDefinition() {
        return definition(
                "backup-trigger",
                new SqliteMigration(1, connection -> connection.createStatement().execute(
                        "CREATE TABLE backup_trigger_rows(id INTEGER PRIMARY KEY)")));
    }

    private static Path createHotRollbackJournal(Path databasePath) throws Exception {
        Process process = new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp",
                System.getProperty("java.class.path"),
                HotRollbackJournalProcess.class.getName(),
                databasePath.toString())
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertEquals(0, process.waitFor(), output);
        Path journal = databasePath.resolveSibling(databasePath.getFileName() + "-journal");
        assertTrue(Files.isRegularFile(journal));
        assertTrue(Files.size(journal) > 0L);
        assertArrayEquals(
                ROLLBACK_JOURNAL_MAGIC,
                Arrays.copyOf(Files.readAllBytes(journal), ROLLBACK_JOURNAL_MAGIC.length));
        return journal;
    }

    private static Process startActiveRollbackJournalWriter(
            Path databasePath, Path ready, Path release) throws IOException {
        return new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp",
                System.getProperty("java.class.path"),
                HotRollbackJournalProcess.class.getName(),
                databasePath.toString(),
                ready.toString(),
                release.toString())
                .inheritIO()
                .start();
    }

    private static void awaitFile(Path path, Process process) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!Files.isRegularFile(path) && process.isAlive() && System.nanoTime() < deadline) {
            Thread.sleep(10L);
        }
        assertTrue(Files.isRegularFile(path));
    }

    private static byte[] corruptHeader(Path databasePath) throws IOException {
        byte[] corrupt = Files.readAllBytes(databasePath);
        corrupt[0] = 0;
        Files.write(databasePath, corrupt);
        return corrupt;
    }

    private static SqliteMigration seedMigration() {
        return new SqliteMigration(1, connection -> connection.createStatement()
                .execute(
                                        "CREATE TABLE recovery_data(id INTEGER PRIMARY KEY, value"
                                            + " TEXT NOT NULL)"));
    }

    private static FeatureStoreDefinition definition(String owner, SqliteMigration... migrations) {
        return FeatureStoreDefinition.validated(owner, connection -> { }, migrations);
    }

    private static String storedValue(java.sql.Connection connection) throws SQLException {
        return storedValue(connection, 1);
    }

    private static String storedValue(java.sql.Connection connection, int id) throws SQLException {
        try (var result = connection.createStatement().executeQuery(
                "SELECT value FROM recovery_data WHERE id=" + id)) {
            return result.next() ? result.getString(1) : "";
        }
    }

    private static int storedRowCount(java.sql.Connection connection) throws SQLException {
        try (var result = connection.createStatement().executeQuery("SELECT COUNT(*) FROM recovery_data")) {
            return result.next() ? result.getInt(1) : -1;
        }
    }

    private static boolean contains(byte[] bytes, byte[] expected) {
        for (int start = 0; start <= bytes.length - expected.length; start++) {
            boolean matches = true;
            for (int index = 0; index < expected.length; index++) {
                if (bytes[start + index] != expected[index]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                return true;
            }
        }
        return false;
    }

    private static int pragmaInt(java.sql.Connection connection, String pragma) throws SQLException {
        try (var result = connection.createStatement().executeQuery(pragma)) {
            return result.next() ? result.getInt(1) : -1;
        }
    }

    private static String pragmaText(java.sql.Connection connection, String pragma) throws SQLException {
        try (var result = connection.createStatement().executeQuery(pragma)) {
            return result.next() ? result.getString(1).toLowerCase(java.util.Locale.ROOT) : "";
        }
    }

    private static final class RecordingDiagnostics implements Diagnostics {
        private final List<String> ids = new ArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            ids.add(id.value());
        }
    }
}

final class HotRollbackJournalProcess {

    private HotRollbackJournalProcess() { }

    public static void main(String[] arguments) throws Exception {
        Class.forName("org.sqlite.JDBC");
        Path databasePath = Path.of(arguments[0]);
        var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (var statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode = DELETE");
        }
        try (var statement = connection.createStatement()) {
            statement.execute("PRAGMA synchronous = FULL");
        }
        try (var statement = connection.createStatement()) {
            statement.execute("PRAGMA cache_size = 5");
            statement.execute("PRAGMA cache_spill = ON");
        }
        connection.setAutoCommit(false);
        try (var update = connection.prepareStatement(
                "UPDATE recovery_data SET value=? WHERE id=1")) {
            update.setString(1, "UNCOMMITTED-ON-DISK-MARKER-primary");
            update.executeUpdate();
        }
        try (var insert = connection.prepareStatement(
                "INSERT INTO recovery_data(id, value) VALUES(?, ?)")) {
            for (int id = 2; id <= 200; id++) {
                insert.setInt(1, id);
                insert.setString(2, "UNCOMMITTED-ON-DISK-MARKER-" + id + "-" + "x".repeat(16_384));
                insert.executeUpdate();
            }
        }
        if (arguments.length == 3) {
            Path ready = Path.of(arguments[1]);
            Path release = Path.of(arguments[2]);
            Files.writeString(ready, "ready");
            while (!Files.exists(release)) {
                Thread.sleep(10L);
            }
            connection.rollback();
            connection.close();
            return;
        }
        Runtime.getRuntime().halt(0);
    }
}
