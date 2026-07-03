package src.data.worldplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import src.data.worldplanner.model.WorldPlannerPersistenceSchema;

final class WorldPlannerSchemaMigrator {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(WorldPlannerPersistenceSchema.CREATE_NPCS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTION_NPCS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTION_LIMITS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATION_FACTIONS_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_LOCATION_TABLES_SQL);
        }
    }
}
