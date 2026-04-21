package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;

final class DungeonSqliteSchemaManager {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String alterTableSql : DungeonPersistenceSchema.COMPATIBILITY_ALTER_TABLE_SQL) {
                executeAdditiveMigration(statement, alterTableSql);
            }
        }
    }

    private static void executeAdditiveMigration(Statement statement, String sql) throws SQLException {
        try {
            statement.execute(sql);
        } catch (SQLException exception) {
            String message = exception.getMessage();
            if (message == null || !message.toLowerCase(Locale.ROOT).contains("duplicate column name")) {
                throw exception;
            }
        }
    }
}
