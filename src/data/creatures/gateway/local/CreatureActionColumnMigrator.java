package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureActionColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURE_ACTIONS.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "creature_id",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ACTION_CREATURE_ID_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "action_type",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ACTION_TYPE_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "name",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ACTION_NAME_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "description",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ACTION_DESCRIPTION_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "to_hit_bonus",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ACTION_TO_HIT_BONUS_COLUMN_SQL));
    }
}
