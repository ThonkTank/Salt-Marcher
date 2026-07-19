package features.worldplanner.adapter.sqlite.gateway.local;

import features.worldplanner.adapter.sqlite.model.WorldPlannerSnapshotRecord;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class SqliteWorldPlannerLocalGateway {

    private final FeatureStoreHandle connections;
    private final SqliteWorldPlannerReader reader = new SqliteWorldPlannerReader();
    private final SqliteWorldPlannerWriter writer = new SqliteWorldPlannerWriter();

    public static FeatureStoreDefinition storeDefinition() {
        WorldPlannerSchemaMigrator schemaMigrator = new WorldPlannerSchemaMigrator();
        return FeatureStoreDefinition.of(
                "world-planner",
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
