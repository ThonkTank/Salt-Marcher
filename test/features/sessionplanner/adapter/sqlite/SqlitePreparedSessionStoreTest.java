package features.sessionplanner.adapter.sqlite;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.application.CommitPreparedSessionCommand;
import features.sessionplanner.application.CommitPreparedSessionResult;
import features.sessionplanner.application.PreparedSessionPersistenceFingerprint;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionManualLootNote;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionTreasure;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

final class SqlitePreparedSessionStoreTest {

    private static final String PREPARATION_IDENTITY = "v1:" + "a".repeat(64);
    private static final String WRONG_FINGERPRINT = "v1:" + "f".repeat(64);

    @TempDir
    Path temporaryDirectory;

    @Test
    void rejectsFingerprintDuplicatePlanAndMissingSessionBeforeOneExactSuccessfulRevision() {
        try (StoreFixture fixture = fixture("prepared-validation.db", seeded())) {
            SessionPlan initial = fixture.repository.loadCurrent().orElseThrow();
            CommitPreparedSessionCommand valid = command(7L, SessionRevision.initial(), false);

            CommitPreparedSessionResult fingerprint = fixture.repository.commitPreparedSession(
                    withFingerprint(valid, WRONG_FINGERPRINT));
            CommitPreparedSessionResult duplicate = fixture.repository.commitPreparedSession(
                    command(7L, SessionRevision.initial(), true));
            CommitPreparedSessionResult missing = fixture.repository.commitPreparedSession(
                    command(99L, SessionRevision.initial(), false));

            assertInstanceOf(CommitPreparedSessionResult.Invalid.class, fingerprint);
            assertInstanceOf(CommitPreparedSessionResult.Invalid.class, duplicate);
            assertInstanceOf(CommitPreparedSessionResult.NotFound.class, missing);
            assertEquals(initial, fixture.repository.loadCurrent().orElseThrow());

            CommitPreparedSessionResult.Success success = assertInstanceOf(
                    CommitPreparedSessionResult.Success.class,
                    fixture.repository.commitPreparedSession(valid));
            SessionPlan committed = fixture.repository.loadCurrent().orElseThrow();
            assertEquals(1L, success.previousRevision().value());
            assertEquals(2L, success.committedRevision().value());
            assertEquals(2L, committed.revision().value());
            assertEquals(List.of(101L, 202L), committed.encounters().stream()
                    .map(SessionEncounter::encounterPlanId).toList());
            assertEquals(List.of(new SessionManualLootNote(1L, 1L, "Prepared note")),
                    committed.manualLootNotes());
            assertEquals("Prepared reward", committed.treasures().getFirst().title());
        }
    }

    @Test
    void staleExpectedRevisionWritesNothing() {
        try (StoreFixture fixture = fixture("prepared-stale.db", seeded())) {
            SessionPlan initial = fixture.repository.loadCurrent().orElseThrow();
            fixture.repository.save(initial.rename("Newer authored revision"));
            SessionPlan newer = fixture.repository.loadCurrent().orElseThrow();

            CommitPreparedSessionResult result = fixture.repository.commitPreparedSession(
                    command(7L, SessionRevision.initial(), false));

            CommitPreparedSessionResult.Stale stale = assertInstanceOf(
                    CommitPreparedSessionResult.Stale.class, result);
            assertEquals(1L, stale.expected().value());
            assertEquals(2L, stale.current().value());
            assertEquals(newer, fixture.repository.loadCurrent().orElseThrow());
        }
    }

    @Test
    void childInsertFailureRollsBackRootRevisionAndEveryChildCollection() throws Exception {
        SessionPlan existing = new SessionPlan(
                7L,
                SessionRevision.initial(),
                "Existing",
                List.of(1L),
                EncounterDays.one(),
                List.of(new SessionEncounter(
                        9L, 909L, SessionEncounterAllocation.hundred(), "Old scene", "Old notes", 4L)),
                List.of(),
                List.of(new SessionManualLootNote(5L, 9L, "Old note")),
                List.of(treasure(4L, 9L, "Old reward")),
                9L,
                "",
                10L,
                6L);
        Path path = temporaryDirectory.resolve("prepared-rollback.db");
        try (StoreFixture fixture = fixture(path, existing)) {
            SessionPlan before = fixture.repository.loadCurrent().orElseThrow();
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                    Statement statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER reject_prepared_note BEFORE INSERT ON "
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " BEGIN SELECT RAISE(ABORT, 'injected child failure'); END");
            }

            CommitPreparedSessionResult result = fixture.repository.commitPreparedSession(
                    command(7L, SessionRevision.initial(), false));

            assertInstanceOf(CommitPreparedSessionResult.StorageFailure.class, result);
            assertEquals(before, fixture.repository.loadCurrent().orElseThrow());
        }
    }

    private StoreFixture fixture(String databaseName, SessionPlan initial) {
        return fixture(temporaryDirectory.resolve(databaseName), initial);
    }

    private static StoreFixture fixture(Path path, SessionPlan initial) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(
                        TestFeatureStores.store(
                                database, SqliteSessionPlanRepository.storeDefinition()));
        repository.insert(initial);
        repository.setCurrentSessionId(initial.sessionId());
        return new StoreFixture(database, repository);
    }

    private static SessionPlan seeded() {
        return SessionPlan.seeded(7L, List.of(1L), EncounterDays.one());
    }

    private static CommitPreparedSessionCommand command(
            long sessionId,
            SessionRevision expectedRevision,
            boolean duplicatePlanId
    ) {
        long secondPlanId = duplicatePlanId ? 101L : 202L;
        List<CommitPreparedSessionCommand.Scene> scenes = List.of(
                new CommitPreparedSessionCommand.Scene(
                        1L, 1, 101L, allocation("50"), "First", "First notes", 0L),
                new CommitPreparedSessionCommand.Scene(
                        2L, 2, secondPlanId, allocation("50"), "Second", "Second notes", 0L));
        List<CommitPreparedSessionCommand.Rest> rests = List.of();
        List<CommitPreparedSessionCommand.ManualLootNote> notes = List.of(
                new CommitPreparedSessionCommand.ManualLootNote(1L, 1L, "Prepared note"));
        List<SessionTreasure> rewards = List.of(treasure(1L, 2L, "Prepared reward"));
        List<CommitPreparedSessionCommand.EncounterPlanMapping> mappings = List.of(
                new CommitPreparedSessionCommand.EncounterPlanMapping(1, 101L),
                new CommitPreparedSessionCommand.EncounterPlanMapping(2, secondPlanId));
        String fingerprint = PreparedSessionPersistenceFingerprint.compute(
                sessionId,
                expectedRevision,
                PREPARATION_IDENTITY,
                scenes.stream().map(scene -> new PreparedSessionPersistenceFingerprint.Scene(
                        scene.sceneId(), scene.encounterNumber(),
                        scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString(),
                        scene.title(), scene.notes(), scene.locationId())).toList(),
                rests.stream().map(rest -> new PreparedSessionPersistenceFingerprint.Rest(
                        rest.leftSceneId(), rest.rightSceneId(), rest.kind())).toList(),
                1L,
                notes.stream().map(note -> new PreparedSessionPersistenceFingerprint.ManualLootNote(
                        note.noteId(), note.sceneId(), note.authoredText())).toList(),
                rewards,
                "run",
                mappings.stream().map(mapping -> new PreparedSessionPersistenceFingerprint.EncounterPlanMapping(
                        mapping.encounterNumber(), mapping.planId())).toList());
        return new CommitPreparedSessionCommand(
                sessionId,
                expectedRevision,
                PREPARATION_IDENTITY,
                fingerprint,
                scenes,
                rests,
                1L,
                notes,
                rewards,
                "run",
                mappings);
    }

    private static CommitPreparedSessionCommand withFingerprint(
            CommitPreparedSessionCommand source,
            String fingerprint
    ) {
        return new CommitPreparedSessionCommand(
                source.sessionId(),
                source.expectedRevision(),
                source.preparationIdentity(),
                fingerprint,
                source.scenes(),
                source.rests(),
                source.selectedSceneId(),
                source.manualLootNotes(),
                source.treasures(),
                source.committedGenerationRunIdentity(),
                source.encounterPlanMappings());
    }

    private static SessionEncounterAllocation allocation(String value) {
        return new SessionEncounterAllocation(new BigDecimal(value));
    }

    private static SessionTreasure treasure(long treasureId, long sceneId, String title) {
        return new SessionTreasure(treasureId, sceneId, title, "", "", "", "", "",
                0L, 0, 0, List.of(), List.of());
    }

    private record StoreFixture(
            SqliteDatabase database,
            SqliteSessionPlanRepository repository
    ) implements AutoCloseable {

        @Override
        public void close() {
            database.close();
        }
    }
}
