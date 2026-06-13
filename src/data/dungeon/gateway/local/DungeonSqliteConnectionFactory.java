package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

import java.nio.file.Path;

final class DungeonSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    DungeonSqliteConnectionFactory() {
        super(
                resolveDatabasePath(DungeonPersistenceSchema.DATABASE_FILE_NAME),
                // LEGACY_REMOVE_ON_TOUCH: Root DB copy; entfernen, sobald dieser Bereich bearbeitet wird.
                Path.of(DungeonPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }
}
