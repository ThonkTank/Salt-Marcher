package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureVitalsColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "hp",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_HP_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "hit_dice",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_HIT_DICE_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "hit_dice_count",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_HIT_DICE_COUNT_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "hit_dice_sides",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_HIT_DICE_SIDES_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "hit_dice_modifier",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_HIT_DICE_MODIFIER_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "ac",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_AC_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "ac_notes",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_AC_NOTES_COLUMN_SQL));
    }
}
