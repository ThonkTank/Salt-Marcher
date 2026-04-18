package src.data.persistencecore.sqlite;

import src.data.persistencecore.model.SqliteTableSpec;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Shared SQLite schema migration helpers for optional columns.
 */
public final class SqliteSchemaColumnSupport {

    private SqliteSchemaColumnSupport() {
    }

    public static boolean hasColumn(Connection connection, String tableName, String columnName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("PRAGMA table_info(" + tableName + ")");
             ResultSet resultSet = statement.executeQuery()) {
            while (resultSet.next()) {
                if (columnName.equalsIgnoreCase(resultSet.getString("name"))) {
                    return true;
                }
            }
        }
        return false;
    }

    public static void ensureColumn(Connection connection, SqliteTableSpec table, String columnName) throws SQLException {
        SqliteTableSpec.ColumnSpec column = table.column(columnName);
        if (hasColumn(connection, table.name(), column.name())) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table.name() + " ADD COLUMN " + column.name() + " " + column.definition());
        }
    }
}
