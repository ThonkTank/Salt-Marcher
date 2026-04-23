package src.data.encounter.gateway.local;

import java.nio.file.Path;
import src.data.encounter.model.EncounterPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class EncounterSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    EncounterSqliteConnectionFactory() {
        super(
                resolveDatabasePath(EncounterPersistenceSchema.DATABASE_FILE_NAME),
                Path.of(EncounterPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }

    EncounterSqliteConnectionFactory(Path databasePath, Path legacyDatabasePath) {
        super(databasePath, legacyDatabasePath);
    }
}
