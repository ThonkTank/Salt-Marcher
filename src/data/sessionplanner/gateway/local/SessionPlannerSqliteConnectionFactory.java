package src.data.sessionplanner.gateway.local;

import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

final class SessionPlannerSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    SessionPlannerSqliteConnectionFactory() {
        super(resolveDatabasePath(SessionPlannerPersistenceSchema.DATABASE_FILE_NAME));
    }
}
