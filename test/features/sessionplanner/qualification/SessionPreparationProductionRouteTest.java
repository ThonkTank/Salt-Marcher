package features.sessionplanner.qualification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.creatures.CreaturesServiceAssembly;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.party.PartyServiceAssembly;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MembershipState;
import features.sessiongeneration.SessionGenerationServiceAssembly;
import features.sessiongeneration.api.GenerationPreparationIdentity;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.SessionPlannerServiceAssembly;
import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerWorkspaceModel;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessionplanner.application.CommitPreparedSessionCommand;
import features.sessionplanner.application.CommitPreparedSessionResult;
import features.sessionplanner.application.SessionPreparedSessionStore;
import features.sessionplanner.domain.session.SessionPlan;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.OptionalInt;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.execution.BoundedExecutionLane;
import platform.execution.ExecutionLane;
import platform.execution.SerialExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.DirectUiDispatcher;

final class SessionPreparationProductionRouteTest {

    private static final Duration DEADLOCK_TIMEOUT = Duration.ofSeconds(30);
    private static final int QUALIFICATION_RUNS = 20;

    @TempDir
    Path temporaryDirectory;

    @Test
    void canonicalProductionRouteStaysBoundedAcrossTwentyWarmRuns() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        Path path = temporaryDirectory.resolve("session-preparation-production.sqlite");
        try (ProductionFixture fixture = ProductionFixture.open(path, diagnostics)) {
            awaitPreparation(fixture.planner, fixture.canonical, 0L, false);
            List<Measurement> smallCardinalityMeasurements = List.copyOf(diagnostics.measurements);
            List<Long> warmDurations = new ArrayList<>();
            for (int run = 0; run < QUALIFICATION_RUNS; run++) {
                long priorAttempt = fixture.planner.workspaceModel().current().preparation().attemptId();
                long started = System.nanoTime();
                awaitPreparation(fixture.planner, fixture.canonical, priorAttempt, true);
                warmDurations.add(Long.valueOf(System.nanoTime() - started));
            }

            List<Long> sorted = warmDurations.stream().sorted().toList();
            long p95Nanos = sorted.get((int) Math.ceil(QUALIFICATION_RUNS * 0.95d) - 1).longValue();
            System.out.println("SESSION_PREPARATION_QUALIFICATION coldCatalogNanos=" + fixture.coldCatalogNanos
                    + " coldStoreNanos=" + fixture.coldStoreNanos
                    + " warmSortedNanos=" + sorted
                    + " p95Nanos=" + p95Nanos);
            assertTrue(p95Nanos < Duration.ofSeconds(2).toNanos(), () ->
                    "warm p95 exceeded 2s; coldCatalogNanos=" + fixture.coldCatalogNanos
                            + ", coldStoreNanos=" + fixture.coldStoreNanos
                            + ", warmNanos=" + warmDurations
                            + ", measurements=" + diagnostics.measurements);
            assertTrue(diagnostics.failures.isEmpty(), () -> "diagnostic failures=" + diagnostics.failures);
            assertBoundedQueryCounts(smallCardinalityMeasurements, diagnostics.measurements);
        }
    }

    @Test
    void cancellationAndLatestAttemptWinOnProductionRoute() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        HoldingFirstDraft delayed = new HoldingFirstDraft();
        Path path = temporaryDirectory.resolve("session-preparation-latest-wins.sqlite");
        try (ProductionFixture fixture = ProductionFixture.open(path, diagnostics, delayed::wrap)) {
            long initialRevision = fixture.planner.workspaceModel().current().publicationRevision();
            fixture.planner.application().prepareSession(new PrepareSessionCommand(
                    OptionalInt.of(3), 179974L, false));
            delayed.captured.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            SessionPlannerWorkspaceSnapshot first = awaitWorkspace(
                    fixture.planner.workspaceModel(), initialRevision,
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.GENERATING);
            long firstAttempt = first.preparation().attemptId();

            fixture.planner.application().cancelPreparation();
            SessionPlannerWorkspaceSnapshot cancelled = awaitWorkspace(
                    fixture.planner.workspaceModel(), first.publicationRevision(),
                    workspace -> workspace.preparation().attemptId() > firstAttempt
                            && workspace.preparation().status() == SessionPreparationStatus.CANCELLED);
            assertFalse(cancelled.preparation().cancelEnabled());

            awaitPreparation(fixture.planner, fixture.canonical, cancelled.preparation().attemptId(), false);
            long winningAttempt = fixture.planner.workspaceModel().current().preparation().attemptId();
            delayed.release.complete(null);
            delayed.finished.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);

            assertEquals(SessionPreparationStatus.READY,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertEquals(winningAttempt, fixture.planner.workspaceModel().current().preparation().attemptId());
            assertEquals(1L, rowCount(path, "session_generation_runs"));
            assertEquals(3L, rowCount(path, "generated_encounter_plan_origins"));
            assertTrue(diagnostics.failures.isEmpty(), () -> "diagnostic failures=" + diagnostics.failures);
        }
    }

    @Test
    void foreignStorageFailureRetriesIdempotentlyOnProductionRoute() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        FailFirstGenerationCommit generationFailure = new FailFirstGenerationCommit();
        Path path = temporaryDirectory.resolve("session-preparation-retry.sqlite");
        try (ProductionFixture fixture = ProductionFixture.open(path, diagnostics, generationFailure::wrap)) {
            long firstAttempt = prepareUntilTerminal(fixture.planner, 0L, false, SessionPreparationStatus.FAILED);

            awaitPreparation(fixture.planner, fixture.canonical, firstAttempt, false);

            assertEquals(2, generationFailure.commitCalls);
            assertEquals(1L, rowCount(path, "session_generation_runs"),
                    "retry stores one canonical generation run");
            assertEquals(3L, rowCount(path, "generated_encounter_plan_origins"),
                    "retry reuses the first committed encounter batch");
            assertEquals(
                    fixture.planner.workspaceModel().current().sceneTimeline().sceneHeaders().size(),
                    rowCount(path, "session_planner_encounters"),
                    "planner CAS publishes one prepared scene set");
        }
    }

    @Test
    void cancelBeforePlannerCommitBoundaryLeavesPlannerSessionUnchangedAfterReopen() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        HoldingForeignCommitCompletion delayed = new HoldingForeignCommitCompletion();
        Path path = temporaryDirectory.resolve("session-preparation-cancel-before-planner-commit.sqlite");
        SessionPlan original;
        try (ProductionFixture fixture = ProductionFixture.open(path, diagnostics, delayed::wrap)) {
            original = fixture.repository.loadCurrent().orElseThrow();
            long initialPublication = fixture.planner.workspaceModel().current().publicationRevision();

            fixture.planner.application().prepareSession(new PrepareSessionCommand(
                    OptionalInt.of(3), 179974L, false));
            delayed.entered.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            SessionPlannerWorkspaceSnapshot saving = awaitWorkspace(
                    fixture.planner.workspaceModel(), initialPublication,
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.SAVING
                            && workspace.preparation().cancelEnabled());

            fixture.planner.application().cancelPreparation();
            SessionPlannerWorkspaceSnapshot cancelled = awaitWorkspace(
                    fixture.planner.workspaceModel(), saving.publicationRevision(),
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.CANCELLED);
            delayed.release.complete(null);
            delayed.finished.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);

            assertEquals(cancelled.publicationRevision(),
                    fixture.planner.workspaceModel().current().publicationRevision(),
                    "late immutable foreign completion publishes no post-cancel Planner state");
        }

        assertEquals(original, reopenCurrentSession(path, diagnostics),
                "pre-boundary cancellation preserves the original Planner revision and content after reopen");
    }

    @Test
    void cancelAfterPlannerCommitBoundaryIsNoOpAndPreparedSessionPersistsAfterReopen() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        HoldingPreparedSessionStore heldStore = new HoldingPreparedSessionStore();
        Path path = temporaryDirectory.resolve("session-preparation-cancel-after-planner-commit.sqlite");
        SessionPlan committed;
        try (ProductionFixture fixture = ProductionFixture.open(
                path, diagnostics, UnaryOperator.identity(), heldStore::wrap)) {
            SessionPlan original = fixture.repository.loadCurrent().orElseThrow();
            long initialPublication = fixture.planner.workspaceModel().current().publicationRevision();

            fixture.planner.application().prepareSession(new PrepareSessionCommand(
                    OptionalInt.of(3), 179974L, false));
            assertTrue(heldStore.entered.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
                    "real prepared-session store was not entered");
            SessionPlannerWorkspaceSnapshot finalSaving = awaitWorkspace(
                    fixture.planner.workspaceModel(), initialPublication,
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.SAVING
                            && !workspace.preparation().cancelEnabled());

            fixture.planner.application().cancelPreparation();
            SessionPlannerWorkspaceSnapshot afterCancel = fixture.planner.workspaceModel().current();
            assertEquals(finalSaving.publicationRevision(), afterCancel.publicationRevision(),
                    "post-boundary cancel publishes no state");
            assertEquals(finalSaving.preparation(), afterCancel.preparation(),
                    "post-boundary cancel neither changes attempt sequence nor publishes CANCELLED");

            heldStore.release.countDown();
            SessionPlannerWorkspaceSnapshot ready = awaitWorkspace(
                    fixture.planner.workspaceModel(), finalSaving.publicationRevision(),
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.READY);
            assertEquals(finalSaving.preparation().attemptId(), ready.preparation().attemptId());
            committed = fixture.repository.loadCurrent().orElseThrow();
            assertTrue(committed.revision().value() > original.revision().value());
            assertFalse(committed.encounters().isEmpty());
            assertFalse(committed.generatedRewards().isEmpty());
        }

        assertEquals(committed, reopenCurrentSession(path, diagnostics),
                "post-boundary Planner revision and prepared content survive close and reopen");
    }

    @Test
    void authoredMutationQueuedBeforeFinalPlannerTaskWinsFifoAndRemainsSolePlannerWrite() throws Exception {
        RecordingDiagnostics diagnostics = new RecordingDiagnostics();
        HoldingForeignCommitCompletion delayed = new HoldingForeignCommitCompletion();
        SubmissionObservingExecutionLane observedAuthoredLane = new SubmissionObservingExecutionLane();
        Path path = temporaryDirectory.resolve("session-preparation-authored-fifo.sqlite");
        SessionPlan persisted;
        try (ProductionFixture fixture = ProductionFixture.open(
                path,
                diagnostics,
                delayed::wrap,
                UnaryOperator.identity(),
                DirectUiDispatcher.INSTANCE,
                observedAuthoredLane::wrap)) {
            assertSame(observedAuthoredLane, fixture.authored,
                    "application mutations and final preparation commit must receive the same lane instance");
            SessionPlan original = fixture.repository.loadCurrent().orElseThrow();
            CountDownLatch blockerEntered = new CountDownLatch(1);
            CountDownLatch releaseBlocker = new CountDownLatch(1);
            fixture.authored.execute(() -> {
                blockerEntered.countDown();
                awaitLatch(releaseBlocker, "timed out waiting to release authored-lane blocker");
            });
            assertTrue(blockerEntered.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
                    "authored-lane blocker was not entered");

            long initialPublication = fixture.planner.workspaceModel().current().publicationRevision();
            fixture.planner.application().prepareSession(new PrepareSessionCommand(
                    OptionalInt.of(3), 179974L, false));
            delayed.entered.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            SessionPlannerWorkspaceSnapshot saving = awaitWorkspace(
                    fixture.planner.workspaceModel(),
                    initialPublication,
                    workspace -> workspace.preparation().status() == SessionPreparationStatus.SAVING
                            && workspace.preparation().cancelEnabled());

            CountDownLatch mutationSubmitted = observedAuthoredLane.observeNextSubmission();
            fixture.planner.application().renameSession(
                    new SessionPlannerCatalogCommand.RenameSessionCommand(
                            new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                                    original.sessionId(), original.revision().value()),
                            "FIFO authored mutation"));
            assertTrue(mutationSubmitted.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
                    "authored mutation was not submitted");

            CopyOnWriteArrayList<SessionPreparationStatus> statusesAfterForeignRelease =
                    new CopyOnWriteArrayList<>();
            Runnable unsubscribe = fixture.planner.workspaceModel().subscribe(workspace ->
                    statusesAfterForeignRelease.add(workspace.preparation().status()));
            CountDownLatch finalPlannerTaskSubmitted = observedAuthoredLane.observeNextSubmission();
            delayed.release.complete(null);
            delayed.finished.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            assertTrue(finalPlannerTaskSubmitted.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
                    "final Planner task was not submitted to the authored lane");

            CountDownLatch sentinel = new CountDownLatch(1);
            fixture.authored.execute(sentinel::countDown);
            releaseBlocker.countDown();
            assertTrue(sentinel.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
                    "authored-lane sentinel did not drain");
            unsubscribe.run();

            persisted = fixture.repository.loadCurrent().orElseThrow();
            assertEquals("FIFO authored mutation", persisted.displayName());
            assertEquals(original.revision().next(), persisted.revision(),
                    "only the earlier authored mutation may advance the Planner revision");
            assertTrue(persisted.encounters().isEmpty(), "prepared Planner scenes must not be committed");
            assertTrue(persisted.generatedRewards().isEmpty(), "prepared Planner rewards must not be committed");
            assertFalse(statusesAfterForeignRelease.contains(SessionPreparationStatus.READY),
                    "the stale preparation must never publish a late READY");
            assertEquals(1L, rowCount(path, "session_generation_runs"),
                    "the immutable generation artifact may remain");
            assertEquals(3L, rowCount(path, "generated_encounter_plan_origins"),
                    "the immutable Encounter artifacts may remain");
            assertEquals(SessionPreparationStatus.IDLE,
                    fixture.planner.workspaceModel().current().preparation().status());
            assertTrue(saving.preparation().cancelEnabled());
        }

        assertEquals(persisted, reopenCurrentSession(path, diagnostics),
                "the sole authored mutation must remain durable after reopen");
    }

    private static BoundedExecutionLane lane(Diagnostics diagnostics, String name) {
        return new BoundedExecutionLane(diagnostics, name, 2);
    }

    private static long prepareUntilTerminal(
            SessionPlannerServiceAssembly planner,
            long priorAttempt,
            boolean replacementConfirmed,
            SessionPreparationStatus expected
    ) throws Exception {
        long revision = planner.workspaceModel().current().publicationRevision();
        planner.application().prepareSession(new PrepareSessionCommand(
                OptionalInt.of(3), 179974L, replacementConfirmed));
        SessionPlannerWorkspaceSnapshot terminal = awaitWorkspace(planner.workspaceModel(), revision, workspace ->
                workspace.preparation().attemptId() > priorAttempt
                        && terminal(workspace.preparation().status()));
        assertEquals(expected, terminal.preparation().status(), () ->
                "unexpected production terminal: " + terminal.preparation());
        return terminal.preparation().attemptId();
    }

    private static long rowCount(Path path, String table) throws Exception {
        if (!table.matches("[a-z_]+")) {
            throw new IllegalArgumentException("unsafe table name");
        }
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            return rows.getLong(1);
        }
    }

    private static SessionPlan reopenCurrentSession(Path path, Diagnostics diagnostics) {
        try (SqliteDatabase reopened = new SqliteDatabase(path, diagnostics)) {
            SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(reopened);
            reopened.prepareRegisteredStores();
            return repository.loadCurrent().orElseThrow();
        }
    }

    private static GenerationResult canonicalDraft(SessionGenerationApi generation) throws Exception {
        var response = generation.draft(new GenerationRequest(
                new GenerationPreparationIdentity("qualification:canonical-cold"),
                List.of(new GenerationRequest.PartyLevel(3, 2), new GenerationRequest.PartyLevel(4, 2)),
                new BigDecimal("0.6"), OptionalInt.of(3), 179974L))
                .toCompletableFuture().get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        assertEquals(GenerationStatus.SUCCESS, response.status());
        return response.draft().orElseThrow().result();
    }

    private static void seedCreatures(Path path, GenerationResult generated) throws Exception {
        record Candidate(String challengeRating, long xp) {
        }
        Set<Candidate> required = generated.encounters().stream()
                .flatMap(encounter -> encounter.blocks().stream())
                .map(block -> new Candidate(block.challengeLabel(), block.monsterXp()))
                .collect(java.util.stream.Collectors.toSet());
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
                var statement = connection.prepareStatement(
                        "INSERT INTO creatures (id,name,size,creature_type,alignment,cr,xp,hp,ac) "
                                + "VALUES (?,?,?,?,?,?,?,?,?)")) {
            long id = 1L;
            for (Candidate candidate : required.stream()
                    .sorted(Comparator.comparingLong(Candidate::xp).thenComparing(Candidate::challengeRating))
                    .toList()) {
                for (int variant = 0; variant < 5; variant++) {
                    statement.setLong(1, id);
                    statement.setString(2, "Qualification creature " + id);
                    statement.setString(3, "Medium");
                    statement.setString(4, "humanoid");
                    statement.setString(5, "neutral");
                    statement.setString(6, candidate.challengeRating());
                    statement.setLong(7, candidate.xp());
                    statement.setInt(8, 10 + variant);
                    statement.setInt(9, 12 + variant);
                    statement.addBatch();
                    id++;
                }
            }
            statement.executeBatch();
        }
    }

    private static void createCanonicalParty(PartyServiceAssembly.Component party) throws Exception {
        createCharacter(party, "Aria", 3, 1);
        createCharacter(party, "Borin", 3, 2);
        createCharacter(party, "Cyra", 4, 3);
        createCharacter(party, "Dain", 4, 4);
    }

    private static void createCharacter(
            PartyServiceAssembly.Component party,
            String name,
            int level,
            int expectedSize
    ) throws Exception {
        CompletableFuture<Void> published = new CompletableFuture<>();
        Runnable unsubscribe = party.activeParty().subscribe(result -> {
            if (result.members().size() == expectedSize) {
                published.complete(null);
            }
        });
        try {
            party.application().createCharacter(new CreateCharacterCommand(
                    new CharacterDraft(name, "Qualification", level, 12, 14), MembershipState.ACTIVE));
            published.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        } finally {
            unsubscribe.run();
        }
    }

    private static void initializeCanonicalSession(
            SessionPlannerServiceAssembly planner,
            List<Long> participantIds
    ) throws Exception {
        planner.application().initialize();
        awaitWorkspace(planner.workspaceModel(), 0L, workspace -> workspace.publicationRevision() > 0L);

        long revision = planner.workspaceModel().current().publicationRevision();
        planner.application().createSession(new SessionPlannerCatalogCommand.CreateSessionCommand(
                "Canonical qualification"));
        SessionPlannerWorkspaceSnapshot created = awaitWorkspace(
                planner.workspaceModel(), revision, workspace -> workspace.catalog().selectedSessionId() > 0L);

        for (long participantId : participantIds) {
            if (created.participants().participants().stream()
                    .anyMatch(participant -> participant.characterId() == participantId)) {
                continue;
            }
            revision = created.publicationRevision();
            planner.application().addParticipant(SessionPlannerParticipantCommand.add(
                    new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                            created.sourceSessionId(), created.sourceSessionRevision()), participantId));
            int expected = created.participants().participants().size() + 1;
            created = awaitWorkspace(planner.workspaceModel(), revision,
                    workspace -> workspace.participants().participants().size() == expected);
        }
        revision = created.publicationRevision();
        planner.application().setEncounterDays(new SetSessionEncounterDaysCommand(
                new features.sessionplanner.api.SessionPlannerAuthoredTarget(
                        created.sourceSessionId(), created.sourceSessionRevision()), new BigDecimal("0.6")));
        awaitWorkspace(planner.workspaceModel(), revision, workspace ->
                workspace.currentSession().session().encounterDays().compareTo(new BigDecimal("0.6")) == 0);
    }

    private static void awaitPreparation(
            SessionPlannerServiceAssembly planner,
            GenerationResult canonical,
            long priorAttempt,
            boolean replacementConfirmed
    ) throws Exception {
        long revision = planner.workspaceModel().current().publicationRevision();
        planner.application().prepareSession(new PrepareSessionCommand(
                OptionalInt.of(3), 179974L, replacementConfirmed));
        SessionPlannerWorkspaceSnapshot ready = awaitWorkspace(planner.workspaceModel(), revision, workspace ->
                workspace.preparation().attemptId() > priorAttempt
                        && terminal(workspace.preparation().status()));
        assertEquals(SessionPreparationStatus.READY, ready.preparation().status(), () ->
                "production preparation did not reach READY: " + ready.preparation()
                        + ", issues=" + ready.issues());
        assertFalse(ready.preparation().cancelEnabled());
        var encounterScenes = ready.sceneTimeline().sceneHeaders().stream()
                .filter(SessionPlannerWorkspaceSnapshotTestSupport::linkedEncounter)
                .toList();
        assertEquals(canonical.encounters().size(), encounterScenes.size());
        assertTrue(encounterScenes.stream().allMatch(scene ->
                scene.linkedEncounterPlanId() > 0L
                        && scene.linkedEncounterCreatureCount() > 0
                        && scene.linkedEncounterAdjustedXp() > 0));
        var rewards = ready.selectedScene().generatedRewards();
        assertTrue(rewards.stream().allMatch(reward ->
                reward.availability()
                        == features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot.Availability.AVAILABLE
                        && !reward.generationRunId().isBlank()
                        && !reward.itemLines().isEmpty()));
    }

    private static boolean terminal(SessionPreparationStatus status) {
        return switch (status) {
            case READY, INVALID, FAILED, CANCELLED, CONFIRMING_REPLACEMENT -> true;
            default -> false;
        };
    }

    private static SessionPlannerWorkspaceSnapshot awaitWorkspace(
            SessionPlannerWorkspaceModel model,
            long priorRevision,
            Predicate<SessionPlannerWorkspaceSnapshot> condition
    ) throws Exception {
        CompletableFuture<SessionPlannerWorkspaceSnapshot> completion = new CompletableFuture<>();
        Runnable unsubscribe = model.subscribe(workspace -> {
            if (workspace.publicationRevision() > priorRevision && condition.test(workspace)) {
                completion.complete(workspace);
            }
        });
        try {
            SessionPlannerWorkspaceSnapshot current = model.current();
            if (current.publicationRevision() > priorRevision && condition.test(current)) {
                completion.complete(current);
            }
            return completion.get(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        } finally {
            unsubscribe.run();
        }
    }

    private static void assertBoundedQueryCounts(
            List<Measurement> smallCardinality,
            List<Measurement> highCardinality
    ) {
        assertTrue(smallCardinality.stream().anyMatch(measurement ->
                measurement.id().value().equals("sessionplanner.workspace.assembly")
                        && measurement.queryCount() == 7));
        assertTrue(highCardinality.stream().filter(measurement ->
                        measurement.id().value().equals("sessionplanner.workspace.assembly"))
                .allMatch(measurement -> measurement.queryCount() == 7));
        assertTrue(highCardinality.stream().filter(measurement ->
                        measurement.id().value().equals("party.planning-facts.read"))
                .allMatch(measurement -> measurement.queryCount() == 0));
        assertTrue(highCardinality.stream().filter(measurement ->
                        measurement.id().value().equals("creatures.facts.read"))
                .allMatch(measurement -> measurement.queryCount() == 0));
        assertTrue(highCardinality.stream().filter(measurement ->
                        measurement.id().value().equals("party.sqlite.roster-read"))
                .allMatch(measurement -> measurement.queryCount() == 2));
        assertTrue(highCardinality.stream().filter(measurement ->
                        measurement.id().value().equals("creatures.sqlite.facts-read"))
                .allMatch(measurement -> measurement.queryCount() == 2));
        assertTrue(highCardinality.stream().anyMatch(measurement ->
                measurement.id().value().equals("party.sqlite.roster-read")));
        assertTrue(highCardinality.stream().anyMatch(measurement ->
                measurement.id().value().equals("creatures.sqlite.facts-read")));
    }

    private static final class SessionPlannerWorkspaceSnapshotTestSupport {
        private SessionPlannerWorkspaceSnapshotTestSupport() {
        }

        private static boolean linkedEncounter(
                features.sessionplanner.api.SessionPlannerSceneTimelineProjection.SceneHeader scene
        ) {
            return scene.linkedEncounterPlan();
        }
    }

    static final class ProductionFixture implements AutoCloseable {
        private final SqliteDatabase database;
        final ExecutionLane authored;
        private final BoundedExecutionLane generationCpu;
        private final BoundedExecutionLane generationIo;
        private final BoundedExecutionLane encounterCpu;
        private final BoundedExecutionLane encounterIo;
        private final BoundedExecutionLane preparationCpu;
        private final BoundedExecutionLane preparationIo;
        final SqliteSessionPlanRepository repository;
        final GenerationResult canonical;
        final SessionPlannerServiceAssembly planner;
        private final long coldCatalogNanos;
        private final long coldStoreNanos;

        private ProductionFixture(
                SqliteDatabase database,
                ExecutionLane authored,
                BoundedExecutionLane generationCpu,
                BoundedExecutionLane generationIo,
                BoundedExecutionLane encounterCpu,
                BoundedExecutionLane encounterIo,
                BoundedExecutionLane preparationCpu,
                BoundedExecutionLane preparationIo,
                SqliteSessionPlanRepository repository,
                GenerationResult canonical,
                SessionPlannerServiceAssembly planner,
                long coldCatalogNanos,
                long coldStoreNanos
        ) {
            this.database = database;
            this.authored = authored;
            this.generationCpu = generationCpu;
            this.generationIo = generationIo;
            this.encounterCpu = encounterCpu;
            this.encounterIo = encounterIo;
            this.preparationCpu = preparationCpu;
            this.preparationIo = preparationIo;
            this.repository = repository;
            this.canonical = canonical;
            this.planner = planner;
            this.coldCatalogNanos = coldCatalogNanos;
            this.coldStoreNanos = coldStoreNanos;
        }

        private static ProductionFixture open(Path path, RecordingDiagnostics diagnostics) throws Exception {
            return open(path, diagnostics, UnaryOperator.identity());
        }

        static ProductionFixture openJavaFx(Path path, RecordingDiagnostics diagnostics) throws Exception {
            return open(path, diagnostics, UnaryOperator.identity(), UnaryOperator.identity(),
                    new platform.ui.JavaFxUiDispatcher());
        }

        private static ProductionFixture open(
                Path path,
                RecordingDiagnostics diagnostics,
                UnaryOperator<SessionGenerationApi> generationDecorator
        ) throws Exception {
            return open(path, diagnostics, generationDecorator, UnaryOperator.identity());
        }

        private static ProductionFixture open(
                Path path,
                RecordingDiagnostics diagnostics,
                UnaryOperator<SessionGenerationApi> generationDecorator,
                UnaryOperator<SessionPreparedSessionStore> preparedSessionStoreDecorator
        ) throws Exception {
            return open(path, diagnostics, generationDecorator, preparedSessionStoreDecorator,
                    DirectUiDispatcher.INSTANCE, UnaryOperator.identity());
        }

        private static ProductionFixture open(
                Path path,
                RecordingDiagnostics diagnostics,
                UnaryOperator<SessionGenerationApi> generationDecorator,
                UnaryOperator<SessionPreparedSessionStore> preparedSessionStoreDecorator,
                platform.ui.UiDispatcher uiDispatcher
        ) throws Exception {
            return open(path, diagnostics, generationDecorator, preparedSessionStoreDecorator,
                    uiDispatcher, UnaryOperator.identity());
        }

        private static ProductionFixture open(
                Path path,
                RecordingDiagnostics diagnostics,
                UnaryOperator<SessionGenerationApi> generationDecorator,
                UnaryOperator<SessionPreparedSessionStore> preparedSessionStoreDecorator,
                platform.ui.UiDispatcher uiDispatcher,
                UnaryOperator<ExecutionLane> authoredLaneDecorator
        ) throws Exception {
            SqliteDatabase database = new SqliteDatabase(path, diagnostics);
            ExecutionLane authored = authoredLaneDecorator.apply(new SerialExecutionLane(diagnostics));
            BoundedExecutionLane generationCpu = lane(diagnostics, "qualification-generation-cpu");
            BoundedExecutionLane generationIo = lane(diagnostics, "qualification-generation-io");
            BoundedExecutionLane encounterCpu = lane(diagnostics, "qualification-encounter-cpu");
            BoundedExecutionLane encounterIo = lane(diagnostics, "qualification-encounter-io");
            BoundedExecutionLane preparationCpu = lane(diagnostics, "session-preparation-cpu");
            BoundedExecutionLane preparationIo = lane(diagnostics, "session-preparation-io");
            SessionGenerationApi generation = SessionGenerationServiceAssembly.create(
                    database, generationCpu, generationIo);
            long coldCatalogStarted = System.nanoTime();
            GenerationResult canonical = canonicalDraft(generation);
            long coldCatalogNanos = System.nanoTime() - coldCatalogStarted;

            CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(
                    database, authored, preparationIo, uiDispatcher, diagnostics);
            EncounterTableServiceAssembly.Component tables = EncounterTableServiceAssembly.create(
                    database, authored, uiDispatcher, diagnostics);
            PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                    database, authored, preparationIo, uiDispatcher, diagnostics);
            EncounterServiceAssembly.Component encounters = EncounterServiceAssembly.create(
                    database,
                    creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                    tables.application(), tables.candidates(), null,
                    party.application(), party.activeParty(), party.activeComposition(),
                    party.adventuringDaySummary(), party.mutation(),
                    authored, encounterCpu, encounterIo, uiDispatcher, diagnostics);
            SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(database);
            SessionGenerationApi decoratedGeneration = generationDecorator.apply(generation);
            SessionPlannerServiceAssembly planner = new SessionPlannerServiceAssembly(
                    repository, repository, preparedSessionStoreDecorator.apply(repository),
                    party.application(), encounters.application(), encounters.savedPlans(), null,
                    decoratedGeneration, authored, preparationCpu, preparationIo,
                    uiDispatcher, diagnostics);

            long coldStoreStarted = System.nanoTime();
            database.prepareRegisteredStores();
            long coldStoreNanos = System.nanoTime() - coldStoreStarted;
            seedCreatures(path, canonical);
            PartyServiceAssembly.start(party);
            encounters.start();
            createCanonicalParty(party);
            initializeCanonicalSession(planner, party.activeParty().current().memberIds());
            return new ProductionFixture(
                    database, authored, generationCpu, generationIo, encounterCpu, encounterIo,
                    preparationCpu, preparationIo, repository, canonical, planner,
                    coldCatalogNanos, coldStoreNanos);
        }

        @Override
        public void close() {
            preparationIo.close();
            preparationCpu.close();
            encounterIo.close();
            encounterCpu.close();
            generationIo.close();
            generationCpu.close();
            authored.close();
            database.close();
        }
    }

    private static final class HoldingForeignCommitCompletion {
        private final CompletableFuture<Void> entered = new CompletableFuture<>();
        private final CompletableFuture<Void> release = new CompletableFuture<>();
        private final CompletableFuture<Void> finished = new CompletableFuture<>();

        private SessionGenerationApi wrap(SessionGenerationApi delegate) {
            return new ForwardingGenerationApi(delegate) {
                @Override
                public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                        features.sessiongeneration.api.CommitGenerationRunCommand command
                ) {
                    CompletableFuture<features.sessiongeneration.api.GenerationRunResponse> delayed = delegate
                            .commit(command)
                            .thenCompose(result -> {
                                entered.complete(null);
                                return release.thenApply(ignored -> result);
                            })
                            .toCompletableFuture();
                    delayed.whenComplete((ignored, failure) -> {
                        if (failure == null) {
                            finished.complete(null);
                        } else {
                            finished.completeExceptionally(failure);
                        }
                    });
                    return delayed;
                }
            };
        }
    }

    private static final class SubmissionObservingExecutionLane implements ExecutionLane {
        private final Object submissionLock = new Object();
        private final List<SubmissionWaiter> waiters = new ArrayList<>();
        private ExecutionLane delegate;
        private long submissions;

        private ExecutionLane wrap(ExecutionLane wrapped) {
            synchronized (submissionLock) {
                if (delegate != null) {
                    throw new IllegalStateException("authored lane already wrapped");
                }
                delegate = wrapped;
            }
            return this;
        }

        private CountDownLatch observeNextSubmission() {
            synchronized (submissionLock) {
                CountDownLatch observed = new CountDownLatch(1);
                waiters.add(new SubmissionWaiter(submissions + 1L, observed));
                return observed;
            }
        }

        @Override
        public void execute(Runnable work) {
            ExecutionLane target;
            synchronized (submissionLock) {
                target = delegate;
                if (target == null) {
                    throw new IllegalStateException("authored lane is not wrapped");
                }
                submissions++;
                waiters.removeIf(waiter -> {
                    if (waiter.targetSubmission() <= submissions) {
                        waiter.observed().countDown();
                        return true;
                    }
                    return false;
                });
            }
            target.execute(work);
        }

        @Override
        public void close() {
            ExecutionLane target;
            synchronized (submissionLock) {
                target = delegate;
            }
            if (target != null) {
                target.close();
            }
        }

        private record SubmissionWaiter(long targetSubmission, CountDownLatch observed) {
        }
    }

    private static void awaitLatch(CountDownLatch latch, String failureMessage) {
        try {
            if (!latch.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
                throw new IllegalStateException(failureMessage);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while awaiting test latch", exception);
        }
    }

    private static final class HoldingPreparedSessionStore {
        private final CountDownLatch entered = new CountDownLatch(1);
        private final CountDownLatch release = new CountDownLatch(1);

        private SessionPreparedSessionStore wrap(SessionPreparedSessionStore delegate) {
            return command -> commitAfterRelease(delegate, command);
        }

        private CommitPreparedSessionResult commitAfterRelease(
                SessionPreparedSessionStore delegate,
                CommitPreparedSessionCommand command
        ) {
            entered.countDown();
            try {
                if (!release.await(DEADLOCK_TIMEOUT.toSeconds(), TimeUnit.SECONDS)) {
                    throw new IllegalStateException("timed out waiting to release prepared-session store");
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("interrupted while holding prepared-session store", exception);
            }
            return delegate.commitPreparedSession(command);
        }
    }

    private static final class HoldingFirstDraft {
        private final CompletableFuture<Void> captured = new CompletableFuture<>();
        private final CompletableFuture<Void> release = new CompletableFuture<>();
        private final CompletableFuture<Void> finished = new CompletableFuture<>();
        private final AtomicBoolean first = new AtomicBoolean(true);

        private SessionGenerationApi wrap(SessionGenerationApi delegate) {
            return new ForwardingGenerationApi(delegate) {
                @Override
                public CompletionStage<features.sessiongeneration.api.GenerationDraftResponse> draft(
                        GenerationRequest request
                ) {
                    if (!first.compareAndSet(true, false)) {
                        return delegate.draft(request);
                    }
                    captured.complete(null);
                    CompletableFuture<features.sessiongeneration.api.GenerationDraftResponse> delayed = release
                            .thenCompose(ignored -> delegate.draft(request))
                            .toCompletableFuture();
                    delayed.whenComplete((ignored, failure) -> {
                        if (failure == null) {
                            finished.complete(null);
                        } else {
                            finished.completeExceptionally(failure);
                        }
                    });
                    return delayed;
                }
            };
        }
    }

    private static final class FailFirstGenerationCommit {
        private final AtomicBoolean first = new AtomicBoolean(true);
        private int commitCalls;

        private SessionGenerationApi wrap(SessionGenerationApi delegate) {
            return new ForwardingGenerationApi(delegate) {
                @Override
                public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                        features.sessiongeneration.api.CommitGenerationRunCommand command
                ) {
                    commitCalls++;
                    if (first.compareAndSet(true, false)) {
                        return CompletableFuture.completedFuture(
                                features.sessiongeneration.api.GenerationRunResponse.failure(
                                        GenerationStatus.STORAGE_FAILURE,
                                        "qualification injected generation storage failure"));
                    }
                    return delegate.commit(command);
                }
            };
        }
    }

    private static class ForwardingGenerationApi implements SessionGenerationApi {
        protected final SessionGenerationApi delegate;

        private ForwardingGenerationApi(SessionGenerationApi delegate) {
            this.delegate = delegate;
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationDraftResponse> draft(
                GenerationRequest request
        ) {
            return delegate.draft(request);
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> commit(
                features.sessiongeneration.api.CommitGenerationRunCommand command
        ) {
            return delegate.commit(command);
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRunResponse> load(
                features.sessiongeneration.api.GenerationRunId runId
        ) {
            return delegate.load(runId);
        }

        @Override
        public CompletionStage<features.sessiongeneration.api.GenerationRewardBatchResponse> loadRewards(
                features.sessiongeneration.api.GenerationRewardBatchQuery query
        ) {
            return delegate.loadRewards(query);
        }
    }

    static final class RecordingDiagnostics implements Diagnostics {
        private final List<String> failures = new CopyOnWriteArrayList<>();
        private final List<Measurement> measurements = new CopyOnWriteArrayList<>();

        @Override
        public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
            failures.add(id.value() + ":" + failureType.getName());
        }

        @Override
        public void measurement(Measurement measurement) {
            measurements.add(measurement);
        }

        List<Measurement> measurements() {
            return List.copyOf(measurements);
        }

        List<String> failures() {
            return List.copyOf(failures);
        }
    }
}
