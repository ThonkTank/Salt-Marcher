package src.data.worldplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import src.data.worldplanner.model.WorldPlannerSnapshotRecord;

public final class SqliteWorldPlannerLocalGateway {

    private final WorldPlannerSqliteConnectionFactory connectionFactory;
    private final WorldPlannerSchemaMigrator schemaMigrator;
    private final SqliteWorldPlannerReader reader = new SqliteWorldPlannerReader();
    private final SqliteWorldPlannerWriter writer = new SqliteWorldPlannerWriter();

    public SqliteWorldPlannerLocalGateway() {
        this(new WorldPlannerSqliteConnectionFactory(), new WorldPlannerSchemaMigrator());
    }

    SqliteWorldPlannerLocalGateway(
            WorldPlannerSqliteConnectionFactory connectionFactory,
            WorldPlannerSchemaMigrator schemaMigrator
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
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
        Connection connection = connectionFactory.openConnection();
        try {
            schemaMigrator.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }
}
