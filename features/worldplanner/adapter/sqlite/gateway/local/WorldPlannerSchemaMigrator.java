package features.worldplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import platform.persistence.SqliteSchemaColumnSupport;
import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;

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

    void addDisposition(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            addDispositionColumnIfMissing(
                    connection,
                    statement,
                    WorldPlannerPersistenceSchema.NPCS_TABLE,
                    WorldPlannerPersistenceSchema.NPC_DISPOSITION_COLUMN);
            addDispositionColumnIfMissing(
                    connection,
                    statement,
                    WorldPlannerPersistenceSchema.FACTIONS_TABLE,
                    WorldPlannerPersistenceSchema.FACTION_DISPOSITION_COLUMN);
            statement.execute(WorldPlannerPersistenceSchema.KEEP_ONE_FACTION_PER_NPC_SQL);
            statement.execute(WorldPlannerPersistenceSchema.CREATE_FACTION_NPC_UNIQUE_INDEX_SQL);
        }
    }

    private static void addDispositionColumnIfMissing(
            Connection connection,
            Statement statement,
            String table,
            String column
    ) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(connection, table, column)) {
            statement.execute("ALTER TABLE " + table + " ADD COLUMN " + column
                    + " INTEGER NOT NULL DEFAULT 0 CHECK(" + column + " BETWEEN -50 AND 50)");
        }
    }
}
