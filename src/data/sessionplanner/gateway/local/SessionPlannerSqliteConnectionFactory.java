package src.data.sessionplanner.gateway.local;

import java.nio.file.Path;
import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

final class SessionPlannerSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    SessionPlannerSqliteConnectionFactory() {
        super(
                resolveDatabasePath(SessionPlannerPersistenceSchema.DATABASE_FILE_NAME),
                Path.of(SessionPlannerPersistenceSchema.DATABASE_FILE_NAME).toAbsolutePath().normalize());
    }
}
