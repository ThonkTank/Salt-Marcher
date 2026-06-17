package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class PartySqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    PartySqliteConnectionFactory() {
        super(resolveDatabasePath(PartyPersistenceSchema.DATABASE_FILE_NAME));
    }
}
