package src.data.encounter.gateway.local;

import src.data.encounter.model.EncounterPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class EncounterSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    EncounterSqliteConnectionFactory() {
        super(resolveDatabasePath(EncounterPersistenceSchema.DATABASE_FILE_NAME));
    }
}
