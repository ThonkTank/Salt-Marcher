package src.data.creatures.gateway.local;

import src.data.creatures.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureCatalogIdentityColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "cr",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_CR_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "xp",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_XP_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "source_slug",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SOURCE_SLUG_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "slug_key",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SLUG_KEY_COLUMN_SQL));
    }
}
