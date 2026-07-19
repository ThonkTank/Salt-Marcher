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
import features.encounter.application.GeneratedEncounterBatchRepository;

public final class SqliteEncounterLocalGateway {

    private final SqliteConnectionSource connections;
    private final EncounterPlanSqliteStore store;
    private final GeneratedEncounterBatchSqliteStore generatedBatches;
    private final EncounterPlanBatchReadSqliteStore batchReads;

    public SqliteEncounterLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqliteEncounterLocalGateway(SqliteDatabase database) {
        EncounterSchemaMigrator schemaMigrator = new EncounterSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "encounter",
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::ensureGeneratedPlanOrigins),
                new SqliteMigration(3, schemaMigrator::ensureRuntimeContexts),
                new SqliteMigration(4, schemaMigrator::ensureGeneratedBatchV4));
        this.store = new EncounterPlanSqliteStore();
        this.generatedBatches = new GeneratedEncounterBatchSqliteStore();
        this.batchReads = new EncounterPlanBatchReadSqliteStore();
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
            List<EncounterPlanCreatureRecord> creatures = store.loadCreatures(connection, planId);
            return Optional.of(new EncounterPlanSnapshotRecord(
                    plan.get(),
                    creatures,
                    generatedBatches.loadOrigin(connection, planId, creatures)));
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

    public GeneratedEncounterBatchRepository.CommitOutcome commitGeneratedBatch(
            features.encounter.api.PreparedEncounterBatch batch
    ) {
        Objects.requireNonNull(batch, "batch");
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                // Insert-first acquires SQLite write intent before any read snapshot exists.
                // A concurrent canonical identity is resolved after rollback by rereading
                // the winner's committed semantic batch.
                generatedBatches.insertBatch(connection, batch);
                List<GeneratedEncounterBatchRepository.Mapping> mappings =
                        store.insertGeneratedPlans(connection, batch.rosters());
                store.insertGeneratedCreatures(connection, batch.rosters(), mappings);
                generatedBatches.insertOrigins(connection, batch, mappings);
                connection.commit();
                return new GeneratedEncounterBatchRepository.CommitOutcome(
                        GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED, mappings);
            } catch (SQLException exception) {
                connection.rollback();
                Optional<GeneratedEncounterBatchSqliteStore.StoredBatch> raced = generatedBatches.load(connection, batch);
                if (raced.isPresent()) {
                    return retryOutcome(batch, raced.orElseThrow());
                }
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to commit generated encounter batch to SQLite.", exception);
        }
    }

    public List<EncounterPlanSnapshotRecord> loadPlansByIds(List<Long> planIds) {
        Objects.requireNonNull(planIds, "planIds");
        try (Connection connection = openReadyConnection()) {
            return batchReads.load(connection, planIds);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load encounter plans by IDs from SQLite.", exception);
        }
    }

    private GeneratedEncounterBatchRepository.CommitOutcome retryOutcome(
            features.encounter.api.PreparedEncounterBatch batch,
            GeneratedEncounterBatchSqliteStore.StoredBatch stored
    ) {
        if (!generatedBatches.equalsRequested(stored, batch)) {
            return new GeneratedEncounterBatchRepository.CommitOutcome(
                    GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT, List.of());
        }
        return new GeneratedEncounterBatchRepository.CommitOutcome(
                GeneratedEncounterBatchRepository.CommitOutcome.Status.EQUAL_RETRY,
                generatedBatches.mappings(stored));
    }

    private Optional<EncounterPlanSnapshotRecord> loadSaved(Connection connection, long planId) throws SQLException {
        Optional<EncounterPlanRecord> plan = store.loadPlan(connection, planId);
        if (plan.isEmpty()) {
            return Optional.empty();
        }
        List<EncounterPlanCreatureRecord> creatures = store.loadCreatures(connection, planId);
        return Optional.of(new EncounterPlanSnapshotRecord(
                plan.get(), creatures, generatedBatches.loadOrigin(connection, planId, creatures)));
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
