package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureAbilityColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "str",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_STR_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "dex",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_DEX_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "con",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_CON_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "intel",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_INTEL_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "wis",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_WIS_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "cha",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_CHA_COLUMN_SQL));
    }
}
