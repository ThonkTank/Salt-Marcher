package features.worldplanner.adapter.sqlite.gateway.local;

import features.worldplanner.adapter.sqlite.model.WorldPlannerSnapshotRecord;
import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class SqliteWorldPlannerLocalGateway {

    private final FeatureStoreHandle connections;
    private final SqliteWorldPlannerReader reader = new SqliteWorldPlannerReader();
    private final SqliteWorldPlannerWriter writer = new SqliteWorldPlannerWriter();

    public static FeatureStoreDefinition storeDefinition() {
        WorldPlannerSchemaMigrator schemaMigrator = new WorldPlannerSchemaMigrator();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(WorldPlannerPersistenceSchema.NPCS_TABLE,
                        "npc_id", "display_name", "creature_statblock_id", "appearance_notes",
                        "behavior_notes", "history_notes", "general_notes", "disposition_modifier", "status")
                .primaryKey(WorldPlannerPersistenceSchema.NPCS_TABLE, "npc_id")
                .table(WorldPlannerPersistenceSchema.FACTIONS_TABLE,
                        "faction_id", "display_name", "notes", "disposition", "primary_encounter_table_id")
                .primaryKey(WorldPlannerPersistenceSchema.FACTIONS_TABLE, "faction_id")
                .table(WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE, "faction_id", "npc_id", "sort_order")
                .primaryKey(WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE, "faction_id", "npc_id")
                .table(WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE,
                        "faction_id", "creature_statblock_id", "finite", "quantity")
                .primaryKey(WorldPlannerPersistenceSchema.FACTION_LIMITS_TABLE,
                        "faction_id", "creature_statblock_id")
                .table(WorldPlannerPersistenceSchema.LOCATIONS_TABLE, "location_id", "display_name", "notes")
                .primaryKey(WorldPlannerPersistenceSchema.LOCATIONS_TABLE, "location_id")
                .table(WorldPlannerPersistenceSchema.LOCATION_FACTIONS_TABLE,
                        "location_id", "faction_id", "sort_order")
                .primaryKey(WorldPlannerPersistenceSchema.LOCATION_FACTIONS_TABLE, "location_id", "faction_id")
                .table(WorldPlannerPersistenceSchema.LOCATION_TABLES_TABLE,
                        "location_id", "encounter_table_id", "sort_order")
                .primaryKey(WorldPlannerPersistenceSchema.LOCATION_TABLES_TABLE,
                        "location_id", "encounter_table_id")
                .index("idx_world_planner_npc_single_faction",
                        WorldPlannerPersistenceSchema.FACTION_NPCS_TABLE, true, "npc_id")
                .build();
        return FeatureStoreDefinition.validated(
                "world-planner", targetSchema,
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::addDisposition));
    }

    public SqliteWorldPlannerLocalGateway(FeatureStoreHandle store) {
        this.connections = FeatureStoreHandle.requireOwner(store, "world-planner");
    }

    public WorldPlannerSnapshotRecord load() {
        try (Connection connection = openReadyConnection()) {
            return reader.load(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load World Planner state from SQLite.", exception);
        }
    }

    public WorldPlannerSnapshotRecord save(WorldPlannerSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            writer.save(connection, snapshot);
            return reader.load(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save World Planner state to SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
