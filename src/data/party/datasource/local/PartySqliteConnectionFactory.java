package src.data.party.datasource.local;

import src.data.party.model.PartyPersistenceSchema;
import src.data.persistencecore.datasource.local.AbstractSqliteConnectionFactory;

import java.nio.file.Path;

final class PartySqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    PartySqliteConnectionFactory() {
        super(
                resolveDatabasePath(PartyPersistenceSchema.DATABASE_FILE_NAME),
                Path.of(PartyPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }

    PartySqliteConnectionFactory(Path databasePath, Path legacyDatabasePath) {
        super(databasePath, legacyDatabasePath);
    }
}
