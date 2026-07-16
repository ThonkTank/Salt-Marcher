package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreaturesSchemaMigrator {

    private final CreaturesSchemaTableManager tableManager = new CreaturesSchemaTableManager();

    void ensureSchema(Connection connection) throws SQLException {
        tableManager.createBaseTables(connection);
        tableManager.ensureCreatureColumns(connection);
        tableManager.ensureCreatureBiomeColumns(connection);
        tableManager.ensureCreatureSubtypeColumns(connection);
        tableManager.ensureCreatureActionColumns(connection);
        createIndexes(connection);
    }

    private void createIndexes(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_TYPE_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_ALIGNMENT_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_XP_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_NAME_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_BIOMES_BIOME_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_BIOMES_CREATURE_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_SUBTYPES_SUBTYPE_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_SUBTYPES_CREATURE_INDEX_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_ACTIONS_CREATURE_INDEX_SQL);
        }
    }
}
