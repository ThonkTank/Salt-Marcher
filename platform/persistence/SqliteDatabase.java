package platform.persistence;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
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
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;

public final class SqliteDatabase implements AutoCloseable {

    public static final String DEFAULT_DATABASE_FILE_NAME = "game.db";

    private static final int PLATFORM_SCHEMA_VERSION = 1;
    private static final int BUSY_TIMEOUT_MILLIS = 5_000;
    private static final String APP_DATA_DIR_NAME = "salt-marcher";
    private static final String MIGRATIONS_TABLE = "sm_schema_versions";
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
    private final Map<String, List<SqliteMigration>> migrationPlans = new LinkedHashMap<>();
    private boolean prepared;
    private boolean closed;

    public SqliteDatabase(Path databasePath, Diagnostics diagnostics) {
        this.databasePath = Objects.requireNonNull(databasePath, "databasePath").toAbsolutePath().normalize();
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
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
        Connection connection = openConfigured(databasePath);
        try {
            migrate(connection, registeredPlans());
            return connection;
        } catch (SQLException | RuntimeException exception) {
            connection.close();
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw exception;
        }
    }

    private void prepareExistingDatabase() throws SQLException {
        try {
            assertPhysicalIntegrity(databasePath);
        } catch (SQLException exception) {
            diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
            recoverFromLatestBackup(exception);
            return;
        }
        int version = platformVersion(databasePath);
        if (version > PLATFORM_SCHEMA_VERSION) {
            throw new SQLException("SQLite platform schema is newer than this application.");
        }
        try {
            assertForeignKeys(databasePath);
        } catch (SQLException exception) {
            diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
            throw exception;
        }
        createVerifiedBackup(version);
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

    private void createVerifiedBackup(int version) throws SQLException {
        Path target = backupPath(version);
        Path temporary = sibling(target.getFileName() + ".tmp");
        deleteIfExists(temporary);
        try (Connection connection = openConfigured(databasePath);
             Statement statement = connection.createStatement()) {
            statement.execute("VACUUM INTO '" + sqliteLiteral(temporary) + "'");
        }
        assertIntegrity(temporary);
        replaceAtomically(temporary, target);
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
                return candidate;
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
        Files.move(databasePath, quarantine, StandardCopyOption.REPLACE_EXISTING);
        moveIfExists(walPath(databasePath), sibling(quarantine.getFileName() + "-wal"));
        moveIfExists(shmPath(databasePath), sibling(quarantine.getFileName() + "-shm"));
    }

    private void restoreQuarantinedPrimary(Path quarantine) throws IOException {
        deleteIfExists(databasePath);
        moveIfExists(quarantine, databasePath);
        moveIfExists(sibling(quarantine.getFileName() + "-wal"), walPath(databasePath));
        moveIfExists(sibling(quarantine.getFileName() + "-shm"), shmPath(databasePath));
    }

    private static void moveIfExists(Path source, Path target) throws IOException {
        if (Files.exists(source)) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
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
        try (Connection connection = openConfigured(path)) {
            assertConnectionPhysicalIntegrity(connection);
        }
    }

    private static void assertForeignKeys(Path path) throws SQLException {
        try (Connection connection = openConfigured(path)) {
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
        try (Connection connection = openConfigured(path)) {
            return pragmaInt(connection, "PRAGMA user_version");
        }
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

    private static void deleteIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A later create/move operation reports the actionable failure without exposing the path.
        }
    }
}
