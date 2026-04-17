package src.data.creatures.datasource.local;

import src.data.creatures.model.CreaturesPersistenceSchema;
import src.data.persistencecore.datasource.local.AbstractSqliteConnectionFactory;

import java.nio.file.Path;

final class CreaturesSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    CreaturesSqliteConnectionFactory() {
        super(
                resolveDatabasePath(CreaturesPersistenceSchema.DATABASE_FILE_NAME),
                Path.of(CreaturesPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }

    CreaturesSqliteConnectionFactory(Path databasePath, Path legacyDatabasePath) {
        super(databasePath, legacyDatabasePath);
    }
}
