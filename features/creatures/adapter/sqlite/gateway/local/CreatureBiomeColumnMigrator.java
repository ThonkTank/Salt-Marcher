package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureBiomeColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURE_BIOMES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "creature_id",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_BIOME_CREATURE_ID_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "biome",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_BIOME_VALUE_COLUMN_SQL));
    }
}
