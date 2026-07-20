package features.creatures.adapter.sqlite.gateway.local;

import features.creatures.adapter.sqlite.model.CreaturesPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class CreatureIdentityTextColumnMigrator {

    private static final String TABLE_NAME = CreaturesPersistenceSchema.CREATURES.name();

    void ensureColumns(Connection connection) throws SQLException {
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "name",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_NAME_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "size",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_SIZE_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "creature_type",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_TYPE_COLUMN_SQL));
        CreaturesColumnMigrationSupport.ensureColumn(connection, TABLE_NAME, "alignment",
                statement -> statement.execute(CreaturesPersistenceSchema.ADD_CREATURE_ALIGNMENT_COLUMN_SQL));
    }
}
