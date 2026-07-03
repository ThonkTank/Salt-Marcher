package src.data.worldplanner.gateway.local;

import src.data.persistencecore.sqlite.AbstractSqliteConnectionFactory;
import src.data.worldplanner.model.WorldPlannerPersistenceSchema;

final class WorldPlannerSqliteConnectionFactory extends AbstractSqliteConnectionFactory {

    WorldPlannerSqliteConnectionFactory() {
        super(resolveDatabasePath(WorldPlannerPersistenceSchema.databaseFileName()));
    }
}
