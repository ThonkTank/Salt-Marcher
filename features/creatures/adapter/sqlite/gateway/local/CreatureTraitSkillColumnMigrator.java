package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureTraitSkillColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "saving_throws",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SAVING_THROWS_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "skills",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SKILLS_COLUMN_SQL));
    }
}
