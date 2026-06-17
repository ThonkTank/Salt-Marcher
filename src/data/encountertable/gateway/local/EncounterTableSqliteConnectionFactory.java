package src.data.encountertable.gateway.local;

import src.data.encountertable.model.EncounterTablePersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class EncounterTableSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    EncounterTableSqliteConnectionFactory() {
        super(resolveDatabasePath(EncounterTablePersistenceSchema.DATABASE_FILE_NAME));
    }
}
