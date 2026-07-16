package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.encounter.adapter.sqlite.model.EncounterPlanCreatureRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanRecord;
import features.encounter.adapter.sqlite.model.EncounterPlanSnapshotRecord;

public final class SqliteEncounterLocalGateway {

    private final SqliteConnectionSource connections;
    private final EncounterPlanSqliteStore store;

    public SqliteEncounterLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqliteEncounterLocalGateway(SqliteDatabase database) {
        EncounterSchemaMigrator schemaMigrator = new EncounterSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "encounter",
                new SqliteMigration(1, schemaMigrator::ensureSchema));
        this.store = new EncounterPlanSqliteStore();
    }

    public EncounterPlanSnapshotRecord save(
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) {
        Objects.requireNonNull(plan, "plan");
        Objects.requireNonNull(creatures, "creatures");
        try (Connection connection = openReadyConnection()) {
            return saveInTransaction(connection, plan, creatures);
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

    private EncounterPlanSnapshotRecord saveInTransaction(
            Connection connection,
            EncounterPlanRecord plan,
            List<EncounterPlanCreatureRecord> creatures
    ) throws SQLException {
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
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
