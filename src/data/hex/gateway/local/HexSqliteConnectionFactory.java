package src.data.hex.gateway.local;

import src.data.hex.model.HexPersistenceSchema;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class HexSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    HexSqliteConnectionFactory() {
        super(resolveDatabasePath(HexPersistenceSchema.DATABASE_FILE_NAME));
    }
}
