package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureCombatFeatureColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "initiative_bonus",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_INITIATIVE_BONUS_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "proficiency_bonus",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_PROFICIENCY_BONUS_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "legendary_action_count",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_LEGENDARY_ACTION_COUNT_COLUMN_SQL));
    }
}
