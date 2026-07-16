package features.encounter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.encounter.api.GeneratedEncounterPlanImportCommand;
import features.encounter.api.GeneratedEncounterPlanImportResult;
import features.encounter.api.GeneratedEncounterPlanRole;
import features.encounter.api.GeneratedEncounterPlanSlotSpec;
import features.encounter.api.GeneratedEncounterPlanSource;
import features.encounter.api.GeneratedEncounterPlanSpec;
import features.encounter.domain.generation.EncounterCandidateCombatStats;
import features.encounter.domain.generation.EncounterCandidateProfile;
import features.encounter.domain.generation.EncounterCreatureFacts;
import features.encounter.domain.generation.EncounterRole;
import features.encounter.domain.plan.EncounterPlan;

final class GeneratedEncounterPlanImportTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void queuesImportAndPrefersRequestedRoleBeforeExactXpFallback() throws Exception {
        Path databasePath = temporaryDirectory.resolve("role-preference.db");
        seedCreatures(databasePath, 1L, 2L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            RecordingLane lane = new RecordingLane();
            GeneratedEncounterPlanImportService service = service(
                    repository,
                    lane,
                    Map.of(100, List.of(
                            candidate(1L, 100, EncounterRole.STANDARD),
                            candidate(2L, 100, EncounterRole.BRUTE))));

            CompletableFuture<GeneratedEncounterPlanImportResult> future = service.importGeneratedPlans(command(
                    source("run-role"),
                    new GeneratedEncounterPlanSpec(1, "Ambush", List.of(
                            slot(100, GeneratedEncounterPlanRole.BRUTE),
                            slot(100, GeneratedEncounterPlanRole.BOSS)))))
                    .toCompletableFuture();

            assertFalse(future.isDone());
            assertTrue(repository.list().isEmpty());
            lane.runNext();

            GeneratedEncounterPlanImportResult result = future.join();
            assertEquals(GeneratedEncounterPlanImportResult.Status.SUCCESS, result.status());
            EncounterPlan saved = repository.load(result.plans().getFirst().planId()).orElseThrow();
            assertEquals(2L, saved.creatures().get(0).creatureId());
            assertEquals(1L, saved.creatures().get(1).creatureId());
        }
    }

    @Test
    void unresolvedSlotPreventsEveryWriteInBatch() throws Exception {
        Path databasePath = temporaryDirectory.resolve("unresolved.db");
        seedCreatures(databasePath, 1L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            RecordingLane lane = new RecordingLane();
            GeneratedEncounterPlanImportService service = service(
                    repository,
                    lane,
                    Map.of(100, List.of(candidate(1L, 100, EncounterRole.STANDARD))));

            CompletableFuture<GeneratedEncounterPlanImportResult> future = service.importGeneratedPlans(command(
                    source("run-unresolved"),
                    new GeneratedEncounterPlanSpec(1, "First", List.of(
                            slot(100, GeneratedEncounterPlanRole.STANDARD))),
                    new GeneratedEncounterPlanSpec(2, "Second", List.of(
                            slot(200, GeneratedEncounterPlanRole.ELITE)))))
                    .toCompletableFuture();
            lane.runNext();

            assertEquals(GeneratedEncounterPlanImportResult.Status.UNRESOLVABLE, future.join().status());
            assertTrue(repository.list().isEmpty());
            assertEquals(0, rowCount(databasePath, "saved_encounter_plans"));
            assertEquals(0, rowCount(databasePath, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void schedulingFailureCompletesWithTypedStorageFailure() {
        GeneratedEncounterPlanImportService service = new GeneratedEncounterPlanImportService(
                ignored -> List.of(),
                new InMemoryBatchRepository(),
                new RejectingLane());

        GeneratedEncounterPlanImportResult result = service.importGeneratedPlans(command(
                source("run-rejected"),
                new GeneratedEncounterPlanSpec(1, "Rejected", List.of(
                        slot(100, GeneratedEncounterPlanRole.STANDARD)))))
                .toCompletableFuture().join();

        assertEquals(GeneratedEncounterPlanImportResult.Status.STORAGE_FAILURE, result.status());
    }

    @Test
    void unexpectedProviderFailureCompletesWithTypedStorageFailure() {
        RecordingLane lane = new RecordingLane();
        GeneratedEncounterPlanImportService service = new GeneratedEncounterPlanImportService(
                ignored -> { throw new NullPointerException("broken candidate source"); },
                new InMemoryBatchRepository(),
                lane);

        GeneratedEncounterPlanImportResult result = importNow(
                service,
                lane,
                command(source("run-runtime"), new GeneratedEncounterPlanSpec(1, "Runtime", List.of(
                        slot(100, GeneratedEncounterPlanRole.STANDARD)))));

        assertEquals(GeneratedEncounterPlanImportResult.Status.STORAGE_FAILURE, result.status());
    }

    @Test
    void sqliteBatchRollsBackEarlierPlansWhenLaterPlanCannotBeSaved() throws Exception {
        Path databasePath = temporaryDirectory.resolve("atomic.db");
        seedCreatures(databasePath, 1L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            RecordingLane lane = new RecordingLane();
            GeneratedEncounterPlanImportService service = service(
                    repository,
                    lane,
                    Map.of(
                            100, List.of(candidate(1L, 100, EncounterRole.STANDARD)),
                            200, List.of(candidate(999L, 200, EncounterRole.ELITE))));

            CompletableFuture<GeneratedEncounterPlanImportResult> future = service.importGeneratedPlans(command(
                    source("run-atomic"),
                    new GeneratedEncounterPlanSpec(1, "First", List.of(
                            slot(100, GeneratedEncounterPlanRole.STANDARD))),
                    new GeneratedEncounterPlanSpec(2, "Second", List.of(
                            slot(200, GeneratedEncounterPlanRole.ELITE)))))
                    .toCompletableFuture();
            lane.runNext();

            assertEquals(GeneratedEncounterPlanImportResult.Status.STORAGE_FAILURE, future.join().status());
            assertEquals(0, rowCount(databasePath, "saved_encounter_plans"));
            assertEquals(0, rowCount(databasePath, "saved_encounter_plan_creatures"));
            assertEquals(0, rowCount(databasePath, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void retryReusesDurableOriginMappingWithoutUsingDisplayLabelAsIdentity() throws Exception {
        Path databasePath = temporaryDirectory.resolve("retry.db");
        seedCreatures(databasePath, 1L, 2L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            GeneratedEncounterPlanSource source = source("stable-run-id");
            RecordingLane firstLane = new RecordingLane();
            long firstPlanId = importNow(service(
                    repository,
                    firstLane,
                    Map.of(100, List.of(candidate(1L, 100, EncounterRole.STANDARD)))),
                    firstLane,
                    command(source, new GeneratedEncounterPlanSpec(3, "Original label", List.of(
                            slot(100, GeneratedEncounterPlanRole.STANDARD)))))
                    .plans().getFirst().planId();

            RecordingLane retryLane = new RecordingLane();
            GeneratedEncounterPlanImportResult retry = importNow(service(
                    repository,
                    retryLane,
                    Map.of()),
                    retryLane,
                    command(source, new GeneratedEncounterPlanSpec(3, "Changed display label", List.of(
                            slot(100, GeneratedEncounterPlanRole.STANDARD)))));

            assertEquals(GeneratedEncounterPlanImportResult.Status.SUCCESS, retry.status());
            assertEquals(firstPlanId, retry.plans().getFirst().planId());
            assertEquals(1, repository.list().size());
            EncounterPlan saved = repository.load(firstPlanId).orElseThrow();
            assertEquals("Original label", saved.name());
            assertEquals(1L, saved.creatures().getFirst().creatureId());
            assertEquals(1, rowCount(databasePath, "generated_encounter_plan_origins"));
            assertEquals(2, encounterMigrationVersion(databasePath));
        }
    }

    @Test
    void retryMustMatchTheEntireStoredBatchIdentityAndOrder() throws Exception {
        Path databasePath = temporaryDirectory.resolve("whole-batch-retry.db");
        seedCreatures(databasePath, 1L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            GeneratedEncounterPlanSource source = source("whole-batch-run");
            GeneratedEncounterPlanSpec first = new GeneratedEncounterPlanSpec(1, "First", List.of(
                    slot(100, GeneratedEncounterPlanRole.STANDARD)));
            GeneratedEncounterPlanSpec second = new GeneratedEncounterPlanSpec(2, "Second", List.of(
                    slot(100, GeneratedEncounterPlanRole.BRUTE)));

            RecordingLane initialLane = new RecordingLane();
            GeneratedEncounterPlanImportResult initial = importNow(service(
                    repository,
                    initialLane,
                    Map.of(100, List.of(candidate(1L, 100, EncounterRole.STANDARD)))),
                    initialLane,
                    command(source, first, second));
            assertEquals(GeneratedEncounterPlanImportResult.Status.SUCCESS, initial.status());

            RecordingLane identicalLane = new RecordingLane();
            GeneratedEncounterPlanImportResult identical = importNow(service(repository, identicalLane, Map.of()),
                    identicalLane,
                    command(source, first, second));
            assertEquals(GeneratedEncounterPlanImportResult.Status.SUCCESS, identical.status());
            assertEquals(initial.plans(), identical.plans());

            assertRejectedRetry(repository, command(source, first));
            assertRejectedRetry(repository, command(source, second));
            assertRejectedRetry(repository, command(
                    source,
                    first,
                    second,
                    new GeneratedEncounterPlanSpec(3, "Third", List.of(
                            slot(100, GeneratedEncounterPlanRole.STANDARD)))));
            assertRejectedRetry(repository, command(source, second, first));
            assertRejectedRetry(repository, command(
                    source,
                    first,
                    new GeneratedEncounterPlanSpec(2, "Second", List.of(
                            slot(200, GeneratedEncounterPlanRole.BRUTE)))));

            assertEquals(2, rowCount(databasePath, "saved_encounter_plans"));
            assertEquals(2, rowCount(databasePath, "generated_encounter_plan_origins"));
            assertEquals(1, rowCount(databasePath, "generated_encounter_plan_batches"));
        }
    }

    @Test
    void incompleteStoredBatchIsRejectedWithoutRepairWrites() throws Exception {
        Path databasePath = temporaryDirectory.resolve("incomplete-batch.db");
        seedCreatures(databasePath, 1L);
        try (SqliteDatabase database = database(databasePath)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(database);
            GeneratedEncounterPlanSource source = source("incomplete-batch-run");
            GeneratedEncounterPlanSpec first = new GeneratedEncounterPlanSpec(1, "First", List.of(
                    slot(100, GeneratedEncounterPlanRole.STANDARD)));
            GeneratedEncounterPlanSpec second = new GeneratedEncounterPlanSpec(2, "Second", List.of(
                    slot(100, GeneratedEncounterPlanRole.STANDARD)));
            RecordingLane initialLane = new RecordingLane();
            assertEquals(
                    GeneratedEncounterPlanImportResult.Status.SUCCESS,
                    importNow(service(
                            repository,
                            initialLane,
                            Map.of(100, List.of(candidate(1L, 100, EncounterRole.STANDARD)))),
                            initialLane,
                            command(source, first, second)).status());

            executeUpdate(
                    databasePath,
                    "DELETE FROM generated_encounter_plan_origins WHERE encounter_number = 2");

            assertRejectedRetry(repository, command(source, first, second));
            assertEquals(2, rowCount(databasePath, "saved_encounter_plans"));
            assertEquals(1, rowCount(databasePath, "generated_encounter_plan_origins"));
            assertEquals(1, rowCount(databasePath, "generated_encounter_plan_batches"));
        }
    }

    private static void assertRejectedRetry(
            SqliteEncounterPlanRepository repository,
            GeneratedEncounterPlanImportCommand command
    ) {
        RecordingLane lane = new RecordingLane();
        GeneratedEncounterPlanImportResult result = importNow(service(repository, lane, Map.of()), lane, command);
        assertEquals(GeneratedEncounterPlanImportResult.Status.INVALID_REQUEST, result.status());
        assertTrue(result.plans().isEmpty());
    }

    private static GeneratedEncounterPlanImportResult importNow(
            GeneratedEncounterPlanImportService service,
            RecordingLane lane,
            GeneratedEncounterPlanImportCommand command
    ) {
        CompletableFuture<GeneratedEncounterPlanImportResult> future = service.importGeneratedPlans(command)
                .toCompletableFuture();
        lane.runNext();
        return future.join();
    }

    private static GeneratedEncounterPlanImportService service(
            SqliteEncounterPlanRepository repository,
            RecordingLane lane,
            Map<Integer, List<EncounterCandidateProfile>> candidates
    ) {
        return new GeneratedEncounterPlanImportService(
                xp -> candidates.getOrDefault(Integer.valueOf(xp), List.of()),
                repository,
                lane);
    }

    private static GeneratedEncounterPlanImportCommand command(
            GeneratedEncounterPlanSource source,
            GeneratedEncounterPlanSpec... encounters
    ) {
        return new GeneratedEncounterPlanImportCommand(source, List.of(encounters));
    }

    private static GeneratedEncounterPlanSource source(String generationId) {
        return new GeneratedEncounterPlanSource("engine-v1", generationId);
    }

    private static GeneratedEncounterPlanSlotSpec slot(long xp, GeneratedEncounterPlanRole role) {
        return new GeneratedEncounterPlanSlotSpec(xp, role);
    }

    private static EncounterCandidateProfile candidate(long id, int xp, EncounterRole role) {
        EncounterCreatureFacts facts = new EncounterCreatureFacts(
                id,
                "Creature " + id,
                "",
                "",
                xp,
                20,
                null,
                null,
                null,
                12,
                0,
                0,
                0,
                0,
                0,
                0,
                null,
                null,
                null,
                10,
                List.of());
        return new EncounterCandidateProfile(
                facts,
                EncounterCandidateCombatStats.fromFacts(facts),
                role,
                1);
    }

    private static SqliteDatabase database(Path path) {
        return new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
    }

    private static void seedCreatures(Path databasePath, long... ids) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("CREATE TABLE creatures(id INTEGER PRIMARY KEY)");
            for (long id : ids) {
                statement.execute("INSERT INTO creatures(id) VALUES (" + id + ")");
            }
        }
    }

    private static int rowCount(Path databasePath, String table) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var result = connection.createStatement().executeQuery("SELECT COUNT(*) FROM " + table)) {
            return result.getInt(1);
        }
    }

    private static void executeUpdate(Path databasePath, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private static int encounterMigrationVersion(Path databasePath) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.prepareStatement(
                        "SELECT version FROM sm_schema_versions WHERE owner = ?")) {
            statement.setString(1, "encounter");
            try (var result = statement.executeQuery()) {
                return result.next() ? result.getInt(1) : 0;
            }
        }
    }

    private static final class RecordingLane implements ExecutionLane {

        private final ArrayDeque<Runnable> work = new ArrayDeque<>();

        @Override
        public void execute(Runnable action) {
            work.addLast(action);
        }

        void runNext() {
            work.removeFirst().run();
        }

        @Override
        public void close() {
            work.clear();
        }
    }

    private static final class RejectingLane implements ExecutionLane {

        @Override
        public void execute(Runnable action) {
            throw new IllegalStateException("lane rejected work");
        }

        @Override
        public void close() {
        }
    }

    private static final class InMemoryBatchRepository implements GeneratedEncounterPlanBatchRepository {

        @Override
        public java.util.Optional<StoredBatch> loadGeneratedBatch(GeneratedEncounterPlanSource source) {
            return java.util.Optional.empty();
        }

        @Override
        public StoredBatch saveGeneratedBatch(
                GeneratedEncounterPlanSource source,
                String batchFingerprint,
                List<ResolvedPlan> plans
        ) {
            throw new IllegalStateException("storage unavailable");
        }
    }

}
