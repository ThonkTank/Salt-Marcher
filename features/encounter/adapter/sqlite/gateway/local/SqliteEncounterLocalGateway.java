package features.encounter.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
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
import features.encounter.api.GeneratedEncounterPlanSource;
import features.encounter.application.GeneratedEncounterPlanBatchRepository;

public final class SqliteEncounterLocalGateway {

    private final SqliteConnectionSource connections;
    private final EncounterPlanSqliteStore store;
    private final GeneratedEncounterPlanOriginSqliteStore origins;

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
                new SqliteMigration(2, schemaMigrator::ensureGeneratedPlanOrigins));
        this.store = new EncounterPlanSqliteStore();
        this.origins = new GeneratedEncounterPlanOriginSqliteStore();
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

    public GeneratedEncounterPlanBatchRepository.StoredBatch saveGeneratedBatch(
            GeneratedEncounterPlanSource source,
            String batchFingerprint,
            List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> plans
    ) {
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(batchFingerprint, "batchFingerprint");
        Objects.requireNonNull(plans, "plans");
        try (Connection connection = openReadyConnection()) {
            return saveGeneratedBatchInTransaction(connection, source, batchFingerprint, plans);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save generated encounter batch to SQLite.", exception);
        }
    }

    public Optional<GeneratedEncounterPlanBatchRepository.StoredBatch> loadGeneratedBatch(
            GeneratedEncounterPlanSource source
    ) {
        Objects.requireNonNull(source, "source");
        try (Connection connection = openReadyConnection()) {
            return origins.loadBatch(connection, source);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load generated encounter batch from SQLite.", exception);
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

    private GeneratedEncounterPlanBatchRepository.StoredBatch saveGeneratedBatchInTransaction(
            Connection connection,
            GeneratedEncounterPlanSource source,
            String batchFingerprint,
            List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> plans
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            Optional<GeneratedEncounterPlanBatchRepository.StoredBatch> existing = origins.loadBatch(
                    connection,
                    source);
            if (existing.isPresent()) {
                return validatedRetryBatch(batchFingerprint, plans, existing.orElseThrow());
            }
            origins.insertBatch(connection, source, batchFingerprint, plans.size());
            List<GeneratedEncounterPlanBatchRepository.StoredMapping> imported = new ArrayList<>();
            for (int index = 0; index < plans.size(); index++) {
                imported.add(saveGeneratedPlan(connection, source, index, plans.get(index)));
            }
            connection.commit();
            return new GeneratedEncounterPlanBatchRepository.StoredBatch(
                    batchFingerprint,
                    plans.size(),
                    imported);
        } catch (SQLException | RuntimeException exception) {
            rollback(connection, exception);
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private GeneratedEncounterPlanBatchRepository.StoredMapping saveGeneratedPlan(
            Connection connection,
            GeneratedEncounterPlanSource source,
            int batchOrder,
            GeneratedEncounterPlanBatchRepository.ResolvedPlan plan
    ) throws SQLException {
        long planId = store.savePlan(connection, new EncounterPlanRecord(
                0L,
                plan.displayLabel(),
                plan.displayLabel(),
                plan.creatures().stream()
                        .mapToInt(features.encounter.domain.plan.EncounterPlanCreature::quantity)
                        .sum()));
        store.replaceCreatures(
                connection,
                planId,
                toCreatureRecords(plan));
        origins.insert(
                connection,
                source,
                plan.encounterNumber(),
                batchOrder,
                plan.specFingerprint(),
                planId);
        return new GeneratedEncounterPlanBatchRepository.StoredMapping(
                plan.encounterNumber(),
                planId,
                plan.specFingerprint());
    }

    private static GeneratedEncounterPlanBatchRepository.StoredBatch validatedRetryBatch(
            String batchFingerprint,
            List<GeneratedEncounterPlanBatchRepository.ResolvedPlan> plans,
            GeneratedEncounterPlanBatchRepository.StoredBatch existing
    ) {
        List<GeneratedEncounterPlanBatchRepository.StoredMapping> mappings = existing.mappings();
        if (!batchFingerprint.equals(existing.batchFingerprint())
                || existing.declaredEncounterCount() != plans.size()
                || mappings.size() != plans.size()) {
            throw new IllegalStateException("Generated encounter origin batch is incomplete.");
        }
        for (int index = 0; index < plans.size(); index++) {
            GeneratedEncounterPlanBatchRepository.ResolvedPlan requested = plans.get(index);
            GeneratedEncounterPlanBatchRepository.StoredMapping stored = mappings.get(index);
            if (requested.encounterNumber() != stored.encounterNumber()
                    || !requested.specFingerprint().equals(stored.specFingerprint())) {
                throw new IllegalStateException("Generated encounter origin does not match requested spec.");
            }
        }
        return existing;
    }

    private static List<EncounterPlanCreatureRecord> toCreatureRecords(
            GeneratedEncounterPlanBatchRepository.ResolvedPlan plan
    ) {
        List<EncounterPlanCreatureRecord> records = new ArrayList<>();
        for (int index = 0; index < plan.creatures().size(); index++) {
            features.encounter.domain.plan.EncounterPlanCreature creature = plan.creatures().get(index);
            records.add(new EncounterPlanCreatureRecord(creature.creatureId(), creature.quantity(), index));
        }
        return List.copyOf(records);
    }

    private static void rollback(Connection connection, Exception original) {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
