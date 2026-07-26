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
    private static final String SEED_TABLE_SQL =
            "CREATE TABLE recovery_data(id INTEGER PRIMARY KEY, value TEXT NOT NULL)";

    @TempDir
    Path temporaryDirectory;

    @Test
    void preservesXdgAndFallbackDatabaseLocations() {
        assertEquals(
                Path.of("/tmp/xdg", "salt-marcher", "database.sqlite"),
                SqliteDatabase.resolveDatabasePath("database.sqlite", "/tmp/xdg", "/home/test"));
        assertEquals(
                Path.of("/home/test", ".local", "share", "salt-marcher", "database.sqlite"),
                SqliteDatabase.resolveDatabasePath("database.sqlite", "", "/home/test"));
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
        Path databasePath = temporaryDirectory.resolve("database.sqlite");
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
    void transactionalWriteRollbackProbePreservesSemanticDatabaseStateAcrossReopen()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("write-probe.db");
        SqliteMigration migration = seedMigration();
        DatabaseSemanticSnapshot before;

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle seed = TestFeatureStores.store(database, "seed", migration);
            try (var connection = seed.openConnection()) {
                connection.createStatement().execute(
                        "INSERT INTO recovery_data(id, value) VALUES(1, 'kept')");
                connection.createStatement().execute(
                        "INSERT INTO recovery_data(id, value) VALUES(2, 'also-kept')");
                before = semanticSnapshot(connection);
                assertFalse(tableExists(connection, "sm_runtime_write_probe"));
            }

            database.verifyTransactionalWriteRollback();
        }

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, (id, type) -> { });
                var connection = TestFeatureStores.store(reopened, "seed", migration)
                        .openConnection()) {
            assertEquals(before, semanticSnapshot(connection));
            assertFalse(tableExists(connection, "sm_runtime_write_probe"));
        }
    }

    @Test
    void unchangedParkedTokenSkipsFullValidationAndChangedValidStoreRunsIt()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("parked-token-fast-path.db");
        AtomicInteger validations = new AtomicInteger();
        FeatureStoreDefinition store = FeatureStoreDefinition.validated(
                "seed",
                connection -> {
                    validations.incrementAndGet();
                    try (var result = connection.createStatement().executeQuery(
                            "SELECT COUNT(*) FROM recovery_data")) {
                        result.next();
                    }
                },
                seedMigration());

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            TestFeatureStores.store(database, store);
            assertEquals(1, validations.get(), "open performs the owner validation");
            database.capturePreparedParkedState();

            assertTrue(database.verifyPreparedParkedState());
            assertEquals(1, validations.get(),
                    "unchanged PARKED ownership token must not repeat the full owner scan");

            try (var external = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
                external.createStatement().execute(
                        "INSERT INTO recovery_data(id, value) VALUES(1, 'external-but-valid')");
            }

            assertFalse(database.verifyPreparedParkedState(),
                    "a valid external change still invalidates the in-memory aggregate");
            assertEquals(2, validations.get(),
                    "changed bytes must run physical, FK, and owner validation");
        }
    }

    @Test
    void parkedOwnerSchemaDamageFailsImmutableReadOnlyWithoutChangingBytesOrSidecars()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("parked-owner-damage.db");
        Path walPath = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
        Path shmPath = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
        Path journalPath = databasePath.resolveSibling(databasePath.getFileName() + "-journal");
        FeatureStoreDefinition store = FeatureStoreDefinition.validated(
                "seed",
                connection -> {
                    try (var result = connection.createStatement().executeQuery(
                            "SELECT COUNT(*) FROM sqlite_master"
                                    + " WHERE type='table' AND name='recovery_data'")) {
                        if (!result.next() || result.getInt(1) != 1 || result.next()) {
                            throw new SQLException("current owner table is missing");
                        }
                    }
                },
                seedMigration());

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            TestFeatureStores.store(database, store);
            database.capturePreparedParkedState();

            try (var external = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
                external.createStatement().execute("DROP TABLE recovery_data");
            }
            byte[] damagedCurrentSqlite = Files.readAllBytes(databasePath);
            assertTrue(damagedCurrentSqlite.length > 0, "damage fixture remains valid SQLite bytes");
            assertFalse(Files.exists(walPath), "closed external writer left no WAL before validation");
            assertFalse(Files.exists(shmPath), "closed external writer left no SHM before validation");
            assertFalse(Files.exists(journalPath),
                    "closed external writer left no rollback journal before validation");

            assertThrows(SQLException.class, database::verifyPreparedParkedState);

            assertArrayEquals(damagedCurrentSqlite, Files.readAllBytes(databasePath));
            assertFalse(Files.exists(walPath), "read-only validation must not create a WAL");
            assertFalse(Files.exists(shmPath), "read-only validation must not create SHM");
            assertFalse(Files.exists(journalPath),
                    "read-only validation must not create a rollback journal");
        }
    }

    @Test
    void crashedWalWriteProbeLeavesSemanticStateIntactAndDatabaseWritable() throws Exception {
        Path databasePath = temporaryDirectory.resolve("crashed-write-probe.db");
        Path walPath = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
        SqliteMigration migration = seedMigration();
        DatabaseSemanticSnapshot before;

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
                var connection = TestFeatureStores.store(database, "seed", migration)
                        .openConnection()) {
            connection.createStatement().execute(
                    "INSERT INTO recovery_data(id, value) VALUES(1, 'kept')");
            connection.createStatement().execute(
                    "INSERT INTO recovery_data(id, value) VALUES(2, 'also-kept')");
            before = semanticSnapshot(connection);
        }
        assertFalse(Files.exists(walPath));

        Process probe = new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp",
                System.getProperty("java.class.path"),
                WalWriteProbeCrashProcess.class.getName(),
                databasePath.toString())
                .redirectErrorStream(true)
                .start();
        String output = new String(probe.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertEquals(0, probe.waitFor(), output);
        assertTrue(Files.isRegularFile(walPath));
        assertTrue(Files.size(walPath) > 32L, "crashed probe did not write a WAL frame");

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, (id, type) -> { });
                var connection = TestFeatureStores.store(reopened, "seed", migration)
                        .openConnection()) {
            assertEquals(before, semanticSnapshot(connection));
            assertFalse(tableExists(connection, "sm_runtime_write_probe"));
            assertEquals("ok", pragmaText(connection, "PRAGMA integrity_check"));
            connection.createStatement().execute(
                    "INSERT INTO recovery_data(id, value) VALUES(3, 'after-crash')");
        }

        try (SqliteDatabase reopenedAgain = new SqliteDatabase(databasePath, (id, type) -> { });
                var connection = TestFeatureStores.store(reopenedAgain, "seed", migration)
                        .openConnection()) {
            DatabaseSemanticSnapshot afterMutation = semanticSnapshot(connection);
            assertEquals(before.schema(), afterMutation.schema());
            assertEquals(before.schemaVersions(), afterMutation.schemaVersions());
            assertEquals(before.userVersion(), afterMutation.userVersion());
            assertEquals(
                    List.of(
                            new PayloadEntry(1, "kept"),
                            new PayloadEntry(2, "also-kept"),
                            new PayloadEntry(3, "after-crash")),
                    afterMutation.payload());
            assertFalse(tableExists(connection, "sm_runtime_write_probe"));
        }
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
    void unversionedNonemptyPlatformShapeFailsClosedWithoutMutationOrBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unsupported-platform-shape.db");
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute(
                    "CREATE TABLE legacy_rows(id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
            connection.createStatement().execute(
                    "INSERT INTO legacy_rows(id, value) VALUES(1, 'preserved')");
        }
        byte[] before = Files.readAllBytes(databasePath);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v0.sqlite");

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.of("metadata-owner"));
            assertEquals(
                    FeatureStoreReadiness.CORRUPT,
                    database.prepareRegisteredStores().get("metadata-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertFalse(Files.exists(backup));
        assertDatabaseSidecarsAbsent(databasePath);
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
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
    void successfulOwnersReuseOneConfiguredPreparationConnection() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-connection-reuse.db");
        AtomicReference<java.sql.Connection> firstConnection = new AtomicReference<>();
        AtomicReference<java.sql.Connection> secondConnection = new AtomicReference<>();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.validated(
                    "first-owner", firstConnection::set));
            database.featureStore(FeatureStoreDefinition.validated(
                    "second-owner", secondConnection::set));

            var readiness = database.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.READY, readiness.get("first-owner"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("second-owner"));
            assertTrue(firstConnection.get() == secondConnection.get(),
                    "successful owner transactions must reuse one configured connection");
            assertTrue(firstConnection.get().isClosed(),
                    "the shared preparation connection must close after the owner batch");
        }
    }

    @Test
    void failedOwnerForcesAConfiguredConnectionReopenBeforeTheNextOwner() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-connection-reopen-after-failure.db");
        AtomicReference<java.sql.Connection> failedConnection = new AtomicReference<>();
        AtomicReference<java.sql.Connection> healthyConnection = new AtomicReference<>();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.validated(
                    "failed-owner",
                    connection -> {
                        failedConnection.set(connection);
                        throw new SQLException("injected owner failure");
                    }));
            database.featureStore(FeatureStoreDefinition.validated(
                    "healthy-owner", healthyConnection::set));

            var readiness = database.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED, readiness.get("failed-owner"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("healthy-owner"));
            assertFalse(failedConnection.get() == healthyConnection.get(),
                    "an owner failure must discard its configured connection");
            assertTrue(failedConnection.get().isClosed());
            assertTrue(healthyConnection.get().isClosed());
        }
    }

    @Test
    void currentValidatorsShareOneReadOnlyQualificationConnectionAcrossNewerOwner() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-connection-reopen-after-newer.db");
        SqliteMigration versionOne = new SqliteMigration(
                1, connection -> connection.createStatement().execute(
                        "CREATE TABLE newer_owner_rows(id INTEGER PRIMARY KEY)"));
        SqliteMigration versionTwo = new SqliteMigration(
                2, connection -> connection.createStatement().execute(
                        "ALTER TABLE newer_owner_rows ADD COLUMN label TEXT"));
        try (SqliteDatabase newer = new SqliteDatabase(databasePath, (id, type) -> { })) {
            newer.featureStore(definition("newer-owner", versionOne, versionTwo));
            assertEquals(
                    FeatureStoreReadiness.READY,
                    newer.prepareRegisteredStores().get("newer-owner"));
        }

        AtomicReference<java.sql.Connection> beforeConnection = new AtomicReference<>();
        AtomicReference<java.sql.Connection> afterConnection = new AtomicReference<>();
        try (SqliteDatabase current = new SqliteDatabase(databasePath, (id, type) -> { })) {
            current.featureStore(FeatureStoreDefinition.validated(
                    "before-owner", beforeConnection::set));
            current.featureStore(definition("newer-owner", versionOne));
            current.featureStore(FeatureStoreDefinition.validated(
                    "after-owner", afterConnection::set));

            var readiness = current.prepareRegisteredStores();

            assertEquals(FeatureStoreReadiness.READY, readiness.get("before-owner"));
            assertEquals(FeatureStoreReadiness.NEWER_SCHEMA, readiness.get("newer-owner"));
            assertEquals(FeatureStoreReadiness.READY, readiness.get("after-owner"));
            assertTrue(beforeConnection.get() == afterConnection.get(),
                    "current validators may share one read-only qualification connection");
            assertTrue(beforeConnection.get().isClosed());
            assertTrue(afterConnection.get().isClosed());
        }
    }

    @Test
    void ownerValidatorCannotMutateThePreparedDatabase() throws Exception {
        Path databasePath = temporaryDirectory.resolve("read-only-validator.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.validated(
                    "read-only-validator",
                    connection -> connection.createStatement().execute(
                            "CREATE TABLE validator_side_effect(id INTEGER PRIMARY KEY)")));

            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("read-only-validator"));
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var result = connection.createStatement().executeQuery(
                        "SELECT 1 FROM sqlite_master WHERE type='table'"
                                + " AND name='validator_side_effect'")) {
            assertFalse(result.next());
        }
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
    void exactSchemaRejectsRecordedV1ConflictClauseWithoutTouchingSourceFamily() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-conflict-clause.db");
        String expectedTable = "CREATE TABLE ddl_owner_rows("
                + "id TEXT PRIMARY KEY ON CONFLICT ABORT, value TEXT NOT NULL)";
        String actualTable = expectedTable.replace("ON CONFLICT ABORT", "ON CONFLICT REPLACE");
        String index = "CREATE INDEX ddl_owner_value_idx ON ddl_owner_rows(value)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "ddl-owner", 1);
            statement.execute(actualTable);
            statement.execute(index);
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "ddl-owner",
                SqliteSchemaValidator.exactSchema(
                        List.of(expectedTable),
                        List.of(index),
                        List.of("ddl_owner_"),
                        List.of()),
                new SqliteMigration(1, connection -> {
                    connection.createStatement().execute(expectedTable);
                    connection.createStatement().execute(index);
                }));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("ddl-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void exactSchemaRejectsArbitrarilyNamedTriggerBoundToOwnerTable() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-trigger.db");
        String table = "CREATE TABLE trigger_owner_rows(id INTEGER PRIMARY KEY, value TEXT NOT NULL)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "trigger-owner", 1);
            statement.execute(table);
            statement.execute("CREATE TRIGGER unexpected_after_insert AFTER INSERT ON trigger_owner_rows "
                    + "BEGIN SELECT NEW.id; END");
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "trigger-owner",
                SqliteSchemaValidator.exactSchema(
                        List.of(table), List.of(), List.of("trigger_owner_"), List.of()),
                new SqliteMigration(1, connection -> connection.createStatement().execute(table)));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("trigger-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void exactSchemaInventoryMatchesOwnedPrefixesAndForbiddenNamesCaseInsensitively()
            throws Exception {
        Path databasePath = temporaryDirectory.resolve("case-insensitive-owner-inventory.db");
        String table = "CREATE TABLE case_owner_rows(id INTEGER PRIMARY KEY)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "case-owner", 1);
            statement.execute(table);
            statement.execute("CREATE VIEW CASE_OWNER_FOREIGN AS SELECT 1 AS value");
            statement.execute("CREATE VIEW RETIRED_CASE_OWNER AS SELECT 2 AS value");
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "case-owner",
                SqliteSchemaValidator.exactSchema(
                        List.of(table),
                        List.of(),
                        List.of("case_owner_"),
                        List.of("retired_case_owner")),
                new SqliteMigration(1, connection -> connection.createStatement().execute(table)));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("case-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void exactSchemaRejectsForeignTableWithInboundReferenceToOwnerTable() throws Exception {
        Path databasePath = temporaryDirectory.resolve("owner-inbound-reference.db");
        String table = "CREATE TABLE referenced_owner_rows(id INTEGER PRIMARY KEY, value TEXT NOT NULL)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "referenced-owner", 1);
            statement.execute(table);
            statement.execute("CREATE TABLE unrelated_consumer(id INTEGER PRIMARY KEY, owner_id INTEGER "
                    + "REFERENCES referenced_owner_rows(id))");
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "referenced-owner",
                SqliteSchemaValidator.exactSchema(
                        List.of(table), List.of(), List.of("referenced_owner_"), List.of()),
                new SqliteMigration(1, connection -> connection.createStatement().execute(table)));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("referenced-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void platformSchemaRejectsForeignViewThatReadsVersionLedger() throws Exception {
        Path databasePath = temporaryDirectory.resolve("platform-ledger-view.db");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "probe", 1);
            statement.execute("CREATE VIEW unrelated_projection AS "
                    + "SELECT owner, version FROM sm_schema_versions");
        }
        byte[] before = Files.readAllBytes(databasePath);
        AtomicInteger ownerInspections = new AtomicInteger();

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.validated(
                    "probe", connection -> ownerInspections.incrementAndGet()));
            assertEquals(
                    FeatureStoreReadiness.CORRUPT,
                    database.prepareRegisteredStores().get("probe"));
        }

        assertEquals(0, ownerInspections.get());
        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void platformSchemaRejectsSingleQuotedCaseVariantLedgerDependency() throws Exception {
        Path databasePath = temporaryDirectory.resolve("single-quoted-platform-ledger-view.db");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "probe", 1);
            statement.execute("CREATE VIEW unrelated_quoted_projection AS "
                    + "SELECT owner, version FROM 'SM_SCHEMA_VERSIONS'");
        }
        byte[] before = Files.readAllBytes(databasePath);
        AtomicInteger ownerInspections = new AtomicInteger();

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(FeatureStoreDefinition.validated(
                    "probe", connection -> ownerInspections.incrementAndGet()));
            assertEquals(
                    FeatureStoreReadiness.CORRUPT,
                    database.prepareRegisteredStores().get("probe"));
        }

        assertEquals(0, ownerInspections.get());
        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void orphanSharedMemoryFamilyIsIncompatibleAndCannotRestoreValidBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("orphan-shm.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        createPendingMigrationBackup(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
        byte[] orphanShm = "orphan-shm-must-remain-exact".getBytes(StandardCharsets.UTF_8);
        Files.write(shm, orphanShm);
        byte[] primaryBefore = Files.readAllBytes(databasePath);
        byte[] backupBefore = Files.readAllBytes(backup);
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();

        try (SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics)) {
            FeatureStoreHandle handle = TestFeatureStores.store(database, "seed", migration);
            FeatureStoreUnavailableException unavailable = assertThrows(
                    FeatureStoreUnavailableException.class, handle::openConnection);
            assertEquals(FeatureStoreReadiness.INCOMPATIBLE, unavailable.readiness());
        }

        assertArrayEquals(primaryBefore, Files.readAllBytes(databasePath));
        assertArrayEquals(orphanShm, Files.readAllBytes(shm));
        assertArrayEquals(backupBefore, Files.readAllBytes(backup));
        assertFalse(Files.exists(databasePath.resolveSibling(databasePath.getFileName() + "-wal")));
        assertFalse(Files.exists(databasePath.resolveSibling(databasePath.getFileName() + "-journal")));
        assertNoQuarantine(databasePath);
        assertEquals(List.of("persistence.family-incompatible"), diagnostics.ids);
    }

    @Test
    void walWithoutSharedMemoryIsIncompatibleAndLeavesSourceAndBackupExact() throws Exception {
        Path databasePath = temporaryDirectory.resolve("wal-without-shm.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        createPendingMigrationBackup(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        Process probe = new ProcessBuilder(
                Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-cp",
                System.getProperty("java.class.path"),
                WalWriteProbeCrashProcess.class.getName(),
                databasePath.toString())
                .redirectErrorStream(true)
                .start();
        String output = new String(probe.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertEquals(0, probe.waitFor(), output);
        Path wal = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
        Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
        assertTrue(Files.isRegularFile(wal));
        assertTrue(Files.isRegularFile(shm));
        Files.delete(shm);
        byte[] primaryBefore = Files.readAllBytes(databasePath);
        byte[] walBefore = Files.readAllBytes(wal);
        byte[] backupBefore = Files.readAllBytes(backup);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle handle = TestFeatureStores.store(database, "seed", migration);
            FeatureStoreUnavailableException unavailable = assertThrows(
                    FeatureStoreUnavailableException.class, handle::openConnection);
            assertEquals(FeatureStoreReadiness.INCOMPATIBLE, unavailable.readiness());
        }

        assertArrayEquals(primaryBefore, Files.readAllBytes(databasePath));
        assertArrayEquals(walBefore, Files.readAllBytes(wal));
        assertFalse(Files.exists(shm));
        assertArrayEquals(backupBefore, Files.readAllBytes(backup));
        assertNoQuarantine(databasePath);
    }

    @Test
    void coherentWalRejectionRunsOnlyOnIsolatedFamilyAndLeavesSourceByteExact() throws Exception {
        Path databasePath = temporaryDirectory.resolve("coherent-wal-rejection.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        String table = "CREATE TABLE recovery_data(id INTEGER PRIMARY KEY, value TEXT NOT NULL)";
        FeatureStoreDefinition exactOwner = FeatureStoreDefinition.validated(
                "seed",
                SqliteSchemaValidator.exactSchema(
                        List.of(table), List.of(), List.of("recovery_"), List.of()),
                migration);

        try (var writer = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = writer.createStatement()) {
            statement.execute("PRAGMA journal_mode = WAL");
            statement.execute("PRAGMA wal_autocheckpoint = 0");
            statement.execute("CREATE TRIGGER unrelated_rejection_trigger AFTER INSERT ON recovery_data "
                    + "BEGIN SELECT NEW.id; END");
            Path wal = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
            Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
            assertTrue(Files.size(wal) > 32L);
            assertTrue(Files.size(shm) > 0L);
            byte[] primaryBefore = Files.readAllBytes(databasePath);
            byte[] walBefore = Files.readAllBytes(wal);
            byte[] shmBefore = Files.readAllBytes(shm);

            try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
                database.featureStore(exactOwner);
                assertEquals(
                        FeatureStoreReadiness.MIGRATION_FAILED,
                        database.prepareRegisteredStores().get("seed"));
            }

            assertArrayEquals(primaryBefore, Files.readAllBytes(databasePath));
            assertArrayEquals(walBefore, Files.readAllBytes(wal));
            assertArrayEquals(shmBefore, Files.readAllBytes(shm));
        }
    }

    @Test
    void malformedPlatformLedgerShapesFailBeforeOwnerInspectionAndRemainByteExact()
            throws Exception {
        List<PlatformLedgerDamage> damages = List.of(
                new PlatformLedgerDamage(
                        "missing-primary-key",
                        "CREATE TABLE sm_schema_versions(owner TEXT, "
                                + "version INTEGER NOT NULL CHECK(version >= 0))",
                        List.of(
                                "INSERT INTO sm_schema_versions VALUES('probe', 1)",
                                "INSERT INTO sm_schema_versions VALUES('probe', 2)")),
                new PlatformLedgerDamage(
                        "missing-check",
                        "CREATE TABLE sm_schema_versions(owner TEXT PRIMARY KEY, version INTEGER NOT NULL)",
                        List.of("INSERT INTO sm_schema_versions VALUES('probe', 1)")),
                new PlatformLedgerDamage(
                        "extra-column",
                        "CREATE TABLE sm_schema_versions(owner TEXT PRIMARY KEY, "
                                + "version INTEGER NOT NULL CHECK(version >= 0), note TEXT)",
                        List.of("INSERT INTO sm_schema_versions(owner, version) VALUES('probe', 1)")),
                new PlatformLedgerDamage(
                        "after-insert-trigger",
                        "CREATE TABLE sm_schema_versions(owner TEXT PRIMARY KEY, "
                                + "version INTEGER NOT NULL CHECK(version >= 0))",
                        List.of(
                                "INSERT INTO sm_schema_versions VALUES('probe', 1)",
                                "CREATE TRIGGER arbitrary_ledger_trigger AFTER INSERT "
                                        + "ON sm_schema_versions BEGIN SELECT NEW.owner; END")));

        for (PlatformLedgerDamage damage : damages) {
            Path databasePath = temporaryDirectory.resolve(damage.name() + ".db");
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                 var statement = connection.createStatement()) {
                statement.execute("PRAGMA user_version = 1");
                statement.execute(damage.createTableSql());
                for (String sql : damage.seedSql()) {
                    statement.execute(sql);
                }
            }
            byte[] before = Files.readAllBytes(databasePath);
            AtomicInteger ownerInspections = new AtomicInteger();
            try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
                database.featureStore(FeatureStoreDefinition.validated(
                        "probe", connection -> ownerInspections.incrementAndGet()));
                assertEquals(
                        FeatureStoreReadiness.CORRUPT,
                        database.prepareRegisteredStores().get("probe"),
                        damage.name());
            }
            assertEquals(0, ownerInspections.get(), damage.name());
            assertArrayEquals(before, Files.readAllBytes(databasePath), damage.name());
            assertDatabaseSidecarsAbsent(databasePath);
        }
    }

    @Test
    void pendingPartialOwnerIsRejectedOnDisposableCopyBeforeAnySourceWrite() throws Exception {
        Path databasePath = temporaryDirectory.resolve("pending-partial-owner.db");
        String targetTable = "CREATE TABLE partial_owner_rows("
                + "id INTEGER PRIMARY KEY, value TEXT NOT NULL)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE partial_owner_rows(id INTEGER PRIMARY KEY)");
            statement.execute("INSERT INTO partial_owner_rows VALUES(7)");
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "partial-owner",
                SqliteSchemaValidator.exactSchema(
                        List.of(targetTable), List.of(), List.of("partial_owner_"), List.of()),
                new SqliteMigration(1, connection -> connection.createStatement().execute(targetTable)));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("partial-owner"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
    }

    @Test
    void newerSingleOwnerIsRejectedReadOnlyWithoutSourceSideEffects() throws Exception {
        Path databasePath = temporaryDirectory.resolve("newer-single-owner.db");
        String table = "CREATE TABLE newer_single_rows(id INTEGER PRIMARY KEY)";
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            TestFeatureStores.createCurrentOwnerLedger(statement, "newer-single", 2);
            statement.execute(table);
        }
        byte[] before = Files.readAllBytes(databasePath);
        FeatureStoreDefinition definition = FeatureStoreDefinition.validated(
                "newer-single",
                SqliteSchemaValidator.exactSchema(
                        List.of(table), List.of(), List.of("newer_single_"), List.of()),
                new SqliteMigration(1, connection -> connection.createStatement().execute(table)));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            database.featureStore(definition);
            assertEquals(
                    FeatureStoreReadiness.NEWER_SCHEMA,
                    database.prepareRegisteredStores().get("newer-single"));
        }

        assertArrayEquals(before, Files.readAllBytes(databasePath));
        assertDatabaseSidecarsAbsent(databasePath);
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
    void versionedBackupIncludesCommittedWalStateFromQuiescentSourceFamily() throws Exception {
        Path databasePath = temporaryDirectory.resolve("wal.db");
        SqliteMigration migration = seedMigration();
        SqliteDatabase writerLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
        try (var writer =
                TestFeatureStores.store(writerLifecycle, "seed", migration).openConnection()) {
            writer.createStatement().execute("PRAGMA wal_autocheckpoint = 0");
            writer.createStatement().execute("INSERT INTO recovery_data(id, value) VALUES(1, 'from-wal')");
            writer.createStatement().execute(
                    "INSERT INTO recovery_data(id, value) VALUES(2, 'committed-in-wal')");
            Path wal = databasePath.resolveSibling(databasePath.getFileName() + "-wal");
            Path shm = databasePath.resolveSibling(databasePath.getFileName() + "-shm");
            assertTrue(Files.size(wal) > 32L);
            assertTrue(Files.size(shm) > 0L);

            try (SqliteDatabase backupLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
                 var reader = TestFeatureStores.stores(
                         backupLifecycle,
                         definition("seed", migration),
                         backupTriggerDefinition()).get("seed").openConnection()) {
                assertEquals("from-wal", storedValue(reader));
                assertEquals("committed-in-wal", storedValue(reader, 2));
            }
        }
        writerLifecycle.close();

        Files.write(databasePath, new byte[] {0x55, 0x66});
        try (SqliteDatabase recovered = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection =
                        TestFeatureStores.store(recovered, "seed", migration).openConnection()) {
            assertEquals("from-wal", storedValue(connection));
            assertEquals("committed-in-wal", storedValue(connection, 2));
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
    void rollbackJournalQuarantineMoveFailureRestoresEveryAlreadyMovedFile() throws Exception {
        Path databasePath = temporaryDirectory.resolve("rollback-journal-move.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        Path backup = databasePath.resolveSibling(databasePath.getFileName() + ".backup-v1.sqlite");
        createPendingMigrationBackup(databasePath, migration);
        assertTrue(Files.isRegularFile(backup));

        Path journal = createHotRollbackJournal(databasePath);
        byte[] originalJournal = Files.readAllBytes(journal);
        byte[] corruptPrimary = corruptHeader(databasePath);
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics, (source, target) -> {
            if (source.equals(journal)) {
                throw new IOException("injected sidecar move failure");
            }
            Files.move(source, target);
        });

        assertThrows(SQLException.class,
                () -> TestFeatureStores.store(database, "seed", migration).openConnection());

        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
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
    void recoveryRejectsBackupWithMalformedPlatformManifestBeforeQuarantine() throws Exception {
        Path databasePath = temporaryDirectory.resolve("malformed-platform-backup.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        createPendingMigrationBackup(databasePath, migration);
        Path backup = databasePath.resolveSibling(
                databasePath.getFileName() + ".backup-v1.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup);
             var statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER unexpected_platform_backup "
                    + "AFTER INSERT ON sm_schema_versions BEGIN SELECT NEW.version; END");
        }
        byte[] malformedBackup = Files.readAllBytes(backup);
        byte[] corruptPrimary = corruptHeader(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle handle = TestFeatureStores.store(database, "seed", migration);
            FeatureStoreUnavailableException unavailable = assertThrows(
                    FeatureStoreUnavailableException.class, handle::openConnection);
            assertEquals(FeatureStoreReadiness.CORRUPT, unavailable.readiness());
        }

        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
        assertArrayEquals(malformedBackup, Files.readAllBytes(backup));
        assertDatabaseSidecarsAbsent(databasePath);
        assertNoQuarantine(databasePath);
    }

    @Test
    void recoveryRejectsBackupWithCurrentOwnerTriggerBeforeQuarantine() throws Exception {
        Path databasePath = temporaryDirectory.resolve("malformed-owner-backup.db");
        SqliteMigration migration = seedMigration();
        createSeedDatabase(databasePath, migration);
        createPendingMigrationBackup(databasePath, migration);
        Path backup = databasePath.resolveSibling(
                databasePath.getFileName() + ".backup-v1.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + backup);
             var statement = connection.createStatement()) {
            statement.execute("CREATE TRIGGER unexpected_owner_backup "
                    + "AFTER INSERT ON recovery_data BEGIN SELECT NEW.id; END");
        }
        byte[] malformedBackup = Files.readAllBytes(backup);
        byte[] corruptPrimary = corruptHeader(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { })) {
            FeatureStoreHandle handle = TestFeatureStores.store(database, exactSeedDefinition());
            FeatureStoreUnavailableException unavailable = assertThrows(
                    FeatureStoreUnavailableException.class, handle::openConnection);
            assertEquals(FeatureStoreReadiness.CORRUPT, unavailable.readiness());
        }

        assertArrayEquals(corruptPrimary, Files.readAllBytes(databasePath));
        assertArrayEquals(malformedBackup, Files.readAllBytes(backup));
        assertDatabaseSidecarsAbsent(databasePath);
        assertNoQuarantine(databasePath);
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

    @Test
    void existingOnlyRejectsMissingEmptyDamagedAndSymbolicFilesWithoutMutation() throws Exception {
        Path missing = temporaryDirectory.resolve("missing.sqlite");
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(missing, SqliteDatabase.OpenMode.EXISTING_ONLY));
        assertFalse(Files.exists(missing));

        Path empty = temporaryDirectory.resolve("empty.sqlite");
        Files.createFile(empty);
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(empty, SqliteDatabase.OpenMode.EXISTING_ONLY));
        assertEquals(0L, Files.size(empty));

        Path damaged = temporaryDirectory.resolve("damaged.sqlite");
        byte[] damagedBytes = "not-a-sqlite-campaign".getBytes(StandardCharsets.UTF_8);
        Files.write(damaged, damagedBytes);
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(damaged, SqliteDatabase.OpenMode.EXISTING_ONLY));
        assertArrayEquals(damagedBytes, Files.readAllBytes(damaged));

        Path target = temporaryDirectory.resolve("target.sqlite");
        Files.write(target, damagedBytes);
        Path symbolic = temporaryDirectory.resolve("symbolic.sqlite");
        Files.createSymbolicLink(symbolic, target.getFileName());
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(symbolic, SqliteDatabase.OpenMode.EXISTING_ONLY));
        assertTrue(Files.isSymbolicLink(symbolic));
        assertArrayEquals(damagedBytes, Files.readAllBytes(target));
    }

    @Test
    void reservedNewRequiresAnOwnedEmptyFileAndExistingOnlyReopensItsResult() throws Exception {
        Path reserved = temporaryDirectory.resolve("reserved.sqlite");
        Files.createFile(reserved);
        assertEquals(
                FeatureStoreReadiness.READY,
                readiness(reserved, SqliteDatabase.OpenMode.RESERVED_NEW));
        byte[] created = Files.readAllBytes(reserved);
        assertTrue(created.length > 0);

        assertEquals(
                FeatureStoreReadiness.READY,
                readiness(reserved, SqliteDatabase.OpenMode.EXISTING_ONLY));
        assertTrue(Files.size(reserved) >= created.length);
    }

    @Test
    void ownedOpenModesRejectSymbolicRootAndIntermediateAncestorWithoutTouchingTarget()
            throws Exception {
        Path physicalRoot = temporaryDirectory.resolve("physical-root");
        Path outside = temporaryDirectory.resolve("outside");
        Files.createDirectories(physicalRoot);
        Files.createDirectories(outside);
        Path physicalDatabase = outside.resolve("campaign.sqlite");
        Files.createFile(physicalDatabase);
        assertEquals(
                FeatureStoreReadiness.READY,
                readiness(
                        physicalDatabase,
                        SqliteDatabase.OpenMode.RESERVED_NEW,
                        outside));
        byte[] original = Files.readAllBytes(physicalDatabase);

        Path symbolicRoot = temporaryDirectory.resolve("symbolic-root");
        Files.createSymbolicLink(symbolicRoot, physicalRoot);
        Path rootedPath = symbolicRoot.resolve("campaign.sqlite");
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(rootedPath, SqliteDatabase.OpenMode.EXISTING_ONLY, symbolicRoot));
        assertFalse(Files.exists(rootedPath, java.nio.file.LinkOption.NOFOLLOW_LINKS));

        Path symbolicCampaign = physicalRoot.resolve("campaign-id");
        Files.createSymbolicLink(symbolicCampaign, outside);
        Path throughAncestor = symbolicCampaign.resolve("campaign.sqlite");
        assertEquals(
                FeatureStoreReadiness.CORRUPT,
                readiness(throughAncestor, SqliteDatabase.OpenMode.EXISTING_ONLY, physicalRoot));
        assertArrayEquals(original, Files.readAllBytes(physicalDatabase));
    }

    private static FeatureStoreReadiness readiness(Path path, SqliteDatabase.OpenMode mode) {
        return readiness(path, mode, path.toAbsolutePath().normalize().getParent());
    }

    private static FeatureStoreReadiness readiness(
            Path path,
            SqliteDatabase.OpenMode mode,
            Path ownershipRoot
    ) {
        try (SqliteDatabase database = new SqliteDatabase(
                path, (id, type) -> { }, mode, ownershipRoot)) {
            database.featureStore(definition("open-mode", new SqliteMigration(
                    1, connection -> connection.createStatement().execute(
                            "CREATE TABLE open_mode_probe(value INTEGER NOT NULL)"))));
            return database.prepareRegisteredStores().get("open-mode");
        }
    }

    private static SqliteMigration seedMigration() {
        return new SqliteMigration(1, connection -> connection.createStatement()
                .execute(SEED_TABLE_SQL));
    }

    private static FeatureStoreDefinition exactSeedDefinition() {
        return FeatureStoreDefinition.validated(
                "seed",
                SqliteSchemaValidator.exactSchema(
                        List.of(SEED_TABLE_SQL),
                        List.of(),
                        List.of("recovery_"),
                        List.of()),
                seedMigration());
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

    private static DatabaseSemanticSnapshot semanticSnapshot(java.sql.Connection connection)
            throws SQLException {
        List<SchemaEntry> schema = new ArrayList<>();
        try (var result = connection.createStatement().executeQuery(
                "SELECT type, name, tbl_name, COALESCE(sql, '') FROM sqlite_master"
                        + " ORDER BY type, name, tbl_name")) {
            while (result.next()) {
                schema.add(new SchemaEntry(
                        result.getString(1),
                        result.getString(2),
                        result.getString(3),
                        result.getString(4)));
            }
        }
        List<SchemaVersionEntry> schemaVersions = new ArrayList<>();
        try (var result = connection.createStatement().executeQuery(
                "SELECT owner, version FROM sm_schema_versions ORDER BY owner")) {
            while (result.next()) {
                schemaVersions.add(new SchemaVersionEntry(result.getString(1), result.getInt(2)));
            }
        }
        List<PayloadEntry> payload = new ArrayList<>();
        try (var result = connection.createStatement().executeQuery(
                "SELECT id, value FROM recovery_data ORDER BY id")) {
            while (result.next()) {
                payload.add(new PayloadEntry(result.getInt(1), result.getString(2)));
            }
        }
        return new DatabaseSemanticSnapshot(
                List.copyOf(schema),
                List.copyOf(schemaVersions),
                pragmaInt(connection, "PRAGMA user_version"),
                List.copyOf(payload));
    }

    private static boolean tableExists(java.sql.Connection connection, String tableName)
            throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, tableName);
            try (var result = statement.executeQuery()) {
                return result.next() && result.getInt(1) != 0;
            }
        }
    }

    private static void assertDatabaseSidecarsAbsent(Path databasePath) {
        assertFalse(Files.exists(databasePath.resolveSibling(databasePath.getFileName() + "-wal")));
        assertFalse(Files.exists(databasePath.resolveSibling(databasePath.getFileName() + "-shm")));
        assertFalse(Files.exists(databasePath.resolveSibling(databasePath.getFileName() + "-journal")));
    }

    private void assertNoQuarantine(Path databasePath) throws IOException {
        try (var files = Files.list(temporaryDirectory)) {
            assertFalse(files.anyMatch(path -> path.getFileName().toString()
                    .startsWith(databasePath.getFileName() + ".corrupt-")));
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

    private record DatabaseSemanticSnapshot(
            List<SchemaEntry> schema,
            List<SchemaVersionEntry> schemaVersions,
            int userVersion,
            List<PayloadEntry> payload) { }

    private record SchemaEntry(String type, String name, String tableName, String sql) { }

    private record SchemaVersionEntry(String owner, int version) { }

    private record PayloadEntry(int id, String value) { }

    private record PlatformLedgerDamage(
            String name,
            String createTableSql,
            List<String> seedSql
    ) { }
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
            statement.execute("PRAGMA cache_spill = 1");
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

final class WalWriteProbeCrashProcess {

    private WalWriteProbeCrashProcess() { }

    public static void main(String[] arguments) throws Exception {
        Class.forName("org.sqlite.JDBC");
        Path databasePath = Path.of(arguments[0]);
        var connection = DriverManager.getConnection(
                "jdbc:sqlite:" + databasePath.toAbsolutePath().normalize());
        try (var statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = 5000");
            try (var mode = statement.executeQuery("PRAGMA journal_mode = WAL")) {
                if (!mode.next() || !"wal".equalsIgnoreCase(mode.getString(1))) {
                    throw new SQLException("SQLite WAL mode is unavailable.");
                }
            }
            statement.execute("PRAGMA synchronous = NORMAL");
            statement.execute("PRAGMA cache_size = 1");
            statement.execute("PRAGMA cache_spill = ON");
        }
        connection.setAutoCommit(false);
        try (var statement = connection.createStatement()) {
            statement.execute(
                    "CREATE TABLE sm_runtime_write_probe (probe_value INTEGER NOT NULL)");
            if (statement.executeUpdate(
                    "INSERT INTO sm_runtime_write_probe(probe_value) VALUES (1)") != 1) {
                throw new SQLException("SQLite write probe did not insert exactly one row.");
            }
            try (var result = statement.executeQuery(
                    "SELECT probe_value FROM sm_runtime_write_probe")) {
                if (!result.next() || result.getInt(1) != 1 || result.next()) {
                    throw new SQLException("SQLite write probe readback was not exact.");
                }
            }
        }
        // The production probe normally rolls back before its tiny transaction needs a WAL frame.
        // Add test-only rows after the exact readback so a hard halt exercises recovery from
        // materially written, still-uncommitted frames in the same probe-table transaction.
        try (var pressure = connection.prepareStatement(
                "INSERT INTO sm_runtime_write_probe(probe_value) VALUES (?)")) {
            for (int value = 2; value <= 8_192; value++) {
                pressure.setInt(1, value);
                pressure.addBatch();
            }
            pressure.executeBatch();
        }
        Runtime.getRuntime().halt(0);
    }
}
