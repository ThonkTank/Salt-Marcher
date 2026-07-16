package src.data.sessiongeneration;

import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;

final class SessionGenerationSqliteConnectionFactory extends AbstractSqliteConnectionFactory {
    SessionGenerationSqliteConnectionFactory() {
        super(resolveDatabasePath("game.db"));
    }
}
