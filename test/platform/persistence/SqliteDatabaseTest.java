package platform.persistence;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

final class SqliteDatabaseTest {

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
    void configuresConnectionsAndRunsVersionedMigrationExactlyOnce() throws Exception {
        Path databasePath = temporaryDirectory.resolve("game.db");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        AtomicInteger migrations = new AtomicInteger();
        SqliteMigration migration = new SqliteMigration(1, connection -> {
            migrations.incrementAndGet();
            connection.createStatement().execute("CREATE TABLE owned_data(id INTEGER PRIMARY KEY, value TEXT)");
        });
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);
        SqliteConnectionSource source = database.connections("test-feature", migration);

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
    void runsEveryRegisteredFeaturePlanOnceInRegistrationOrder() throws Exception {
        Path databasePath = temporaryDirectory.resolve("ordered.db");
        List<String> order = new ArrayList<>();
        SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
        SqliteConnectionSource first = database.connections(
                "first", new SqliteMigration(1, connection -> order.add("first")));
        database.connections("second", new SqliteMigration(1, connection -> order.add("second")));

        try (var ignored = first.openConnection()) {
            assertEquals(List.of("first", "second"), order);
        }
        try (var ignored = first.openConnection()) {
            assertEquals(List.of("first", "second"), order);
        }
    }

    @Test
    void migrationFailureRollsBackSchemaAndVersion() throws Exception {
        Path databasePath = temporaryDirectory.resolve("rollback.db");
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);
        SqliteConnectionSource source = database.connections("broken", new SqliteMigration(1, connection -> {
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

        try (SqliteDatabase backupLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection = backupLifecycle.connections("seed", migration).openConnection()) {
            assertEquals("kept", storedValue(connection));
        }
        Path backup = temporaryDirectory.resolve("recover.db.backup-v1.sqlite");
        assertTrue(Files.isRegularFile(backup));

        Files.write(databasePath, new byte[] {0x13, 0x37, 0x01, 0x02});
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        try (SqliteDatabase recovered = new SqliteDatabase(databasePath, diagnostics);
             var connection = recovered.connections("seed", migration).openConnection()) {
            assertEquals("kept", storedValue(connection));
        }

        assertEquals(List.of("persistence.integrity-failure"), diagnostics.ids);
        try (var files = Files.list(temporaryDirectory)) {
            assertTrue(files.anyMatch(path -> path.getFileName().toString().startsWith("recover.db.corrupt-")));
        }
    }

    @Test
    void versionedBackupIncludesCommittedWalState() throws Exception {
        Path databasePath = temporaryDirectory.resolve("wal.db");
        SqliteMigration migration = seedMigration();
        SqliteDatabase writerLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
        try (var writer = writerLifecycle.connections("seed", migration).openConnection()) {
            writer.createStatement().execute("INSERT INTO recovery_data(id, value) VALUES(1, 'from-wal')");

            try (SqliteDatabase backupLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
                 var reader = backupLifecycle.connections("seed", migration).openConnection()) {
                assertEquals("from-wal", storedValue(reader));
            }
        }
        writerLifecycle.close();

        Files.write(databasePath, new byte[] {0x55, 0x66});
        try (SqliteDatabase recovered = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection = recovered.connections("seed", migration).openConnection()) {
            assertEquals("from-wal", storedValue(connection));
        }
    }

    @Test
    void corruptionWithoutBackupFailsClosedAndLeavesPrimaryUntouched() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unrecoverable.db");
        byte[] corrupt = new byte[] {0x01, 0x02, 0x03, 0x04};
        Files.write(databasePath, corrupt);
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);

        assertThrows(SQLException.class,
                () -> database.connections("seed", seedMigration()).openConnection());

        assertArrayEquals(corrupt, Files.readAllBytes(databasePath));
        assertEquals(
                List.of("persistence.integrity-failure", "persistence.recovery-failure"),
                diagnostics.ids);
    }

    @Test
    void foreignKeyViolationFailsClosedWithoutRestoringOlderBackup() throws Exception {
        Path databasePath = temporaryDirectory.resolve("logical-inconsistency.db");
        SqliteMigration migration = new SqliteMigration(1, connection -> {
            connection.createStatement().execute("CREATE TABLE parent(id INTEGER PRIMARY KEY)");
            connection.createStatement().execute(
                    "CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL "
                            + "REFERENCES parent(id))");
        });
        try (SqliteDatabase initial = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection = initial.connections("seed", migration).openConnection()) {
            connection.createStatement().execute("INSERT INTO parent(id) VALUES(1)");
        }
        try (SqliteDatabase backupLifecycle = new SqliteDatabase(databasePath, (id, type) -> { });
             var ignored = backupLifecycle.connections("seed", migration).openConnection()) {
            assertTrue(Files.isRegularFile(
                    temporaryDirectory.resolve("logical-inconsistency.db.backup-v1.sqlite")));
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            connection.createStatement().execute("PRAGMA foreign_keys = OFF");
            connection.createStatement().execute("INSERT INTO child(id, parent_id) VALUES(1, 999)");
        }
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        SqliteDatabase database = new SqliteDatabase(databasePath, diagnostics);

        assertThrows(SQLException.class,
                () -> database.connections("seed", migration).openConnection());

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

        assertThrows(SQLException.class,
                () -> database.connections("seed", seedMigration()).openConnection());

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
                () -> database.connections("seed", migration).openConnection());

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var result = connection.createStatement().executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner='seed'")) {
            assertTrue(result.next());
            assertEquals(2, result.getInt(1));
        }
    }

    private void createSeedDatabase(Path databasePath, SqliteMigration migration) throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(databasePath, (id, type) -> { });
             var connection = database.connections("seed", migration).openConnection()) {
            connection.createStatement().execute("INSERT INTO recovery_data(id, value) VALUES(1, 'kept')");
        }
    }

    private static SqliteMigration seedMigration() {
        return new SqliteMigration(1, connection -> connection.createStatement()
                .execute("CREATE TABLE recovery_data(id INTEGER PRIMARY KEY, value TEXT NOT NULL)"));
    }

    private static String storedValue(java.sql.Connection connection) throws SQLException {
        try (var result = connection.createStatement().executeQuery(
                "SELECT value FROM recovery_data WHERE id=1")) {
            return result.next() ? result.getString(1) : "";
        }
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
