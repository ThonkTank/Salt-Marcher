package src.data.creatures.datasource.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreaturesSchemaMigrator {

    private final CreaturesSchemaTableManager tableManager = new CreaturesSchemaTableManager();

    void ensureSchema(Connection connection) throws SQLException {
        tableManager.createBaseTables(connection);
        tableManager.ensureColumns(connection, CreaturesPersistenceSchema.CREATURES);
        tableManager.ensureColumns(connection, CreaturesPersistenceSchema.CREATURE_BIOMES);
        tableManager.ensureColumns(connection, CreaturesPersistenceSchema.CREATURE_SUBTYPES);
        tableManager.ensureColumns(connection, CreaturesPersistenceSchema.CREATURE_ACTIONS);
        createIndexes(connection);
    }

    private void createIndexes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String indexSql : CreaturesPersistenceSchema.INDEX_SQL) {
                statement.execute(indexSql);
            }
        }
    }
}
