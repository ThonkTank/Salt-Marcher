package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureSenseColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "senses",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SENSES_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "passive_perception",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_PASSIVE_PERCEPTION_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "languages",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_LANGUAGES_COLUMN_SQL));
    }
}
