package features.sessiongeneration.adapter.sqlite.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

final class SqliteGenerationRunRepositoryTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void firstCommitInsertsEqualRetryIsAlreadyPresentAndRoundTripPreservesMeaning() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("roundtrip.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));

            assertEquals(GenerationRunCommitResult.Outcome.INSERTED, repository.commit(draft).outcome());
            assertEquals(GenerationRunCommitResult.Outcome.ALREADY_PRESENT, repository.commit(draft).outcome());
            assertEquals(draft, repository.load(draft.run().runId()).orElseThrow());
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement();
                var rows = statement.executeQuery(
                                "SELECT owner, schema_version, content_fingerprint FROM"
                                    + " session_generation_runs")) {
            assertTrue(rows.next());
            assertEquals("session-generation", rows.getString(1));
            assertEquals(1, rows.getInt(2));
            assertEquals(draft.contentFingerprint(), rows.getString(3));
        }

        try (SqliteDatabase reopened = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            assertEquals(draft, repository(reopened).load(draft.run().runId()).orElseThrow());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(
                     "SELECT version FROM sm_schema_versions WHERE owner='session-generation'")) {
            assertTrue(rows.next());
            assertEquals(1, rows.getInt(1));
        }
    }

    @Test
    void sameIdentityWithDifferentSemanticFingerprintFailsClosed() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("conflict.sqlite");
        GeneratedRun original = generate(179974L);
        GeneratedRun changed = withSeed(original, original.seed() + 1L);
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
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
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
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
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
            repository.commit(first);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.execute(
                        "CREATE TRIGGER fail_generation_loot BEFORE INSERT ON"
                            + " session_generation_loot_items BEGIN SELECT RAISE(ABORT, 'forced"
                            + " rollback'); END");
            }

            assertThrows(IllegalStateException.class, () -> repository.commit(blocked));
            assertTrue(repository.load(blocked.run().runId()).isEmpty());
            assertTrue(repository.load(first.run().runId()).isPresent());
        }
    }

    @Test
    void predecessorVersionOneWithoutFingerprintFailsClosedUnchanged() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("predecessor-v1.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            for (String sql : SessionGenerationSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(", content_fingerprint TEXT NOT NULL", ""));
            }
            statement.execute("INSERT INTO session_generation_runs "
                    + "(run_id, owner, schema_version, engine_version, catalog_version, catalog_hash, seed, "
                    + "adventure_fraction, encounter_count, party_count, day_xp_budget, session_xp_target, "
                    + "average_level, normal_budget_cp, overstock_budget_cp, nonmagic_slots, normal_magic, "
                    + "overstock_magic, treasure_count, normal_actual_cp, overstock_actual_cp, magic_count, "
                    + "formatted_text) VALUES "
                    + "('predecessor', 'session-generation', 1, 'e', 'c', 'h', 1, '0.5', 1, 1, "
                    + "100, 50, '1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 'kept')");
        }

        assertUnavailable(databasePath);

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(0, columnCount(connection, SessionGenerationSchema.RUNS, "content_fingerprint"));
            assertEquals("kept", scalarText(connection,
                    "SELECT formatted_text FROM session_generation_runs WHERE run_id='predecessor'"));
        }
    }

    @Test
    void unversionedPartialAndNewerShapesFailClosedWithoutClaimOrMutation() throws Exception {
        java.nio.file.Path partial = temporaryDirectory.resolve("unversioned-partial.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + partial);
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE session_generation_runs(run_id TEXT PRIMARY KEY, marker TEXT NOT NULL)");
            statement.execute("INSERT INTO session_generation_runs VALUES('partial', 'kept')");
        }
        assertUnavailable(partial);
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + partial)) {
            assertEquals("kept", scalarText(connection,
                    "SELECT marker FROM session_generation_runs WHERE run_id='partial'"));
            assertFalse(ownerVersionExists(connection));
            assertEquals(2, columnCount(connection, SessionGenerationSchema.RUNS, null));
        }

        java.nio.file.Path newer = temporaryDirectory.resolve("newer-v2.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + newer);
             var statement = connection.createStatement()) {
            createVersionTable(statement, 2);
            statement.execute("CREATE TABLE session_generation_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO session_generation_retired VALUES('newer')");
        }
        assertUnavailable(newer);
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + newer)) {
            assertEquals(2, featureVersion(connection));
            assertEquals("newer", scalarText(connection, "SELECT payload FROM session_generation_retired"));
        }
    }

    @Test
    void adjacentOwnerObjectAtCurrentVersionFailsClosedUnchanged() throws Exception {
        java.nio.file.Path path = temporaryDirectory.resolve("adjacent-current.sqlite");
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            for (String sql : SessionGenerationSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            statement.execute("CREATE TABLE session_generation_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO session_generation_retired VALUES('kept')");
        }

        assertUnavailable(path);

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals("kept", scalarText(connection, "SELECT payload FROM session_generation_retired"));
        }
    }

    @Test
    void rewardBatchPreservesCallerOrderDuplicatesAndMissingAcrossChunks() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("rewards.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
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
            new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition())).commit(draft);
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
            new SqliteGenerationRunRepository(TestFeatureStores.store(
                    database, SqliteGenerationRunRepository.storeDefinition())).commit(draft);
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
            new SqliteGenerationRunRepository(TestFeatureStores.store(
                    database, SqliteGenerationRunRepository.storeDefinition())).commit(draft);
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
            new SqliteGenerationRunRepository(TestFeatureStores.store(
                    database, SqliteGenerationRunRepository.storeDefinition())).commit(draft);
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
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(
                            TestFeatureStores.store(
                                    database, SqliteGenerationRunRepository.storeDefinition()));
            repository.commit(generated);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.executeUpdate(
                        "UPDATE session_generation_runs SET normal_actual_cp = normal_actual_cp +"
                            + " 1");
            }

            assertThrows(IllegalStateException.class, () -> repository.load(generated.run().runId()));
        }
    }

    @Test
    void canonicalLoadUsesFixedQueryFamiliesRatherThanPerEncounterReads() {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("load-query-bound.sqlite");
        GeneratedRunDraft draft = GeneratedRunDraft.from(generate(179974L));
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository writer = new SqliteGenerationRunRepository(
                    TestFeatureStores.store(
                            database, SqliteGenerationRunRepository.storeDefinition()));
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

    private static SqliteGenerationRunRepository repository(SqliteDatabase database) {
        return new SqliteGenerationRunRepository(TestFeatureStores.store(
                database, SqliteGenerationRunRepository.storeDefinition()));
    }

    private static void assertUnavailable(java.nio.file.Path path) {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = repository(database);
            assertThrows(IllegalStateException.class, () -> repository.load("probe"));
        }
    }

    private static void createVersionTable(java.sql.Statement statement, int version) throws Exception {
        statement.execute("PRAGMA user_version = 1");
        statement.execute("CREATE TABLE sm_schema_versions "
                + "(owner TEXT PRIMARY KEY, version INTEGER NOT NULL CHECK(version >= 0))");
        statement.execute("INSERT INTO sm_schema_versions(owner, version) "
                + "VALUES ('session-generation', " + version + ")");
    }

    private static int featureVersion(java.sql.Connection connection) throws Exception {
        return scalarInt(connection,
                "SELECT version FROM sm_schema_versions WHERE owner='session-generation'");
    }

    private static boolean ownerVersionExists(java.sql.Connection connection) throws Exception {
        if (scalarInt(connection,
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sm_schema_versions'") == 0) {
            return false;
        }
        return scalarInt(connection,
                "SELECT COUNT(*) FROM sm_schema_versions WHERE owner='session-generation'") != 0;
    }

    private static int columnCount(
            java.sql.Connection connection,
            String table,
            String column
    ) throws Exception {
        String where = column == null ? "" : " WHERE name='" + column + "'";
        return scalarInt(connection, "SELECT COUNT(*) FROM pragma_table_info('" + table + "')" + where);
    }

    private static int scalarInt(java.sql.Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static String scalarText(java.sql.Connection connection, String sql) throws Exception {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            return result.next() ? result.getString(1) : "";
        }
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
