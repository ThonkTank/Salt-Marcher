package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureDefenseColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "damage_vulnerabilities",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_DAMAGE_VULNERABILITIES_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "damage_resistances",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_DAMAGE_RESISTANCES_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "damage_immunities",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_DAMAGE_IMMUNITIES_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "condition_immunities",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_CONDITION_IMMUNITIES_COLUMN_SQL));
    }
}
