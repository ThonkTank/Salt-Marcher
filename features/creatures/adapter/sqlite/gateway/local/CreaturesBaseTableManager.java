package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class CreaturesBaseTableManager {

    void createBaseTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_BIOMES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_SUBTYPES_TABLE_SQL);
            statement.execute(CreaturesPersistenceSchema.CREATE_CREATURE_ACTIONS_TABLE_SQL);
        }
    }
}
