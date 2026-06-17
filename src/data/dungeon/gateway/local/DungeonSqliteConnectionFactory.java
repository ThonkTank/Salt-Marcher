package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class DungeonSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    DungeonSqliteConnectionFactory() {
        super(resolveDatabasePath(DungeonPersistenceSchema.DATABASE_FILE_NAME));
    }
}
