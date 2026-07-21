package features.encounter.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.adapter.sqlite.query.SqliteCreatureCatalogQueryAdapter;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterSource;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterCreature;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.application.GeneratedEncounterBatchRepository;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.RepetitionInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.DriverManager;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;

final class GeneratedEncounterBatchSqliteTest {

    @TempDir
    Path directory;

    @Test
    void commitsReadsBackAndReturnsCompleteEqualRetry() throws Exception {
        Path path = directory.resolve("commit.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L, 12L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch batch = batch("prep", "run", List.of(
                    roster(1, 11L, "Guard"), roster(2, 12L, "Scout")));

            var committed = repository.commit(batch);
            var retried = repository.commit(batch);

            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED, committed.status());
            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.EQUAL_RETRY, retried.status());
            assertEquals(committed.mappings(), retried.mappings());
            var plans = repository.loadPlansByIds(List.of(
                    committed.mappings().get(1).planId(), 999L, committed.mappings().get(0).planId()));
            assertEquals(List.of("Encounter 2", "Encounter 1"), plans.stream().map(plan -> plan.name()).toList());
            assertEquals("Scout", plans.getFirst().creatures().getFirst().lastKnownDisplayName());
            var origin = repository.load(committed.mappings().getFirst().planId())
                    .orElseThrow().origin().orElseThrow();
            assertEquals("prep", origin.preparationIdentity());
            assertEquals("run", origin.generationRunIdentity());
            assertEquals(fingerprint("|11:1"), origin.rosterFingerprint());
            assertEquals(2L, rowCount(path, "saved_encounter_plans"));
            assertEquals(2L, rowCount(path, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void savedPlanSearchUsesLiteralSafePersistedChooserTextAndDeterministicBoundedRoots() throws Exception {
        Path path = directory.resolve("search.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            for (int index = 1; index <= 10; index++) {
                repository.save(new features.encounter.domain.plan.EncounterPlan(
                        0L,
                        index == 1 ? "Literal %_ Plan" : "Search Plan " + index,
                        "Generated Label " + index,
                        List.of(new features.encounter.domain.plan.EncounterPlanCreature(11L, 1, "Guard"))));
            }

            var bounded = repository.searchSavedPlans("plan", 9);
            var literal = repository.searchSavedPlans("%_", 9);
            var generated = repository.searchSavedPlans("generated label 7", 9);

            assertEquals(9, bounded.plans().size());
            assertEquals(List.of(10L, 9L, 8L, 7L, 6L, 5L, 4L, 3L, 2L),
                    bounded.plans().stream().map(features.encounter.domain.plan.EncounterPlanSummary::id).toList());
            assertEquals(List.of("Literal %_ Plan"), literal.plans().stream()
                    .map(features.encounter.domain.plan.EncounterPlanSummary::name).toList());
            assertEquals(List.of(7L), generated.plans().stream()
                    .map(features.encounter.domain.plan.EncounterPlanSummary::id).toList());
            assertEquals(1, bounded.statementCount());
        }
    }

    @Test
    void rejectsEveryIdentityContentAndCardinalityConflictWithoutWrites() throws Exception {
        Path path = directory.resolve("conflicts.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L, 12L, 13L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch original = batch("prep", "run", List.of(
                    roster(1, 11L, "Guard"), roster(2, 12L, "Scout")));
            repository.commit(original);

            List<PreparedEncounterBatch> conflicts = List.of(
                    batch("prep", "other-run", original.rosters()),
                    batch("prep", "run", List.of(original.rosters().getFirst())),
                    batch("prep", "run", List.of(
                            original.rosters().get(1), original.rosters().get(0))),
                    batch("prep", "run", List.of(
                            rosterWithFingerprints(
                                    1, 11L, "Guard", "changed-intent", fingerprint("|11:1")),
                            original.rosters().get(1))),
                    batch("prep", "run", List.of(
                            rosterWithFingerprints(1, 13L, "Mage", "i1", "changed-roster"),
                            original.rosters().get(1))),
                    batch("prep", "run", List.of(
                            rosterWithLabel(
                                    1, 11L, "Guard", "Changed label", "i1", fingerprint("|11:1")),
                            original.rosters().get(1))));

            for (PreparedEncounterBatch conflict : conflicts) {
                assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT,
                        repository.commit(conflict).status());
            }
            assertEquals(2L, rowCount(path, "saved_encounter_plans"));
            assertEquals(2L, rowCount(path, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void rejectsEqualRetryWhenStoredRosterQuantityOrOrderNoLongerMatchesOrigin() throws Exception {
        Path path = directory.resolve("stored-roster-conflict.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L, 12L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch batch = batch("stored-roster", "run", List.of(multiRoster()));
            long planId = repository.commit(batch).mappings().getFirst().planId();

            execute(path, "UPDATE saved_encounter_plan_creatures SET quantity=2 "
                    + "WHERE plan_id=" + planId + " AND creature_id=11");
            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT,
                    repository.commit(batch).status());

            execute(path, "UPDATE saved_encounter_plan_creatures SET quantity=1, "
                    + "sort_order=CASE creature_id WHEN 11 THEN 1 ELSE 0 END WHERE plan_id=" + planId);
            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT,
                    repository.commit(batch).status());
            assertEquals(1L, rowCount(path, "saved_encounter_plans"));
            assertEquals(2L, rowCount(path, "saved_encounter_plan_creatures"));
        }
    }

    @Test
    void rejectsEqualRetryWhenStoredGeneratedLabelNoLongerMatchesPreparedLabel() throws Exception {
        Path path = directory.resolve("stored-label-conflict.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch batch = batch("stored-label", "run", List.of(roster(1, 11L, "Guard")));
            long planId = repository.commit(batch).mappings().getFirst().planId();

            execute(path, "UPDATE saved_encounter_plans SET generated_label='Tampered' WHERE plan_id=" + planId);

            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT,
                    repository.commit(batch).status());
            assertEquals(1L, rowCount(path, "saved_encounter_plans"));
            assertEquals(1L, rowCount(path, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void canonicalRetryRequiresStoredOriginRosterFingerprintAsWellAsDerivedRoster() throws Exception {
        Path path = directory.resolve("canonical-origin-conflict.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch batch = batch("canonical-origin", "run", List.of(roster(1, 11L, "Guard")));
            repository.commit(batch);

            execute(path, "UPDATE generated_encounter_plan_origins SET roster_fingerprint='' "
                    + "WHERE engine_version='engine' AND generation_id='run'");

            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.CONFLICT,
                    repository.commit(batch).status());
            assertEquals(1L, rowCount(path, "saved_encounter_plans"));
        }
    }

    @RepeatedTest(20)
    void concurrentCanonicalIdentityRaceReturnsOneCommitAndOneEqualRetry(
            RepetitionInfo repetition
    ) throws Exception {
        Path path = directory.resolve("race-" + repetition.getCurrentRepetition() + ".sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L, 12L)) {
            SqliteEncounterPlanRepository first = fixture.repository();
            SqliteEncounterPlanRepository second = fixture.repository();
            PreparedEncounterBatch batch = batch("race-prep", "race-run", List.of(
                    roster(1, 11L, "Guard"), roster(2, 12L, "Scout")));
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            var executor = Executors.newFixedThreadPool(2);
            try {
                var left = executor.submit(() -> raceCommit(first, batch, ready, start));
                var right = executor.submit(() -> raceCommit(second, batch, ready, start));
                ready.await();
                start.countDown();
                var statuses = List.of(left.get().status(), right.get().status());

                assertTrue(statuses.contains(GeneratedEncounterBatchRepository.CommitOutcome.Status.COMMITTED));
                assertTrue(statuses.contains(GeneratedEncounterBatchRepository.CommitOutcome.Status.EQUAL_RETRY));
                assertEquals(2L, rowCount(path, "saved_encounter_plans"));
                assertEquals(2L, rowCount(path, "generated_encounter_plan_origins"));
            } finally {
                executor.shutdownNow();
            }
        }
    }

    @Test
    void rollsBackEveryRootChildBatchAndOriginWhenAnyCreatureIsMissing() throws Exception {
        Path path = directory.resolve("rollback.sqlite");
        try (DatabaseFixture fixture = databaseWithCreatures(path, 11L)) {
            SqliteEncounterPlanRepository repository = fixture.repository();
            PreparedEncounterBatch batch = batch("rollback-prep", "rollback-run", List.of(
                    roster(1, 11L, "Guard"), roster(2, 999L, "Missing")));

            assertThrows(IllegalStateException.class, () -> repository.commit(batch));
            assertEquals(0L, rowCount(path, "saved_encounter_plans"));
            assertEquals(0L, rowCount(path, "saved_encounter_plan_creatures"));
            assertEquals(0L, rowCount(path, "generated_encounter_plan_batches"));
            assertEquals(0L, rowCount(path, "generated_encounter_plan_origins"));
        }
    }

    @Test
    void migratesV3AdditivelyAndDerivesHistoricalPreparationAndRosterIdentityOnRead() throws Exception {
        Path path = directory.resolve("v3-to-v4.sqlite");
        seedV3(path);
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteEncounterPlanRepository repository = new SqliteEncounterPlanRepository(
                            TestFeatureStores.store(
                                    database, SqliteEncounterPlanRepository.storeDefinition()));
            PreparedEncounterCreature creature = new PreparedEncounterCreature(11L, 1, "Current Guard");
            PreparedEncounterRoster roster = new PreparedEncounterRoster(
                    1, "Legacy", "i1", sha256("|11:1"), List.of(creature),
                    new GeneratedEncounterPlanSummary(
                            0L, "Legacy", List.of(creature), 1, 100L, 100L,
                            GeneratedEncounterDifficulty.EASY, "1x Current Guard"));
            PreparedEncounterBatch retry = new PreparedEncounterBatch(
                    new GeneratedEncounterSource("engine", "legacy-run", "legacy-run"),
                    "legacy-batch", List.of(roster));

            assertEquals(GeneratedEncounterBatchRepository.CommitOutcome.Status.EQUAL_RETRY,
                    repository.commit(retry).status());
            var historical = repository.load(1L).orElseThrow().origin().orElseThrow();
            assertEquals("legacy-run", historical.preparationIdentity());
            assertEquals("legacy-run", historical.generationRunIdentity());
            assertEquals(sha256("|11:1"), historical.rosterFingerprint());
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path)) {
            assertTrue(hasColumn(connection, "saved_encounter_plan_creatures", "last_known_display_name"));
            assertTrue(hasColumn(connection, "generated_encounter_plan_batches", "preparation_id"));
            assertTrue(hasColumn(connection, "generated_encounter_plan_origins", "roster_fingerprint"));
            try (var rows = connection.createStatement().executeQuery(
                                    "SELECT version FROM sm_schema_versions WHERE"
                                        + " owner='encounter'")) {
                assertTrue(rows.next());
                assertEquals(5, rows.getInt(1));
            }
        }
    }

    private static DatabaseFixture databaseWithCreatures(Path path, Long... ids) throws Exception {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        var stores =
                TestFeatureStores.stores(
                        database,
                        SqliteCreatureCatalogQueryAdapter.storeDefinition(),
                        SqliteEncounterPlanRepository.storeDefinition());
        new SqliteCreatureCatalogQueryAdapter(stores.get("creatures")).loadFilterValues();
        for (Long id : ids) {
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                    var statement = connection.prepareStatement(
                                    "INSERT INTO creatures"
                                        + " (id,name,size,creature_type,alignment,cr,xp,hp,ac)"
                                        + " VALUES (?,?,?,?,?,?,?,?,?)")) {
                statement.setLong(1, id.longValue());
                statement.setString(2, "Creature " + id);
                statement.setString(3, "Medium");
                statement.setString(4, "humanoid");
                statement.setString(5, "neutral");
                statement.setString(6, "1/2");
                statement.setInt(7, 100);
                statement.setInt(8, 20);
                statement.setInt(9, 14);
                statement.executeUpdate();
            }
        }
        return new DatabaseFixture(database, stores.get("encounter"));
    }

    private record DatabaseFixture(
            SqliteDatabase database, FeatureStoreHandle encounterStore) implements AutoCloseable {

        private SqliteEncounterPlanRepository repository() {
            return new SqliteEncounterPlanRepository(encounterStore);
        }

        @Override
        public void close() {
            database.close();
        }
    }

    private static PreparedEncounterBatch batch(
            String preparation, String run, List<PreparedEncounterRoster> rosters
    ) {
        return new PreparedEncounterBatch(
                new GeneratedEncounterSource("engine", preparation, run),
                "batch-" + preparation + '-' + run + '-' + rosters.stream()
                        .map(PreparedEncounterRoster::intentFingerprint).toList(),
                rosters);
    }

    private static PreparedEncounterRoster roster(int number, long creatureId, String name) {
        return rosterWithFingerprints(
                number, creatureId, name, "i" + number, fingerprint("|" + creatureId + ":1"));
    }

    private static PreparedEncounterRoster multiRoster() {
        List<PreparedEncounterCreature> creatures = List.of(
                new PreparedEncounterCreature(11L, 1, "Guard"),
                new PreparedEncounterCreature(12L, 1, "Scout"));
        return new PreparedEncounterRoster(
                1, "Encounter 1", "i1", fingerprint("|11:1|12:1"), creatures,
                new GeneratedEncounterPlanSummary(
                        0L, "Encounter 1", creatures, 2, 200L, 300L,
                        GeneratedEncounterDifficulty.MEDIUM, "1x Guard, 1x Scout"));
    }

    private static PreparedEncounterRoster rosterWithFingerprints(
            int number, long creatureId, String name, String intentFingerprint, String rosterFingerprint
    ) {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(creatureId, 1, name);
        GeneratedEncounterPlanSummary summary = new GeneratedEncounterPlanSummary(
                0L, "Encounter " + number, List.of(creature), 1, 100L, 100L,
                GeneratedEncounterDifficulty.EASY, "1x " + name);
        return new PreparedEncounterRoster(
                number, "Encounter " + number, intentFingerprint, rosterFingerprint,
                List.of(creature), summary);
    }

    private static PreparedEncounterRoster rosterWithLabel(
            int number,
            long creatureId,
            String name,
            String label,
            String intentFingerprint,
            String rosterFingerprint
    ) {
        PreparedEncounterCreature creature = new PreparedEncounterCreature(creatureId, 1, name);
        return new PreparedEncounterRoster(
                number, label, intentFingerprint, rosterFingerprint, List.of(creature),
                new GeneratedEncounterPlanSummary(
                        0L, label, List.of(creature), 1, 100L, 100L,
                        GeneratedEncounterDifficulty.EASY, "1x " + name));
    }

    private static GeneratedEncounterBatchRepository.CommitOutcome raceCommit(
            SqliteEncounterPlanRepository repository,
            PreparedEncounterBatch batch,
            CountDownLatch ready,
            CountDownLatch start
    ) throws Exception {
        ready.countDown();
        start.await();
        return repository.commit(batch);
    }

    private static long rowCount(Path path, String table) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var rows = connection.createStatement().executeQuery("SELECT COUNT(*) FROM " + table)) {
            assertTrue(rows.next());
            return rows.getLong(1);
        }
    }

    private static void execute(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private static void seedV3(Path path) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.createStatement()) {
            statement.execute("PRAGMA user_version=1");
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute(
                    "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT"
                        + " NULL)");
            statement.execute("INSERT INTO sm_schema_versions(owner,version) VALUES ('encounter',3)");
            statement.execute(
                    "CREATE TABLE creatures(id INTEGER PRIMARY KEY, name TEXT NOT NULL, xp INTEGER"
                        + " NOT NULL)");
            statement.execute("INSERT INTO creatures(id,name,xp) VALUES (11,'Current Guard',100)");
            statement.execute(
                    "CREATE TABLE saved_encounter_plans(plan_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                        + " name TEXT NOT NULL, generated_label TEXT NOT NULL DEFAULT '',"
                        + " created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT"
                        + " NULL DEFAULT CURRENT_TIMESTAMP)");
            statement.execute(
                    "CREATE TABLE saved_encounter_plan_creatures(plan_id INTEGER NOT NULL"
                        + " REFERENCES saved_encounter_plans(plan_id) ON DELETE CASCADE,"
                        + " creature_id INTEGER NOT NULL REFERENCES creatures(id), quantity INTEGER"
                        + " NOT NULL CHECK(quantity>0), sort_order INTEGER NOT NULL, PRIMARY"
                        + " KEY(plan_id,creature_id))");
            statement.execute(
                    "CREATE TABLE generated_encounter_plan_batches(engine_version TEXT NOT NULL,"
                        + " generation_id TEXT NOT NULL, batch_fingerprint TEXT NOT NULL,"
                        + " encounter_count INTEGER NOT NULL, PRIMARY"
                        + " KEY(engine_version,generation_id))");
            statement.execute(
                    "CREATE TABLE generated_encounter_plan_origins(engine_version TEXT NOT NULL,"
                        + " generation_id TEXT NOT NULL, encounter_number INTEGER NOT NULL,"
                        + " batch_order INTEGER NOT NULL, spec_fingerprint TEXT NOT NULL, plan_id"
                        + " INTEGER NOT NULL UNIQUE REFERENCES saved_encounter_plans(plan_id),"
                        + " PRIMARY KEY(engine_version,generation_id,encounter_number),"
                        + " UNIQUE(engine_version,generation_id,batch_order), FOREIGN"
                        + " KEY(engine_version,generation_id) REFERENCES"
                        + " generated_encounter_plan_batches(engine_version,generation_id))");
            statement.execute(
                    "INSERT INTO saved_encounter_plans(plan_id,name,generated_label) VALUES"
                            + " (1,'Legacy','Legacy')");
            statement.execute(
                    "INSERT INTO"
                        + " saved_encounter_plan_creatures(plan_id,creature_id,quantity,sort_order)"
                        + " VALUES (1,11,1,0)");
            statement.execute("INSERT INTO generated_encounter_plan_batches VALUES "
                    + "('engine','legacy-run','legacy-batch',1)");
            statement.execute("INSERT INTO generated_encounter_plan_origins VALUES "
                    + "('engine','legacy-run',1,0,'i1',1)");
        }
    }

    private static boolean hasColumn(java.sql.Connection connection, String table, String column) throws Exception {
        try (var rows = connection.createStatement().executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rows.next()) {
                if (column.equals(rows.getString("name"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String fingerprint(String value) {
        try {
            return sha256(value);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
