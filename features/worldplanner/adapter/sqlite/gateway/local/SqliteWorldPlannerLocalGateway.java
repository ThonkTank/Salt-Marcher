package features.worldplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;
import features.worldplanner.adapter.sqlite.model.WorldPlannerSnapshotRecord;

public final class SqliteWorldPlannerLocalGateway {

    private final SqliteConnectionSource connections;
    private final SqliteWorldPlannerReader reader = new SqliteWorldPlannerReader();
    private final SqliteWorldPlannerWriter writer = new SqliteWorldPlannerWriter();

    public SqliteWorldPlannerLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                WorldPlannerPersistenceSchema.databaseFileName(),
                NoopDiagnostics.INSTANCE));
    }

    public SqliteWorldPlannerLocalGateway(SqliteDatabase database) {
        WorldPlannerSchemaMigrator schemaMigrator = new WorldPlannerSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "world-planner",
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::addDisposition));
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
