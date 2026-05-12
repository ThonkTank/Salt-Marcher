package src.data.encounter.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.encounter.model.EncounterPlanCreatureRecord;
import src.data.encounter.model.EncounterPlanRecord;
import src.data.encounter.model.EncounterPlanSnapshotRecord;

public final class SqliteEncounterLocalGateway {

    private final EncounterSqliteConnectionFactory connectionFactory;
    private final EncounterSchemaMigrator schemaMigrator;
    private final EncounterPlanSqliteStore store;

    public SqliteEncounterLocalGateway() {
        this(
                new EncounterSqliteConnectionFactory(),
                new EncounterSchemaMigrator(),
                new EncounterPlanSqliteStore());
    }

    SqliteEncounterLocalGateway(
            EncounterSqliteConnectionFactory connectionFactory,
            EncounterSchemaMigrator schemaMigrator,
            EncounterPlanSqliteStore store
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
        this.store = Objects.requireNonNull(store, "store");
    }

    public EncounterPlanSnapshotRecord save(
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) {
        Objects.requireNonNull(plan, "plan");
        Objects.requireNonNull(creatures, "creatures");
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                long planId = store.savePlan(connection, plan);
                store.replaceCreatures(connection, planId, creatures);
                connection.commit();
                return loadSaved(connection, planId)
                        .orElseThrow(() -> new IllegalStateException("Saved encounter plan vanished after save."));
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save encounter plan to SQLite.", exception);
        }
    }

    public Optional<EncounterPlanSnapshotRecord> load(long planId) {
        try (Connection connection = openReadyConnection()) {
            Optional<EncounterPlanRecord> plan = store.loadPlan(connection, planId);
            if (plan.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(new EncounterPlanSnapshotRecord(
                    plan.get(),
                    store.loadCreatures(connection, planId)));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter plan from SQLite.", exception);
        }
    }

    public List<EncounterPlanRecord> list() {
        try (Connection connection = openReadyConnection()) {
            return store.listPlans(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list encounter plans from SQLite.", exception);
        }
    }

    private Optional<EncounterPlanSnapshotRecord> loadSaved(Connection connection, long planId) throws SQLException {
        Optional<EncounterPlanRecord> plan = store.loadPlan(connection, planId);
        if (plan.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new EncounterPlanSnapshotRecord(plan.get(), store.loadCreatures(connection, planId)));
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
