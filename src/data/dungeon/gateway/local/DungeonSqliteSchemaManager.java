package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteSchemaManager {

    private static final DungeonSqliteCompatibilityUpgrade COMPATIBILITY_UPGRADE =
            new DungeonSqliteCompatibilityUpgrade();
    private static final DungeonSqliteTopologyBackfill TOPOLOGY_BACKFILL =
            new DungeonSqliteTopologyBackfill();

    void ensureSchema(Connection connection) throws SQLException {
        boolean topologyTableExisted = SqliteSchemaColumnSupport.hasTable(
                connection,
                DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE);
        createTables(connection);
        COMPATIBILITY_UPGRADE.apply(connection);
        TOPOLOGY_BACKFILL.apply(connection, topologyTableExisted);
    }

    private static void createTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
        }
    }
}
