package platform.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;

public final class SqliteSchemaColumnSupport {

    private SqliteSchemaColumnSupport() {
    }

    public static boolean hasTable(Connection connection, String tableName) throws SQLException {
        Objects.requireNonNull(connection, "connection");
        String safeTable = requireIdentifier(tableName);
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, safeTable);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    public static boolean hasColumn(Connection connection, String tableName, String columnName) throws SQLException {
        Objects.requireNonNull(connection, "connection");
        String safeTable = requireIdentifier(tableName);
        String safeColumn = requireIdentifier(columnName);
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA table_info(" + safeTable + ")")) {
            while (result.next()) {
                if (safeColumn.equalsIgnoreCase(result.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static String requireIdentifier(String value) {
        String identifier = Objects.requireNonNull(value, "identifier");
        if (!identifier.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalArgumentException("invalid SQLite identifier");
        }
        return identifier;
    }
}
