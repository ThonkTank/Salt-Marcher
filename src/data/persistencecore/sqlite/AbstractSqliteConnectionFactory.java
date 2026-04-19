package src.data.persistencecore.sqlite;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;

/**
 * Shared SQLite connection lifecycle for feature-local gateways.
 */
public abstract class AbstractSqliteConnectionFactory {

    private static final String APP_DATA_DIR_NAME = "salt-marcher";

    private final Path databasePath;
    private final Path legacyDatabasePath;
    private final String url;

    private boolean prepared;

    protected AbstractSqliteConnectionFactory(Path databasePath, Path legacyDatabasePath) {
        this.databasePath = Objects.requireNonNull(databasePath, "databasePath").toAbsolutePath().normalize();
        this.legacyDatabasePath = Objects.requireNonNull(legacyDatabasePath, "legacyDatabasePath")
                .toAbsolutePath()
                .normalize();
        this.url = "jdbc:sqlite:" + this.databasePath;
    }

    public final Connection openConnection() throws SQLException {
        prepareDatabasePath();
        loadDriver();
        Connection connection = DriverManager.getConnection(url);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA journal_mode = WAL");
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
        return connection;
    }

    public final Path databasePath() {
        return databasePath;
    }

    protected static Path resolveDatabasePath(String dbFileName) {
        String xdgDataHome = System.getenv("XDG_DATA_HOME");
        if (xdgDataHome != null && !xdgDataHome.isBlank()) {
            return Path.of(xdgDataHome, APP_DATA_DIR_NAME, dbFileName).toAbsolutePath().normalize();
        }
        return Path.of(System.getProperty("user.home"), ".local", "share", APP_DATA_DIR_NAME, dbFileName)
                .toAbsolutePath()
                .normalize();
    }

    private synchronized void prepareDatabasePath() throws SQLException {
        if (prepared) {
            return;
        }
        try {
            Path parent = databasePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            migrateLegacyDatabaseIfNeeded();
            prepared = true;
        } catch (IOException exception) {
            throw new SQLException("Could not prepare SQLite path " + databasePath, exception);
        }
    }

    private void migrateLegacyDatabaseIfNeeded() throws IOException {
        if (legacyDatabasePath.equals(databasePath) || Files.exists(databasePath) || !Files.exists(legacyDatabasePath)) {
            return;
        }
        Files.copy(legacyDatabasePath, databasePath, StandardCopyOption.COPY_ATTRIBUTES);
    }

    private static void loadDriver() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("SQLite JDBC driver not available.", exception);
        }
    }
}
