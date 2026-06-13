package src.data.creatures.gateway.local;

import java.nio.file.Path;
import src.data.creatures.model.CreaturesPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class CreaturesSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    CreaturesSqliteConnectionFactory() {
        super(
                resolveDatabasePath(CreaturesPersistenceSchema.DATABASE_FILE_NAME),
                // LEGACY_REMOVE_ON_TOUCH: Root DB copy; entfernen, sobald dieser Bereich bearbeitet wird.
                Path.of(CreaturesPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }
}
