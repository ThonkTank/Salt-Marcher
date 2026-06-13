package src.data.encounter.gateway.local;

import java.nio.file.Path;
import src.data.encounter.model.EncounterPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class EncounterSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    EncounterSqliteConnectionFactory() {
        super(
                resolveDatabasePath(EncounterPersistenceSchema.DATABASE_FILE_NAME),
                // LEGACY_REMOVE_ON_TOUCH: Root DB copy; entfernen, sobald dieser Bereich bearbeitet wird.
                Path.of(EncounterPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }
}
