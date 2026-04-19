package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureMovementColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "speed",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SPEED_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "fly_speed",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_FLY_SPEED_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "swim_speed",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SWIM_SPEED_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "climb_speed",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_CLIMB_SPEED_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "burrow_speed",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_BURROW_SPEED_COLUMN_SQL));
    }
}
