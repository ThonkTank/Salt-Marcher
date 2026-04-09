package database;

import database.setup.SetupObject;
import database.setup.input.SetupDatabaseInput;
import features.partyanalysis.model.AnalysisModelVersion;
import features.party.service.PartyProgressionRules;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class DatabaseManager {

    private static final Logger LOGGER = Logger.getLogger(DatabaseManager.class.getName());
    private static final String APP_DATA_DIR_NAME = "salt-marcher";
    private static final String DB_FILE_NAME = "game.db";
    private static final Path DATABASE_PATH = resolveDatabasePath();
    private static final Path SQLITE_NATIVE_TMP_DIR = DATABASE_PATH.getParent().resolve("sqlite-native");
    private static final String URL = "jdbc:sqlite:" + DATABASE_PATH.toAbsolutePath();
    private static volatile boolean databasePathPrepared = false;

    private DatabaseManager() {
        throw new AssertionError("No instances");
    }

    /**
     * Opens and returns a fresh JDBC connection with base PRAGMAs applied.
     * Each caller is responsible for closing it (try-with-resources is fine).
     * SQLite WAL mode handles file-level concurrency across multiple connections.
     */
    public static Connection getConnection() throws SQLException {
        prepareDatabasePath();
        ensureSqliteDriverLoaded();
        Connection conn = DriverManager.getConnection(URL);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA foreign_keys = ON");
            stmt.execute("PRAGMA journal_mode = WAL");
        } catch (SQLException e) {
            conn.close();
            throw e;
        }
        return conn;
    }

    /**
     * Optimizes the SQLite session for bulk imports.
     * Call only from standalone CLI importer processes; these settings are scoped
     * to {@code conn} and are reset by {@link #resetBulkImportPragmas(Connection)}.
     */
    public static void applyBulkImportPragmas(Connection conn) throws SQLException {
        assert !Thread.currentThread().getName().startsWith("JavaFX")
                : "applyBulkImportPragmas must not be called from the JavaFX app process";
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA journal_mode = WAL");
            stmt.execute("PRAGMA synchronous = NORMAL");
            stmt.execute("PRAGMA cache_size = -64000");
        }
    }

    /**
     * Restores conservative durability settings after a bulk import.
     * Call in a finally block after {@link #applyBulkImportPragmas(Connection)}.
     */
    public static void resetBulkImportPragmas(Connection conn) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA synchronous = FULL");
            stmt.execute("PRAGMA cache_size = -2000");
        }
    }

    public static Path databasePath() {
        return DATABASE_PATH;
    }

    private static synchronized void prepareDatabasePath() throws SQLException {
        if (databasePathPrepared) {
            return;
        }
        try {
            Files.createDirectories(DATABASE_PATH.getParent());
            prepareSqliteNativeTempDirectory();
            migrateLegacyDatabaseIfNeeded();
            LOGGER.log(Level.INFO, "Using SQLite database at {0}", DATABASE_PATH.toAbsolutePath());
            databasePathPrepared = true;
        } catch (Exception ex) {
            throw new SQLException("Failed to prepare database path " + DATABASE_PATH.toAbsolutePath(), ex);
        }
    }

    private static void migrateLegacyDatabaseIfNeeded() throws Exception {
        Path legacyPath = Path.of(DB_FILE_NAME).toAbsolutePath().normalize();
        Path targetPath = DATABASE_PATH.toAbsolutePath().normalize();
        if (legacyPath.equals(targetPath) || Files.exists(targetPath) || !Files.exists(legacyPath)) {
            return;
        }
        Files.copy(legacyPath, targetPath, StandardCopyOption.COPY_ATTRIBUTES);
        LOGGER.log(Level.INFO, "Migrated legacy SQLite database from {0} to {1}",
                new Object[]{legacyPath, targetPath});
    }

    private static Path resolveDatabasePath() {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, APP_DATA_DIR_NAME, DB_FILE_NAME).toAbsolutePath().normalize();
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", APP_DATA_DIR_NAME, DB_FILE_NAME)
                .toAbsolutePath()
                .normalize();
    }

    private static void prepareSqliteNativeTempDirectory() throws Exception {
        Files.createDirectories(SQLITE_NATIVE_TMP_DIR);
        // sqlite-jdbc extracts its bundled native library before the first connection opens.
        // Keep it inside the app data directory so launches do not depend on /tmp mount semantics.
        System.setProperty("org.sqlite.tmpdir", SQLITE_NATIVE_TMP_DIR.toString());
    }

    private static void ensureSqliteDriverLoaded() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException ex) {
            throw new SQLException("SQLite JDBC driver not found on the runtime classpath.", ex);
        }
    }

    /**
     * Creates all tables and seeds required reference data.
     * Safe to call on every startup: all DDL uses CREATE TABLE IF NOT EXISTS,
     * all seed inserts use INSERT OR IGNORE.
     */
    public static void setupDatabase() {
        new SetupObject().setupDatabase(buildSetupDatabaseInput());
    }

    private static SetupDatabaseInput buildSetupDatabaseInput() {
        ArrayList<SetupDatabaseInput.LevelXpFloorInput> levelXpFloors = new ArrayList<>();
        // Setup needs only the resulting XP floors, not the party rules service itself.
        for (int level = 1; level <= 20; level++) {
            levelXpFloors.add(new SetupDatabaseInput.LevelXpFloorInput(
                    level,
                    PartyProgressionRules.minimumXpForLevel(level)));
        }
        return new SetupDatabaseInput(
                AnalysisModelVersion.current(),
                List.copyOf(levelXpFloors));
    }
}
