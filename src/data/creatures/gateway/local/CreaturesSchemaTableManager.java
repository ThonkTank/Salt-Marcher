package src.data.creatures.gateway.local;

import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;
import src.data.persistencecore.model.SqliteTableSpec;
import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreaturesSchemaTableManager {

    void createBaseTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(CreaturesPersistenceSchema.CREATURES.createTableSql());
            statement.execute(CreaturesPersistenceSchema.CREATURE_BIOMES.createTableSql());
            statement.execute(CreaturesPersistenceSchema.CREATURE_SUBTYPES.createTableSql());
            statement.execute(CreaturesPersistenceSchema.CREATURE_ACTIONS.createTableSql());
        }
    }

    void ensureColumns(Connection connection, SqliteTableSpec table) throws SQLException {
        for (SqliteTableSpec.ColumnSpec column : table.columns()) {
            SqliteSchemaColumnSupport.ensureColumn(connection, table, column.name());
        }
    }
}
