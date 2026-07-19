package features.sessiongeneration.adapter.sqlite.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GeneratedRunDraft;
import features.sessiongeneration.domain.generation.GenerationInput;
import features.sessiongeneration.domain.generation.GenerationRewardReference;
import features.sessiongeneration.domain.generation.GenerationRunCommitResult;
import features.sessiongeneration.domain.generation.GenerationRunIdentityConflictException;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

final class SqliteGenerationRunRepositoryTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void firstCommitInsertsEqualRetryIsAlreadyPresentAndRoundTripPreservesMeaning() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("roundtrip.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);

            assertEquals(GenerationRunCommitResult.Outcome.INSERTED, repository.commit(draft).outcome());
            assertEquals(GenerationRunCommitResult.Outcome.ALREADY_PRESENT, repository.commit(draft).outcome());
            assertEquals(draft, repository.load(draft.run().runId()).orElseThrow());
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement();
                var rows = statement.executeQuery(
                        "SELECT owner, schema_version, content_fingerprint FROM session_generation_runs")) {
            assertTrue(rows.next());
            assertEquals("session-generation", rows.getString(1));
            assertEquals(1, rows.getInt(2));
            assertEquals(draft.contentFingerprint(), rows.getString(3));
        }
    }

    @Test
    void sameIdentityWithDifferentSemanticFingerprintFailsClosed() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("conflict.sqlite");
        GeneratedRun original = generate(179974L);
        GeneratedRun changed = withSeed(original, original.seed() + 1L);
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.commit(GeneratedRunDraft.from(original));

            assertThrows(GenerationRunIdentityConflictException.class,
                    () -> repository.commit(GeneratedRunDraft.from(changed)));
            assertEquals(original, repository.load(original.runId()).orElseThrow().run());
        }
    }

    @Test
    void equalConcurrentCommitRaceConvergesOnOneInsertAndOneAlreadyPresent() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("race.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
                var workers = Executors.newFixedThreadPool(2)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            List<java.util.concurrent.Future<GenerationRunCommitResult.Outcome>> outcomes = new ArrayList<>();
            for (int index = 0; index < 2; index++) {
                outcomes.add(workers.submit(() -> {
                    ready.countDown();
                    start.await();
                    return repository.commit(draft).outcome();
                }));
            }
            ready.await();
            start.countDown();

            assertEquals(
                    java.util.Set.of(
                            GenerationRunCommitResult.Outcome.INSERTED,
                            GenerationRunCommitResult.Outcome.ALREADY_PRESENT),
                    java.util.Set.of(outcomes.get(0).get(), outcomes.get(1).get()));
        }
    }

    @Test
    void failedChildInsertRollsBackEntireImmutableRun() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("rollback.sqlite");
        GeneratedRunDraft first = GeneratedRunDraft.from(generate(179974L));
        GeneratedRunDraft blocked = GeneratedRunDraft.from(generate(179975L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.commit(first);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER fail_generation_loot BEFORE INSERT ON session_generation_loot_items "
                        + "BEGIN SELECT RAISE(ABORT, 'forced rollback'); END");
            }

            assertThrows(IllegalStateException.class, () -> repository.commit(blocked));
            assertTrue(repository.load(blocked.run().runId()).isEmpty());
            assertTrue(repository.load(first.run().runId()).isPresent());
        }
    }

    @Test
    void v1CanonicalRowsMigrateAndDeriveFingerprintWithoutReadRewrite() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("legacy-v1.sqlite");
        GeneratedRun legacy = generate(179974L);
        SessionGenerationSchema schema = new SessionGenerationSchema();
        try (SqliteDatabase v1 = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
                var connection = v1.connections(
                        SqliteGenerationRunRepository.OWNER,
                        new SqliteMigration(1, schema::migrateV1)).openConnection()) {
            new GenerationRunSqliteWriter().insertLegacyV1(connection, legacy);
        }

        GeneratedRunDraft loaded;
        try (SqliteDatabase migrated = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            loaded = new SqliteGenerationRunRepository(migrated).load(legacy.runId()).orElseThrow();
        }
        assertEquals(legacy, loaded.run());

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement();
                var rows = statement.executeQuery(
                        "SELECT content_fingerprint FROM session_generation_runs WHERE run_id = '" + legacy.runId() + "'")) {
            assertTrue(rows.next());
            assertNull(rows.getString(1));
        }
    }

    @Test
    void rewardBatchPreservesCallerOrderDuplicatesAndMissingAcrossChunks() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("rewards.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.commit(draft);
            GenerationRewardReference present = new GenerationRewardReference(draft.run().runId(), 1);
            GenerationRewardReference missing = new GenerationRewardReference(draft.run().runId(), 999);
            List<GenerationRewardReference> requested = new ArrayList<>();
            requested.add(present);
            requested.add(missing);
            requested.add(present);
            for (int index = 1; index <= 400; index++) {
                requested.add(new GenerationRewardReference("missing-run-" + index, 1));
            }

            AtomicInteger statements = new AtomicInteger();
            SqliteGenerationRunRepository counted = new SqliteGenerationRunRepository(
                    () -> executedStatementConnection(databasePath, statements));
            var batch = counted.loadRewards(requested);

            assertEquals(List.of(present, present), batch.resolved().stream()
                    .map(value -> value.reference()).toList());
            assertEquals(requested.size() - 2, batch.missing().size());
            assertEquals(missing, batch.missing().getFirst());
            assertEquals(draft.run().treasures().getFirst(), batch.resolved().getFirst().treasure());
            assertEquals(
                    draft.run().loot().stream().filter(line -> line.treasureId() == 1).toList(),
                    batch.resolved().getFirst().loot());
            assertEquals(5, statements.get(),
                    "temp-table setup, insert, set-based select, and cleanup are counted honestly");
        }
    }

    @Test
    void emptyRewardBatchOpensNoSqliteConnection() {
        SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                () -> { throw new AssertionError("empty reward batch must not open SQLite"); });

        assertTrue(repository.loadRewards(List.of()).resolved().isEmpty());
    }

    @Test
    void rewardBatchDeduplicatesSqlKeysButReconstructsEveryCallerDuplicate() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("reward-dedup.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            new SqliteGenerationRunRepository(database).commit(draft);
            GenerationRewardReference repeated = new GenerationRewardReference(draft.run().runId(), 1);
            List<GenerationRewardReference> requested = java.util.Collections.nCopies(
                    401, repeated);
            AtomicInteger statements = new AtomicInteger();
            SqliteGenerationRunRepository counted = new SqliteGenerationRunRepository(
                    () -> executedStatementConnection(databasePath, statements));

            var batch = counted.loadRewards(requested);

            assertEquals(requested.size(), batch.resolved().size());
            assertEquals(5, statements.get());
        }
    }

    @Test
    void rewardBatchExecutesTheSameFiveStatementFamiliesForOneFourHundredOneAndEightHundredReferences() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("reward-cardinality.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            new SqliteGenerationRunRepository(database).commit(draft);
        }
        GenerationRewardReference present = new GenerationRewardReference(draft.run().runId(), 1);
        for (int cardinality : List.of(1, 401, 800)) {
            List<GenerationRewardReference> requested = new ArrayList<>();
            requested.add(present);
            for (int index = 1; index < cardinality; index++) {
                requested.add(new GenerationRewardReference("missing-" + cardinality + "-" + index, 1));
            }
            AtomicInteger statements = new AtomicInteger();
            SqliteGenerationRunRepository counted = new SqliteGenerationRunRepository(
                    () -> executedStatementConnection(databasePath, statements));

            var batch = counted.loadRewards(requested);

            assertEquals(1, batch.resolved().size());
            assertEquals(cardinality - 1, batch.missing().size());
            assertEquals(5, statements.get(), "cardinality=" + cardinality);
        }
    }

    @Test
    void rewardRequestTableIsClearedAfterPartialInsertFailureAndCanBeReused() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("reward-cleanup.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            new SqliteGenerationRunRepository(database).commit(draft);
        }
        GenerationRewardReference present = new GenerationRewardReference(draft.run().runId(), 1);
        GenerationRewardReference missing = new GenerationRewardReference("missing-run", 1);
        GenerationRewardSqliteReader reader = new GenerationRewardSqliteReader();
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            reader.load(connection, List.of(present));
            try (var statement = connection.createStatement()) {
                statement.execute("CREATE TEMP TRIGGER fail_second_reward_request BEFORE INSERT "
                        + "ON temp_generation_reward_requests WHEN NEW.request_order=1 "
                        + "BEGIN SELECT RAISE(ABORT, 'forced request failure'); END");
            }

            assertThrows(java.sql.SQLException.class, () -> reader.load(connection, List.of(present, missing)));
            try (var rows = connection.createStatement().executeQuery(
                    "SELECT COUNT(*) FROM temp_generation_reward_requests")) {
                assertTrue(rows.next());
                assertEquals(0, rows.getInt(1));
            }
            try (var statement = connection.createStatement()) {
                statement.execute("DROP TRIGGER fail_second_reward_request");
            }
            assertEquals(1, reader.load(connection, List.of(present)).batch().resolved().size());
        }
    }

    @Test
    void connectionScopedRewardRequestsAreSafeAcrossConcurrentReads() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("reward-concurrent.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            new SqliteGenerationRunRepository(database).commit(draft);
        }
        GenerationRewardReference present = new GenerationRewardReference(draft.run().runId(), 1);
        List<GenerationRewardReference> requested = new ArrayList<>();
        requested.add(present);
        for (int index = 1; index < 800; index++) {
            requested.add(new GenerationRewardReference("concurrent-missing-" + index, 1));
        }
        SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                () -> DriverManager.getConnection("jdbc:sqlite:" + databasePath));
        try (var workers = Executors.newFixedThreadPool(2)) {
            var first = workers.submit(() -> repository.loadRewards(requested));
            var second = workers.submit(() -> repository.loadRewards(List.of(present, present)));

            assertEquals(1, first.get().resolved().size());
            assertEquals(2, second.get().resolved().size());
        }
    }

    @Test
    void loadRejectsCorruptedAggregateSummaryAndFingerprint() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("corrupt.sqlite");
        GeneratedRunDraft generated = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.commit(generated);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.executeUpdate("UPDATE session_generation_runs SET normal_actual_cp = normal_actual_cp + 1");
            }

            assertThrows(IllegalStateException.class, () -> repository.load(generated.run().runId()));
        }
    }

    @Test
    void canonicalLoadUsesFixedQueryFamiliesRatherThanPerEncounterReads() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("load-query-bound.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository writer = new SqliteGenerationRunRepository(database);
            writer.commit(draft);
            for (long seed = 200_000L; seed < 200_032L; seed++) {
                writer.commit(GeneratedRunDraft.from(generate(seed)));
            }
            AtomicInteger queries = new AtomicInteger();
            SqliteGenerationRunRepository counted = new SqliteGenerationRunRepository(
                    () -> countingConnection(databasePath, queries));

            assertEquals(draft, counted.load(draft.run().runId()).orElseThrow());
            assertEquals(9, queries.get());
        }
    }

    private static GeneratedRun withSeed(GeneratedRun run, long seed) {
        return new GeneratedRun(
                run.runId(), run.engineVersion(), run.catalogVersion(), run.catalogContentHash(), seed,
                run.party(), run.session(), run.encounterTargets(), run.encounters(), run.treasures(), run.loot(),
                run.packing(), run.rewards(), run.formattedText(), run.audits());
    }

    static GeneratedRun generate(long seed) {
        return new SessionGenerationEngine().generate(
                new GenerationInput(
                        List.of(new GeneratedRun.PartyLevel(3, 2), new GeneratedRun.PartyLevel(4, 2)),
                        new BigDecimal("0.6"), OptionalInt.of(3), seed),
                new TsvGenerationCatalog().load());
    }

    private static java.sql.Connection countingConnection(
            java.nio.file.Path databasePath,
            AtomicInteger queries
    ) throws java.sql.SQLException {
        java.sql.Connection delegate = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (var statement = delegate.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
        }
        return (java.sql.Connection) Proxy.newProxyInstance(
                SqliteGenerationRunRepositoryTest.class.getClassLoader(),
                new Class<?>[] {java.sql.Connection.class},
                (proxy, method, arguments) -> {
                    if (method.getName().equals("prepareStatement")) {
                        queries.incrementAndGet();
                    }
                    try {
                        return method.invoke(delegate, arguments);
                    } catch (InvocationTargetException exception) {
                        throw exception.getCause();
                    }
                });
    }

    private static java.sql.Connection executedStatementConnection(
            java.nio.file.Path databasePath,
            AtomicInteger statements
    ) throws java.sql.SQLException {
        java.sql.Connection delegate = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        try (var statement = delegate.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
        }
        return (java.sql.Connection) Proxy.newProxyInstance(
                SqliteGenerationRunRepositoryTest.class.getClassLoader(),
                new Class<?>[] {java.sql.Connection.class},
                (proxy, method, arguments) -> {
                    try {
                        Object result = method.invoke(delegate, arguments);
                        if (method.getName().equals("createStatement")) {
                            return countedStatement((java.sql.Statement) result, statements);
                        }
                        if (method.getName().equals("prepareStatement")) {
                            return countedPreparedStatement((java.sql.PreparedStatement) result, statements);
                        }
                        return result;
                    } catch (InvocationTargetException exception) {
                        throw exception.getCause();
                    }
                });
    }

    private static java.sql.Statement countedStatement(java.sql.Statement delegate, AtomicInteger statements) {
        return (java.sql.Statement) Proxy.newProxyInstance(
                SqliteGenerationRunRepositoryTest.class.getClassLoader(),
                new Class<?>[] {java.sql.Statement.class},
                (proxy, method, arguments) -> invokeCounted(delegate, method, arguments, statements));
    }

    private static java.sql.PreparedStatement countedPreparedStatement(
            java.sql.PreparedStatement delegate,
            AtomicInteger statements
    ) {
        return (java.sql.PreparedStatement) Proxy.newProxyInstance(
                SqliteGenerationRunRepositoryTest.class.getClassLoader(),
                new Class<?>[] {java.sql.PreparedStatement.class},
                (proxy, method, arguments) -> invokeCounted(delegate, method, arguments, statements));
    }

    private static Object invokeCounted(
            Object delegate,
            java.lang.reflect.Method method,
            Object[] arguments,
            AtomicInteger statements
    ) throws Throwable {
        if (method.getName().equals("execute") || method.getName().equals("executeQuery")
                || method.getName().equals("executeUpdate") || method.getName().equals("executeBatch")) {
            statements.incrementAndGet();
        }
        try {
            return method.invoke(delegate, arguments);
        } catch (InvocationTargetException exception) {
            throw exception.getCause();
        }
    }

}
