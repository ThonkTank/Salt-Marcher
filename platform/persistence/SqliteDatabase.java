package platform.persistence;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Collections;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.sqlite.SQLiteConfig;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

public final class SqliteDatabase implements AutoCloseable {

    public static final String DEFAULT_DATABASE_FILE_NAME = "game.db";

    private static final int PLATFORM_SCHEMA_VERSION = 1;
    private static final int BUSY_TIMEOUT_MILLIS = 5_000;
    private static final String APP_DATA_DIR_NAME = "salt-marcher";
    private static final String MIGRATIONS_TABLE = "sm_schema_versions";
    private static final byte[] SQLITE_HEADER = "SQLite format 3\0".getBytes(StandardCharsets.US_ASCII);
    private static final Pattern OWNER_PATTERN = Pattern.compile("[a-z][a-z0-9-]*");
    private static final Pattern BACKUP_VERSION_PATTERN = Pattern.compile(".*\\.backup-v(\\d+)\\.sqlite");
    private static final DiagnosticId INTEGRITY_FAILURE =
            new DiagnosticId("persistence.integrity-failure");
    private static final DiagnosticId RECOVERY_FAILURE =
            new DiagnosticId("persistence.recovery-failure");
    private static final DiagnosticId MIGRATION_FAILURE =
            new DiagnosticId("persistence.migration-failure");

    private final Path databasePath;
    private final Diagnostics diagnostics;
    private final FileMover fileMover;
    private final Map<String, List<SqliteMigration>> migrationPlans = new LinkedHashMap<>();
    private boolean prepared;
    private boolean closed;

    public SqliteDatabase(Path databasePath, Diagnostics diagnostics) {
        this(databasePath, diagnostics, SqliteDatabase::moveReplacing);
    }

    SqliteDatabase(Path databasePath, Diagnostics diagnostics, FileMover fileMover) {
        this.databasePath = Objects.requireNonNull(databasePath, "databasePath").toAbsolutePath().normalize();
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        this.fileMover = Objects.requireNonNull(fileMover, "fileMover");
    }

    public static SqliteDatabase defaultDatabase(String fileName, Diagnostics diagnostics) {
        return new SqliteDatabase(resolveDatabasePath(fileName), diagnostics);
    }

    public static Path resolveDatabasePath(String fileName) {
        return resolveDatabasePath(fileName, System.getenv("XDG_DATA_HOME"), System.getProperty("user.home"));
    }

    static Path resolveDatabasePath(String fileName, String xdgDataHome, String userHome) {
        String safeFileName = Objects.requireNonNull(fileName, "fileName");
        if (safeFileName.isBlank() || Path.of(safeFileName).getNameCount() != 1) {
            throw new IllegalArgumentException("database file name must be one path segment");
        }
        Path dataHome = xdgDataHome != null && !xdgDataHome.isBlank()
                ? Path.of(xdgDataHome)
                : Path.of(Objects.requireNonNull(userHome, "userHome"), ".local", "share");
        return dataHome.resolve(APP_DATA_DIR_NAME).resolve(safeFileName).toAbsolutePath().normalize();
    }

    public Path databasePath() {
        return databasePath;
    }

    /**
     * Creates and restore-tests a durable snapshot before an explicit maintenance operation.
     * Callers still own their feature transaction; this method only establishes a verified
     * recovery point for the complete database without exposing its local path.
     */
    public synchronized MaintenanceBackup createVerifiedMaintenanceBackup(String owner) throws SQLException {
        String safeOwner = requireOwner(owner);
        prepare();
        if (!Files.isRegularFile(databasePath) || fileSize(databasePath) == 0L) {
            throw new SQLException("SQLite maintenance backup requires an initialized database.");
        }

        Path snapshot = null;
        Path restoreProbe = null;
        try {
            snapshot = createVacuumSnapshot(databasePath);
            assertIntegrity(snapshot);
            restoreProbe = snapshot.resolveSibling("restore-probe.db");
            Files.copy(snapshot, restoreProbe, StandardCopyOption.REPLACE_EXISTING);
            assertIntegrity(restoreProbe);

            Instant createdAt = Instant.now();
            Path target = sibling(databasePath.getFileName()
                    + ".maintenance-" + safeOwner + "-" + createdAt.toEpochMilli() + ".sqlite");
            replaceAtomically(snapshot, target);
            snapshot = null;
            assertIntegrity(target);
            return new MaintenanceBackup(safeOwner, createdAt);
        } catch (IOException exception) {
            throw new SQLException("Could not create SQLite maintenance backup.", exception);
        } finally {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            } else if (restoreProbe != null) {
                deletePreflightSnapshot(restoreProbe);
            }
        }
    }

    public synchronized SqliteConnectionSource connections(String owner, SqliteMigration... migrations) {
        String safeOwner = requireOwner(owner);
        List<SqliteMigration> plan = normalizedPlan(migrations);
        List<SqliteMigration> existing = migrationPlans.get(safeOwner);
        if (existing != null && !versions(existing).equals(versions(plan))) {
            throw new IllegalArgumentException("migration owner registered with a different version plan");
        }
        migrationPlans.putIfAbsent(safeOwner, plan);
        return this::openConnection;
    }

    public synchronized void prepare() throws SQLException {
        requireOpen();
        if (prepared) {
            return;
        }
        loadDriver();
        createParentDirectory();
        if (Files.isRegularFile(databasePath) && fileSize(databasePath) > 0L) {
            prepareExistingDatabase();
        }
        prepared = true;
    }

    @Override
    public synchronized void close() {
        closed = true;
    }

    private Connection openConnection() throws SQLException {
        prepare();
        synchronized (this) {
            requireOpen();
        }
        Connection connection = null;
        try {
            // Connection setup changes WAL mode and may execute idempotent DDL or feature
            // migrations. Serialize only that initialization window for this database lifecycle;
            // returned connections and their feature transactions remain independently concurrent.
            synchronized (this) {
                requireOpen();
                connection = openConfigured(databasePath);
                migrate(connection, registeredPlans());
            }
            return connection;
        } catch (SQLException | RuntimeException exception) {
            if (connection != null) {
                connection.close();
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw exception;
        }
    }

    private void prepareExistingDatabase() throws SQLException {
        Path snapshot = null;
        try {
            try {
                assertSQLiteHeader(databasePath);
                snapshot = createPreflightSnapshot();
                assertPhysicalIntegrity(snapshot);
            } catch (PreflightLockUnavailableException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                throw exception;
            } catch (SQLException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                recoverFromLatestBackup(exception);
                return;
            }
            int version = platformVersion(snapshot);
            if (version > PLATFORM_SCHEMA_VERSION) {
                throw new SQLException("SQLite platform schema is newer than this application.");
            }
            try {
                assertForeignKeys(snapshot);
            } catch (SQLException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                throw exception;
            }
            promoteVerifiedBackup(version, snapshot);
            snapshot = null;
        } finally {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
        }
    }

    private void migrate(Connection connection, Map<String, List<SqliteMigration>> plans) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            ensurePlatformMetadata(connection);
            for (Map.Entry<String, List<SqliteMigration>> entry : plans.entrySet()) {
                String owner = entry.getKey();
                List<SqliteMigration> plan = entry.getValue();
                int storedVersion = storedFeatureVersion(connection, owner);
                int supportedVersion = plan.isEmpty() ? 0 : plan.getLast().version();
                if (storedVersion > supportedVersion) {
                    throw new SQLException("SQLite feature schema is newer than this application.");
                }
                for (SqliteMigration migration : plan) {
                    if (migration.version() > storedVersion) {
                        migration.action().apply(connection);
                        storeFeatureVersion(connection, owner, migration.version());
                    }
                }
            }
            assertConnectionIntegrity(connection);
            connection.commit();
        } catch (SQLException | RuntimeException exception) {
            rollback(connection, exception);
            diagnostics.failure(MIGRATION_FAILURE, exception.getClass());
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("SQLite migration failed.", exception);
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private void ensurePlatformMetadata(Connection connection) throws SQLException {
        int version = pragmaInt(connection, "PRAGMA user_version");
        if (version > PLATFORM_SCHEMA_VERSION) {
            throw new SQLException("SQLite platform schema is newer than this application.");
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS " + MIGRATIONS_TABLE
                    + " (owner TEXT PRIMARY KEY, version INTEGER NOT NULL CHECK(version >= 0))");
            if (version < PLATFORM_SCHEMA_VERSION) {
                statement.execute("PRAGMA user_version = " + PLATFORM_SCHEMA_VERSION);
            }
        }
    }

    private static int storedFeatureVersion(Connection connection, String owner) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT version FROM " + MIGRATIONS_TABLE + " WHERE owner=?")) {
            statement.setString(1, owner);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getInt(1) : 0;
            }
        }
    }

    private static void storeFeatureVersion(Connection connection, String owner, int version) throws SQLException {
        try (var statement = connection.prepareStatement(
                "INSERT INTO " + MIGRATIONS_TABLE + "(owner, version) VALUES(?, ?) "
                        + "ON CONFLICT(owner) DO UPDATE SET version=excluded.version")) {
            statement.setString(1, owner);
            statement.setInt(2, version);
            statement.executeUpdate();
        }
    }

    private void promoteVerifiedBackup(int version, Path snapshot) throws SQLException {
        Path target = backupPath(version);
        replaceAtomically(snapshot, target);
        deletePreflightSnapshot(snapshot);
    }

    private void recoverFromLatestBackup(SQLException originalFailure) throws SQLException {
        Path backup = latestValidBackup();
        if (backup == null) {
            diagnostics.failure(RECOVERY_FAILURE, originalFailure.getClass());
            throw originalFailure;
        }
        Path recovered = sibling(databasePath.getFileName() + ".recovery.tmp");
        deleteIfExists(recovered);
        try {
            Files.copy(backup, recovered, StandardCopyOption.REPLACE_EXISTING);
            assertIntegrity(recovered);
            Path quarantine = quarantinePath();
            moveDatabaseFamilyToQuarantine(quarantine);
            try {
                replaceAtomically(recovered, databasePath);
                assertIntegrity(databasePath);
            } catch (SQLException | RuntimeException exception) {
                restoreQuarantinedPrimary(quarantine);
                throw exception;
            }
        } catch (IOException | SQLException exception) {
            diagnostics.failure(RECOVERY_FAILURE, exception.getClass());
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("SQLite recovery failed.", exception);
        } finally {
            deleteIfExists(recovered);
        }
    }

    private Path latestValidBackup() throws SQLException {
        List<Path> candidates = new ArrayList<>();
        Path parent = databasePath.getParent();
        if (parent == null || !Files.isDirectory(parent)) {
            return null;
        }
        String prefix = databasePath.getFileName() + ".backup-v";
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(parent, prefix + "*.sqlite")) {
            for (Path candidate : stream) {
                Matcher matcher = BACKUP_VERSION_PATTERN.matcher(candidate.getFileName().toString());
                if (matcher.matches() && Integer.parseInt(matcher.group(1)) <= PLATFORM_SCHEMA_VERSION) {
                    candidates.add(candidate);
                }
            }
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite backups.", exception);
        }
        candidates.sort(Comparator.comparingInt(SqliteDatabase::backupVersion).reversed());
        for (Path candidate : candidates) {
            try {
                assertIntegrity(candidate);
                int namedVersion = backupVersion(candidate);
                int storedVersion = platformVersion(candidate);
                if (storedVersion == namedVersion && storedVersion <= PLATFORM_SCHEMA_VERSION) {
                    return candidate;
                }
            } catch (SQLException ignored) {
                // Try the next older local backup; diagnostics remain payload-free at the caller boundary.
            }
        }
        return null;
    }

    private static int backupVersion(Path path) {
        Matcher matcher = BACKUP_VERSION_PATTERN.matcher(path.getFileName().toString());
        return matcher.matches() ? Integer.parseInt(matcher.group(1)) : -1;
    }

    private void moveDatabaseFamilyToQuarantine(Path quarantine) throws IOException {
        moveTransaction(List.of(
                new FileMove(databasePath, quarantine),
                new FileMove(walPath(databasePath), sibling(quarantine.getFileName() + "-wal")),
                new FileMove(shmPath(databasePath), sibling(quarantine.getFileName() + "-shm")),
                new FileMove(journalPath(databasePath), sibling(quarantine.getFileName() + "-journal"))));
    }

    private void restoreQuarantinedPrimary(Path quarantine) throws IOException {
        Path failedRecovery = sibling(databasePath.getFileName() + ".recovery-failed.tmp");
        deleteRequiredIfExists(failedRecovery);
        moveTransaction(List.of(
                new FileMove(databasePath, failedRecovery),
                new FileMove(quarantine, databasePath),
                new FileMove(sibling(quarantine.getFileName() + "-wal"), walPath(databasePath)),
                new FileMove(sibling(quarantine.getFileName() + "-shm"), shmPath(databasePath)),
                new FileMove(sibling(quarantine.getFileName() + "-journal"), journalPath(databasePath))));
        deleteRequiredIfExists(failedRecovery);
    }

    private void moveTransaction(List<FileMove> moves) throws IOException {
        List<FileMove> completed = new ArrayList<>();
        try {
            for (FileMove move : moves) {
                if (Files.exists(move.source())) {
                    if (Files.exists(move.target())) {
                        throw new IOException("SQLite move target already exists.");
                    }
                    fileMover.move(move.source(), move.target());
                    completed.add(move);
                }
            }
        } catch (IOException failure) {
            for (int index = completed.size() - 1; index >= 0; index--) {
                FileMove move = completed.get(index);
                try {
                    fileMover.move(move.target(), move.source());
                } catch (IOException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
            }
            throw failure;
        }
    }

    private void assertIntegrity(Path path) throws SQLException {
        assertPhysicalIntegrity(path);
        assertForeignKeys(path);
    }

    private void assertPhysicalIntegrity(Path path) throws SQLException {
        if (!Files.isRegularFile(path) || fileSize(path) == 0L) {
            throw new SQLException("SQLite file is missing or empty.");
        }
        try (Connection connection = openReadOnly(path)) {
            assertConnectionPhysicalIntegrity(connection);
        }
    }

    private static void assertForeignKeys(Path path) throws SQLException {
        try (Connection connection = openReadOnly(path)) {
            assertConnectionForeignKeys(connection);
        }
    }

    private static void assertConnectionIntegrity(Connection connection) throws SQLException {
        assertConnectionPhysicalIntegrity(connection);
        assertConnectionForeignKeys(connection);
    }

    private static void assertConnectionPhysicalIntegrity(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA integrity_check")) {
            if (!result.next() || !"ok".equalsIgnoreCase(result.getString(1)) || result.next()) {
                throw new SQLException("SQLite integrity check failed.");
            }
        }
    }

    private static void assertConnectionForeignKeys(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_check")) {
            if (result.next()) {
                throw new SQLException("SQLite foreign key check failed.");
            }
        }
    }

    private static int platformVersion(Path path) throws SQLException {
        try (Connection connection = openReadOnly(path)) {
            return pragmaInt(connection, "PRAGMA user_version");
        }
    }

    private static Connection openReadOnly(Path path) throws SQLException {
        SQLiteConfig configuration = new SQLiteConfig();
        configuration.setReadOnly(true);
        configuration.setBusyTimeout(BUSY_TIMEOUT_MILLIS);
        return configuration.createConnection("jdbc:sqlite:" + path.toAbsolutePath().normalize());
    }

    private static Connection openConfigured(Path path) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath().normalize());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = " + BUSY_TIMEOUT_MILLIS);
            try (ResultSet mode = statement.executeQuery("PRAGMA journal_mode = WAL")) {
                if (!mode.next() || !"wal".equalsIgnoreCase(mode.getString(1))) {
                    throw new SQLException("SQLite WAL mode is unavailable.");
                }
            }
            statement.execute("PRAGMA synchronous = NORMAL");
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
        return connection;
    }

    private static int pragmaInt(Connection connection, String pragma) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(pragma)) {
            if (!result.next()) {
                throw new SQLException("SQLite pragma did not return a value.");
            }
            return result.getInt(1);
        }
    }

    private Path createPreflightSnapshot() throws SQLException {
        if (Files.isRegularFile(journalPath(databasePath))) {
            return createRollbackJournalSnapshot();
        }
        return createVacuumSnapshot(databasePath);
    }

    private Path createRollbackJournalSnapshot() throws SQLException {
        Path snapshot = null;
        try {
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".rollback-preflight-");
            Path recoveredCopy = directory.resolve("recovered.db");
            snapshot = directory.resolve("snapshot.db");
            copyRollbackFamilyUnderLock(recoveredCopy);
            try (Connection connection = DriverManager.getConnection(
                    "jdbc:sqlite:" + recoveredCopy.toAbsolutePath().normalize())) {
                assertConnectionIntegrity(connection);
                pragmaInt(connection, "PRAGMA user_version");
            }
            vacuumInto(recoveredCopy, snapshot);
            return snapshot;
        } catch (PreflightLockUnavailableException exception) {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            throw exception;
        } catch (IOException | SQLException exception) {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("Could not create SQLite rollback snapshot.", exception);
        }
    }

    private void copyRollbackFamilyUnderLock(Path recoveredCopy)
            throws IOException, PreflightLockUnavailableException {
        try (FileChannel channel = FileChannel.open(
                databasePath, StandardOpenOption.READ, StandardOpenOption.WRITE)) {
            FileLock lock;
            try {
                lock = channel.tryLock();
            } catch (OverlappingFileLockException | IOException exception) {
                throw new PreflightLockUnavailableException(exception);
            }
            if (lock == null) {
                throw new PreflightLockUnavailableException(null);
            }
            try (lock) {
                Path journal = journalPath(databasePath);
                if (!Files.isRegularFile(journal)) {
                    throw new PreflightLockUnavailableException(null);
                }
                Files.copy(databasePath, recoveredCopy);
                Files.copy(journal, journalPath(recoveredCopy));
            }
        }
    }

    private Path createVacuumSnapshot(Path source) throws SQLException {
        Path snapshot = null;
        try {
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".preflight-");
            snapshot = directory.resolve("snapshot.db");
            vacuumInto(source, snapshot);
            return snapshot;
        } catch (IOException | SQLException exception) {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("Could not create SQLite preflight snapshot.", exception);
        }
    }

    private static void vacuumInto(Path source, Path target) throws SQLException {
        try (Connection connection = openReadOnly(source);
             Statement statement = connection.createStatement()) {
            statement.execute("VACUUM INTO '" + sqliteLiteral(target) + "'");
        }
    }

    private static void assertSQLiteHeader(Path path) throws SQLException {
        try (var input = Files.newInputStream(path)) {
            if (!Arrays.equals(SQLITE_HEADER, input.readNBytes(SQLITE_HEADER.length))) {
                throw new SQLException("SQLite header is invalid.");
            }
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite header.", exception);
        }
    }

    private static void deletePreflightSnapshot(Path snapshot) {
        Path directory = snapshot.getParent();
        if (directory == null) {
            return;
        }
        try (var files = Files.walk(directory)) {
            files.sorted(Comparator.reverseOrder()).forEach(SqliteDatabase::deleteIfExists);
        } catch (IOException ignored) {
            // The isolated snapshot never owns persisted application truth.
        }
    }

    private static void rollback(Connection connection, Throwable original) throws SQLException {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
            throw rollbackFailure;
        }
    }

    private static List<SqliteMigration> normalizedPlan(SqliteMigration[] migrations) {
        List<SqliteMigration> plan = new ArrayList<>(Arrays.asList(
                migrations == null ? new SqliteMigration[0] : migrations));
        if (plan.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("migration plan must not contain null");
        }
        plan.sort(Comparator.comparingInt(SqliteMigration::version));
        int expected = 1;
        for (SqliteMigration migration : plan) {
            if (migration.version() != expected++) {
                throw new IllegalArgumentException("migration versions must be contiguous from one");
            }
        }
        return List.copyOf(plan);
    }

    private synchronized Map<String, List<SqliteMigration>> registeredPlans() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(migrationPlans));
    }

    private static List<Integer> versions(List<SqliteMigration> plan) {
        return plan.stream().map(SqliteMigration::version).toList();
    }

    private static String requireOwner(String owner) {
        String safeOwner = Objects.requireNonNull(owner, "owner").toLowerCase(Locale.ROOT);
        if (!OWNER_PATTERN.matcher(safeOwner).matches()) {
            throw new IllegalArgumentException("invalid migration owner");
        }
        return safeOwner;
    }

    private void requireOpen() throws SQLException {
        if (closed) {
            throw new SQLException("SQLite database lifecycle is closed.");
        }
    }

    private static void loadDriver() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("SQLite JDBC driver not available.", exception);
        }
    }

    private void createParentDirectory() throws SQLException {
        try {
            Path parent = databasePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
        } catch (IOException exception) {
            throw new SQLException("Could not prepare SQLite directory.", exception);
        }
    }

    private static long fileSize(Path path) throws SQLException {
        try {
            return Files.size(path);
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite file.", exception);
        }
    }

    private Path backupPath(int version) {
        return sibling(databasePath.getFileName() + ".backup-v" + version + ".sqlite");
    }

    private Path quarantinePath() {
        return sibling(databasePath.getFileName() + ".corrupt-" + Instant.now().toEpochMilli() + ".sqlite");
    }

    private Path sibling(Object fileName) {
        return databasePath.resolveSibling(String.valueOf(fileName));
    }

    private static Path walPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-wal");
    }

    private static Path shmPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-shm");
    }

    private static Path journalPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-journal");
    }

    private static String sqliteLiteral(Path path) {
        return path.toAbsolutePath().normalize().toString().replace("'", "''");
    }

    private static void replaceAtomically(Path source, Path target) throws SQLException {
        try {
            try {
                Files.move(source, target,
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new SQLException("Could not replace SQLite file.", exception);
        }
    }

    private static void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, target);
        }
    }

    private static void deleteRequiredIfExists(Path path) throws IOException {
        Files.deleteIfExists(path);
    }

    private static void deleteIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A later create/move operation reports the actionable failure without exposing the path.
        }
    }

    @FunctionalInterface
    interface FileMover {
        void move(Path source, Path target) throws IOException;
    }

    private record FileMove(Path source, Path target) { }

    public record MaintenanceBackup(String owner, Instant createdAt) {

        public MaintenanceBackup {
            owner = requireOwner(owner);
            createdAt = Objects.requireNonNull(createdAt, "createdAt");
        }
    }

    private static final class PreflightLockUnavailableException extends SQLException {

        private PreflightLockUnavailableException(Throwable cause) {
            super("SQLite preflight lock is unavailable.", cause);
        }
    }
}
