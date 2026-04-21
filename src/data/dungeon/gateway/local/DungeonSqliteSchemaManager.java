package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteSchemaManager {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
        }
    }
}
