package features.sessionplanner.application;

import features.encounter.api.CommitGeneratedEncounterBatchCommand;
import features.encounter.api.CommittedGeneratedEncounterBatchResult;
import features.encounter.api.CommittedGeneratedEncounterMapping;
import features.encounter.api.EncounterApi;
import features.encounter.api.GeneratedEncounterBatchStatus;
import features.encounter.api.GeneratedEncounterBlock;
import features.encounter.api.GeneratedEncounterDifficulty;
import features.encounter.api.GeneratedEncounterIntent;
import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.GeneratedEncounterRole;
import features.encounter.api.GeneratedEncounterSource;
import features.encounter.api.PrepareGeneratedEncounterBatchCommand;
import features.encounter.api.PreparedEncounterRoster;
import features.encounter.api.PreparedGeneratedEncounterBatchResult;
import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationResult;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SessionPreparationSnapshot;
import features.sessionplanner.api.SessionPreparationStatus;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.party.api.PartyApi;
import features.party.api.PartyPlanningFactsQuery;
import features.party.api.PartyPlanningFactsResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.Measurement;
import platform.execution.ExecutionLane;

public final class SessionPreparationCoordinator {

    private static final DiagnosticId PREPARATION_FAILURE =
            new DiagnosticId("sessionplanner.preparation-failure");
    private static final DiagnosticId PARTY_READ =
            new DiagnosticId("sessionplanner.preparation.party-read");
    private static final DiagnosticId GENERATION_DRAFT =
            new DiagnosticId("sessionplanner.preparation.generation-draft");
    private static final DiagnosticId ENCOUNTER_PREPARE =
            new DiagnosticId("sessionplanner.preparation.encounter-prepare");
    private static final DiagnosticId PREPARED_ASSEMBLY =
            new DiagnosticId("sessionplanner.preparation.prepared-assembly");
    private static final DiagnosticId FOREIGN_COMMITS =
            new DiagnosticId("sessionplanner.preparation.foreign-commits");
    private static final DiagnosticId PLANNER_COMMIT =
            new DiagnosticId("sessionplanner.preparation.planner-commit");

    private final SessionPlanRepository repository;
    private final SessionPreparedSessionStore preparedSessions;
    private final PartyApi party;
    private final SessionPlannerWorkspacePublicationCoordinator workspace;
    private final SessionGenerationApi generation;
    private final EncounterApi encounters;
    private final ExecutionLane cpuLane;
    private final ExecutionLane ioLane;
    private final ExecutionLane authoredWriterLane;
    private final Diagnostics diagnostics;
    private long attemptSequence;
    private Attempt active;

    public SessionPreparationCoordinator(
            SessionPlanRepository repository,
            SessionPreparedSessionStore preparedSessions,
            PartyApi party,
            SessionPlannerWorkspacePublicationCoordinator workspace,
            SessionGenerationApi generation,
            EncounterApi encounters,
            ExecutionLane cpuLane,
            ExecutionLane ioLane,
            ExecutionLane authoredWriterLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.preparedSessions = Objects.requireNonNull(preparedSessions, "preparedSessions");
        this.party = Objects.requireNonNull(party, "party");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.generation = Objects.requireNonNull(generation, "generation");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.cpuLane = Objects.requireNonNull(cpuLane, "cpuLane");
        this.ioLane = Objects.requireNonNull(ioLane, "ioLane");
        this.authoredWriterLane = Objects.requireNonNull(authoredWriterLane, "authoredWriterLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    synchronized void prepare(PrepareSessionCommand command) {
        Objects.requireNonNull(command, "command");
        if (!targetsCurrentWorkspace(command.target())) {
            return;
        }
        Attempt attempt = new Attempt(++attemptSequence, command);
        active = attempt;
        publish(SessionPreparationStatus.GENERATING, "Session wird vorbereitet …",
                command.target().sessionId(), attempt.id, true);
        dispatchIo(attempt, () -> loadSession(attempt), "Session konnte nicht geladen werden.");
    }

    synchronized void cancel() {
        if (active == null || active.plannerCommitPointOfNoReturn) {
            return;
        }
        invalidateNow(SessionPreparationStatus.CANCELLED, "Vorbereitung abgebrochen.");
    }

    synchronized void invalidate() {
        invalidateNow(SessionPreparationStatus.IDLE, "");
    }

    synchronized void invalidate(SessionPlannerAuthoredTarget target) {
        Objects.requireNonNull(target, "target");
        if (!targetsCurrentWorkspace(target) && !targetsActiveAttempt(target)) {
            return;
        }
        invalidateNow(SessionPreparationStatus.IDLE, "");
    }

    private boolean targetsCurrentWorkspace(SessionPlannerAuthoredTarget target) {
        return workspace.current().sourceSessionId() == target.sessionId()
                && workspace.current().sourceSessionRevision() == target.expectedRevision();
    }

    private boolean targetsActiveAttempt(SessionPlannerAuthoredTarget target) {
        if (active == null) {
            return false;
        }
        return active.command.target().equals(target);
    }

    private void loadSession(Attempt attempt) {
        Optional<SessionPlan> loaded;
        try {
            loaded = repository.loadById(attempt.command.target().sessionId());
        } catch (IllegalStateException exception) {
            scheduleCpu(attempt, () -> fail(attempt, "Session konnte nicht geladen werden.", exception),
                    "Session konnte nicht geladen werden.");
            return;
        }
        scheduleCpu(attempt, () -> completeSessionLoad(attempt, loaded), "Session konnte nicht geladen werden.");
    }

    private synchronized void completeSessionLoad(Attempt attempt, Optional<SessionPlan> loaded) {
        if (!isActive(attempt)) {
            return;
        }
        if (loaded.isEmpty()) {
            invalid(attempt, "Keine Session verfügbar.");
            return;
        }
        SessionPlan session = loaded.orElseThrow();
        if (session.revision().value() != attempt.command.target().expectedRevision()) {
            invalid(attempt, "Session wurde geändert; die Vorbereitung wurde nicht übernommen.");
            return;
        }
        attempt.session = session;
        if (replacesAuthoredContent(session) && !attempt.command.replacementConfirmed()) {
            active = null;
            publish(
                    SessionPreparationStatus.CONFIRMING_REPLACEMENT,
                    "Vorhandene Szenen, Rasten und Beutenotizen werden ersetzt.",
                    session.sessionId(), attempt.id, false);
            return;
        }
        publish(SessionPreparationStatus.GENERATING, "Session wird generiert …",
                session.sessionId(), attempt.id, true);
        CompletionStage<PartyPlanningFactsResponse> planningStage;
        attempt.partyReadStartedNanos = System.nanoTime();
        try {
            planningStage = party.loadPlanningFacts(new PartyPlanningFactsQuery(session.participantRefs(), 0));
        } catch (RuntimeException exception) {
            fail(attempt, "Party-Planungsdaten konnten nicht geladen werden.", exception);
            return;
        }
        if (planningStage == null) {
            fail(attempt, "Party-Planungsdaten konnten nicht geladen werden.", null);
            return;
        }
        observe(planningStage, (response, failure) -> completePlanningFacts(attempt, response, failure), attempt,
                "Party-Planungsdaten konnten nicht geladen werden.");
    }

    private synchronized void completePlanningFacts(
            Attempt attempt,
            PartyPlanningFactsResponse facts,
            Throwable failure
    ) {
        if (!isActive(attempt)) {
            return;
        }
        measure(PARTY_READ, attempt, attempt.partyReadStartedNanos,
                attempt.session.participantRefs().size(), 0);
        if (failure != null) {
            fail(attempt, "Party-Planungsdaten konnten nicht geladen werden.", failure);
            return;
        }
        Optional<SessionPreparationFingerprint> captured = SessionPreparationFingerprint.capture(
                attempt.session, facts, attempt.command.encounterCount(), attempt.command.seed());
        if (captured.isEmpty()) {
            invalid(attempt, "Alle Session-Teilnehmer müssen mit gültigem Level verfügbar sein.");
            return;
        }
        attempt.fingerprint = captured.orElseThrow();
        CompletionStage<GenerationDraftResponse> stage;
        attempt.generationDraftStartedNanos = System.nanoTime();
        try {
            stage = generation.draft(attempt.fingerprint.toGenerationRequest());
        } catch (RuntimeException exception) {
            fail(attempt, "Session konnte nicht generiert werden.", exception);
            return;
        }
        if (stage == null) {
            fail(attempt, "Session konnte nicht generiert werden.", null);
            return;
        }
        observe(stage, (response, draftFailure) -> completeGenerationDraft(attempt, response, draftFailure), attempt,
                "Session konnte nicht generiert werden.");
    }

    private synchronized void completeGenerationDraft(
            Attempt attempt,
            GenerationDraftResponse response,
            Throwable failure
    ) {
        if (!isLive(attempt)) {
            return;
        }
        int encounterCount = response == null || response.draft().isEmpty()
                ? 0 : response.draft().orElseThrow().result().encounters().size();
        measure(GENERATION_DRAFT, attempt, attempt.generationDraftStartedNanos, encounterCount, 0);
        if (failure != null) {
            fail(attempt, "Session konnte nicht generiert werden.", failure);
            return;
        }
        if (response == null || response.status() != GenerationStatus.SUCCESS || response.draft().isEmpty()) {
            if (response != null && response.status() == GenerationStatus.INVALID_REQUEST) {
                invalid(attempt, "Session-Eingaben sind ungültig.");
            } else {
                fail(attempt, "Session konnte nicht generiert werden.", null);
            }
            return;
        }
        GenerationDraft draft = response.draft().orElseThrow();
        PrepareGeneratedEncounterBatchCommand command;
        try {
            command = toEncounterPrepareCommand(attempt.fingerprint, draft.result());
        } catch (RuntimeException exception) {
            invalid(attempt, "Generierte Session-Daten sind unvollständig.");
            return;
        }
        attempt.generationDraft = draft;
        publish(SessionPreparationStatus.RESOLVING_ENCOUNTERS, "Encounter werden aufgelöst …",
                attempt.fingerprint.sessionId(), attempt.id, true);
        CompletionStage<PreparedGeneratedEncounterBatchResult> stage;
        attempt.encounterPrepareStartedNanos = System.nanoTime();
        try {
            stage = encounters.prepareGeneratedBatch(command);
        } catch (RuntimeException exception) {
            fail(attempt, "Encounter konnten nicht vorbereitet werden.", exception);
            return;
        }
        if (stage == null) {
            fail(attempt, "Encounter konnten nicht vorbereitet werden.", null);
            return;
        }
        observe(stage, (prepared, prepareFailure) -> completeEncounterPrepare(
                        attempt, prepared, prepareFailure),
                attempt, "Encounter konnten nicht vorbereitet werden.");
    }

    private synchronized void completeEncounterPrepare(
            Attempt attempt,
            PreparedGeneratedEncounterBatchResult response,
            Throwable failure
    ) {
        if (!isLive(attempt)) {
            return;
        }
        int rosterCount = response == null || response.batch().isEmpty()
                ? 0 : response.batch().orElseThrow().rosters().size();
        measure(ENCOUNTER_PREPARE, attempt, attempt.encounterPrepareStartedNanos, rosterCount, 0);
        if (failure != null) {
            fail(attempt, "Encounter konnten nicht vorbereitet werden.", failure);
            return;
        }
        if (response == null || response.status() != GeneratedEncounterBatchStatus.SUCCESS
                || response.batch().isEmpty()) {
            if (response != null && (response.status() == GeneratedEncounterBatchStatus.INVALID_REQUEST
                    || response.status() == GeneratedEncounterBatchStatus.UNRESOLVABLE)) {
                invalid(attempt, "Encounter konnten nicht vollständig aufgelöst werden.");
            } else {
                fail(attempt, "Encounter konnten nicht vorbereitet werden.", null);
            }
            return;
        }
        PreparedSessionDraft prepared;
        long assemblyStarted = System.nanoTime();
        try {
            prepared = PreparedSessionDraft.assemble(
                    attempt.fingerprint,
                    attempt.generationDraft,
                    response.batch().orElseThrow());
        } catch (RuntimeException exception) {
            invalid(attempt, "Vorbereitete Session ist unvollständig oder widersprüchlich.");
            return;
        }
        measure(PREPARED_ASSEMBLY, attempt, assemblyStarted, prepared.scenes().size(), 0);
        if (!isLive(attempt)) {
            return;
        }
        attempt.prepared = prepared;
        publish(SessionPreparationStatus.SAVING, "Vorbereitete Session wird gespeichert …",
                attempt.fingerprint.sessionId(), attempt.id, true);
        startForeignCommits(attempt);
    }

    private synchronized void startForeignCommits(Attempt attempt) {
        CompletionStage<GenerationRunResponse> generationStage;
        CompletionStage<CommittedGeneratedEncounterBatchResult> encounterStage;
        attempt.foreignCommitsStartedNanos = System.nanoTime();
        try {
            generationStage = generation.commit(new CommitGenerationRunCommand(attempt.prepared.generationDraft()));
            if (generationStage == null) {
                fail(attempt, "Generierte Session konnte nicht gespeichert werden.", null);
                return;
            }
            encounterStage = encounters.commitGeneratedBatch(
                    new CommitGeneratedEncounterBatchCommand(attempt.prepared.encounterBatch()));
            if (encounterStage == null) {
                fail(attempt, "Generierte Encounter konnten nicht gespeichert werden.", null);
                return;
            }
        } catch (RuntimeException exception) {
            fail(attempt, "Vorbereitete Session konnte nicht gespeichert werden.", exception);
            return;
        }
        observeForeignGeneration(attempt, generationStage);
        observeForeignEncounters(attempt, encounterStage);
    }

    private void observeForeignGeneration(Attempt attempt, CompletionStage<GenerationRunResponse> stage) {
        try {
            stage.whenComplete((result, failure) -> scheduleCallback(
                    attempt,
                    () -> completeForeignGeneration(attempt, result, failure),
                    "Generierte Session konnte nicht abgeschlossen werden."));
        } catch (RuntimeException exception) {
            completeForeignGeneration(attempt, null, exception);
        }
    }

    private synchronized void completeForeignGeneration(
            Attempt attempt,
            GenerationRunResponse result,
            Throwable failure
    ) {
        if (!isActive(attempt)) {
            return;
        }
        attempt.generationCommit = result;
        attempt.generationCommitFailure = failure;
        completeForeignCommits(attempt);
    }

    private void observeForeignEncounters(
            Attempt attempt,
            CompletionStage<CommittedGeneratedEncounterBatchResult> stage
    ) {
        try {
            stage.whenComplete((result, failure) -> scheduleCallback(
                    attempt,
                    () -> completeForeignEncounters(attempt, result, failure),
                    "Encounter-Speicherung konnte nicht abgeschlossen werden."));
        } catch (RuntimeException exception) {
            completeForeignEncounters(attempt, null, exception);
        }
    }

    private synchronized void completeForeignEncounters(
            Attempt attempt,
            CommittedGeneratedEncounterBatchResult result,
            Throwable failure
    ) {
        if (!isActive(attempt)) {
            return;
        }
        attempt.encounterCommit = result;
        attempt.encounterCommitFailure = failure;
        completeForeignCommits(attempt);
    }

    private synchronized void completeForeignCommits(Attempt attempt) {
        attempt.foreignCompletions++;
        if (attempt.foreignCompletions < 2) {
            return;
        }
        measure(FOREIGN_COMMITS, attempt, attempt.foreignCommitsStartedNanos, 2, 0);
        if (!isLive(attempt)) {
            return;
        }
        if (attempt.generationCommitFailure != null || attempt.encounterCommitFailure != null
                || !validGenerationCommit(attempt)
                || !validEncounterCommit(attempt)) {
            Throwable failure = attempt.generationCommitFailure != null
                    ? attempt.generationCommitFailure : attempt.encounterCommitFailure;
            fail(attempt, "Vorbereitete Session konnte nicht vollständig gespeichert werden.", failure);
            return;
        }
        CommitPreparedSessionCommand command;
        try {
            command = toPlannerCommit(attempt.prepared, attempt.encounterCommit.mappings());
        } catch (RuntimeException exception) {
            invalid(attempt, "Gespeicherte Encounter-Zuordnung ist unvollständig.");
            return;
        }
        if (!isLive(attempt)) {
            return;
        }
        attempt.plannerCommitStartedNanos = System.nanoTime();
        scheduleAuthoredCommit(attempt, () -> commitPlanner(attempt, command));
    }

    private void commitPlanner(Attempt attempt, CommitPreparedSessionCommand command) {
        if (!isActive(attempt)) {
            return;
        }
        CommitPreparedSessionResult result;
        try {
            Optional<SessionPlan> current = repository.loadCurrent();
            if (current.isEmpty()
                    || current.orElseThrow().sessionId() != attempt.fingerprint.sessionId()
                    || !current.orElseThrow().revision().equals(attempt.fingerprint.sourceRevision())) {
                scheduleCpu(attempt, () -> invalid(
                                attempt, "Session wurde geändert; die Vorbereitung wurde nicht übernommen."),
                        "Session konnte nicht auf Änderungen geprüft werden.");
                return;
            }
            if (!enterPlannerCommit(attempt)) {
                return;
            }
            result = preparedSessions.commitPreparedSession(command);
        } catch (RuntimeException exception) {
            scheduleCpu(attempt, () -> fail(attempt, "Session konnte nicht gespeichert werden.", exception),
                    "Session konnte nicht gespeichert werden.");
            return;
        }
        scheduleCpu(attempt, () -> completePlannerCommit(attempt, result), "Session konnte nicht gespeichert werden.");
    }

    private void scheduleAuthoredCommit(Attempt attempt, Runnable work) {
        try {
            authoredWriterLane.execute(work);
        } catch (RuntimeException exception) {
            fail(attempt, "Session konnte nicht gespeichert werden.", exception);
        }
    }

    private synchronized void completePlannerCommit(Attempt attempt, CommitPreparedSessionResult result) {
        if (!isActive(attempt)) {
            return;
        }
        measure(PLANNER_COMMIT, attempt, attempt.plannerCommitStartedNanos,
                attempt.prepared.scenes().size(), 0);
        if (result == null) {
            fail(attempt, "Session konnte nicht gespeichert werden.", null);
            return;
        }
        if (!isActive(attempt)) {
            return;
        }
        if (result instanceof CommitPreparedSessionResult.Success success) {
            active = null;
            workspace.preparedCommit(success.committedSession(), new SessionPreparationSnapshot(
                    SessionPreparationStatus.READY, "Session ist vorbereitet.",
                    success.committedSession().sessionId(), attempt.id, false));
        } else if (result instanceof CommitPreparedSessionResult.Invalid
                || result instanceof CommitPreparedSessionResult.Stale
                || result instanceof CommitPreparedSessionResult.NotFound) {
            invalid(attempt, "Session wurde geändert; die Vorbereitung wurde nicht übernommen.");
        } else {
            fail(attempt, "Session konnte nicht gespeichert werden.", null);
        }
    }

    private boolean validGenerationCommit(Attempt attempt) {
        GenerationRunResponse response = attempt.generationCommit;
        return response != null
                && response.status() == GenerationStatus.SUCCESS
                && response.result().isPresent()
                && response.result().orElseThrow().equals(attempt.prepared.generationDraft().result());
    }

    private boolean validEncounterCommit(Attempt attempt) {
        CommittedGeneratedEncounterBatchResult response = attempt.encounterCommit;
        if (response == null || response.status() != GeneratedEncounterBatchStatus.SUCCESS) {
            return false;
        }
        List<PreparedEncounterRoster> prepared = attempt.prepared.encounterBatch().rosters();
        List<CommittedGeneratedEncounterMapping> committed = response.mappings();
        if (prepared.size() != committed.size()) {
            return false;
        }
        Set<Integer> numbers = new HashSet<>();
        Set<Long> planIds = new HashSet<>();
        for (int index = 0; index < prepared.size(); index++) {
            PreparedEncounterRoster roster = prepared.get(index);
            CommittedGeneratedEncounterMapping mapping = committed.get(index);
            if (mapping.encounterNumber() != roster.encounterNumber()
                    || !numbers.add(mapping.encounterNumber())
                    || !planIds.add(mapping.planId())
                    || !sameSummary(roster, mapping.summary())) {
                return false;
            }
        }
        return true;
    }

    private static boolean sameSummary(
            PreparedEncounterRoster prepared,
            GeneratedEncounterPlanSummary committed
    ) {
        GeneratedEncounterPlanSummary expected = prepared.summary();
        return committed.label().equals(expected.label())
                && committed.roster().equals(expected.roster())
                && committed.creatureCount() == expected.creatureCount()
                && committed.baseXp() == expected.baseXp()
                && committed.adjustedXp() == expected.adjustedXp()
                && committed.difficulty() == expected.difficulty()
                && committed.displaySummary().equals(expected.displaySummary());
    }

    private CommitPreparedSessionCommand toPlannerCommit(
            PreparedSessionDraft prepared,
            List<CommittedGeneratedEncounterMapping> committed
    ) {
        Map<Integer, Long> planByNumber = new HashMap<>();
        List<CommitPreparedSessionCommand.EncounterPlanMapping> mappings = new ArrayList<>();
        for (CommittedGeneratedEncounterMapping mapping : committed) {
            if (planByNumber.put(mapping.encounterNumber(), mapping.planId()) != null) {
                throw new IllegalArgumentException("duplicate encounter mapping");
            }
            mappings.add(new CommitPreparedSessionCommand.EncounterPlanMapping(
                    mapping.encounterNumber(), mapping.planId()));
        }
        List<CommitPreparedSessionCommand.Scene> scenes = prepared.scenes().stream().map(scene -> {
            long planId = scene.encounterNumber() == 0
                    ? 0L
                    : Objects.requireNonNull(planByNumber.get(scene.encounterNumber()), "missing encounter plan");
            return new CommitPreparedSessionCommand.Scene(
                    scene.sceneId(), scene.encounterNumber(), planId, scene.allocation(),
                    scene.title(), scene.notes(), scene.locationId());
        }).toList();
        List<CommitPreparedSessionCommand.Rest> rests = prepared.rests().stream()
                .map(rest -> new CommitPreparedSessionCommand.Rest(
                        rest.leftSceneId(), rest.rightSceneId(), rest.kind())).toList();
        List<CommitPreparedSessionCommand.ManualLootNote> notes = prepared.manualLootNotes().stream()
                .map(note -> new CommitPreparedSessionCommand.ManualLootNote(
                        note.noteId(), note.sceneId(), note.authoredText())).toList();
        var treasures = prepared.preparedTreasures();
        String runId = prepared.generationDraft().result().runId().value();
        String persistenceFingerprint = PreparedSessionPersistenceFingerprint.compute(
                prepared.source().sessionId(),
                prepared.source().sourceRevision(),
                prepared.source().identity(),
                scenes.stream().map(scene -> new PreparedSessionPersistenceFingerprint.Scene(
                        scene.sceneId(), scene.encounterNumber(),
                        scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString(),
                        scene.title(), scene.notes(), scene.locationId())).toList(),
                rests.stream().map(rest -> new PreparedSessionPersistenceFingerprint.Rest(
                        rest.leftSceneId(), rest.rightSceneId(), rest.kind())).toList(),
                prepared.selectedSceneId(),
                notes.stream().map(note -> new PreparedSessionPersistenceFingerprint.ManualLootNote(
                        note.noteId(), note.sceneId(), note.authoredText())).toList(),
                treasures,
                runId,
                mappings.stream().map(mapping -> new PreparedSessionPersistenceFingerprint.EncounterPlanMapping(
                        mapping.encounterNumber(), mapping.planId())).toList());
        return new CommitPreparedSessionCommand(
                prepared.source().sessionId(),
                prepared.source().sourceRevision(),
                prepared.source().identity(),
                persistenceFingerprint,
                scenes,
                rests,
                prepared.selectedSceneId(),
                notes,
                treasures,
                runId,
                mappings);
    }

    private static PrepareGeneratedEncounterBatchCommand toEncounterPrepareCommand(
            SessionPreparationFingerprint fingerprint,
            GenerationResult result
    ) {
        List<GeneratedEncounterIntent> intents = result.encounters().stream()
                .map(encounter -> new GeneratedEncounterIntent(
                        encounter.encounterNumber(),
                        "Generierter Encounter " + encounter.encounterNumber(),
                        encounter.targetXp(),
                        difficulty(encounter.difficulty()),
                        encounter.blocks().stream().map(block -> new GeneratedEncounterBlock(
                                block.id(), role(block.requestedRole()), block.challengeLabel(),
                                block.monsterXp(), block.count())).toList()))
                .toList();
        return new PrepareGeneratedEncounterBatchCommand(
                new GeneratedEncounterSource(
                        result.engineVersion(), fingerprint.identity(), result.runId().value()),
                intents);
    }

    private static GeneratedEncounterRole role(GenerationResult.EncounterRole role) {
        return GeneratedEncounterRole.valueOf(Objects.requireNonNull(role, "role").name());
    }

    private static GeneratedEncounterDifficulty difficulty(GenerationResult.Difficulty difficulty) {
        return GeneratedEncounterDifficulty.valueOf(Objects.requireNonNull(difficulty, "difficulty").name());
    }

    private <T> void observe(
            CompletionStage<T> stage,
            Completion<T> completion,
            Attempt attempt,
            String failureMessage
    ) {
        try {
            stage.whenComplete((result, failure) -> scheduleCallback(
                    attempt,
                    () -> completion.complete(result, failure),
                    failureMessage));
        } catch (RuntimeException exception) {
            fail(attempt, failureMessage, exception);
        }
    }

    private boolean isLive(Attempt attempt) {
        return isActive(attempt);
    }

    private synchronized boolean isActive(Attempt attempt) {
        return active == attempt && attemptSequence == attempt.id;
    }

    private synchronized boolean enterPlannerCommit(Attempt attempt) {
        if (!isActive(attempt) || attempt.plannerCommitPointOfNoReturn) {
            return false;
        }
        attempt.plannerCommitPointOfNoReturn = true;
        publish(SessionPreparationStatus.SAVING, "Vorbereitete Session wird gespeichert …",
                attempt.fingerprint.sessionId(), attempt.id, false);
        return true;
    }

    private void scheduleCallback(
            Attempt attempt,
            Runnable callback,
            String failureMessage
    ) {
        try {
            cpuLane.execute(callback);
        } catch (RuntimeException exception) {
            fail(attempt, failureMessage, exception);
        }
    }

    private void invalidateNow(SessionPreparationStatus status, String message) {
        long sessionId = workspace.current().preparation().sessionId();
        long attemptId = ++attemptSequence;
        active = null;
        publish(status, message, sessionId, attemptId, false);
    }

    private void dispatchIo(Attempt attempt, Runnable work, String failureMessage) {
        try {
            ioLane.execute(work);
        } catch (RuntimeException exception) {
            fail(attempt, failureMessage, exception);
        }
    }

    private void scheduleCpu(Attempt attempt, Runnable work, String failureMessage) {
        try {
            cpuLane.execute(work);
        } catch (RuntimeException exception) {
            fail(attempt, failureMessage, exception);
        }
    }

    private void measure(
            DiagnosticId id,
            Attempt attempt,
            long startedNanos,
            int cardinality,
            int queryCount
    ) {
        diagnostics.measurement(new Measurement(
                id,
                attempt.id,
                Math.max(0L, System.nanoTime() - startedNanos),
                cardinality,
                queryCount));
    }

    private synchronized void invalid(Attempt attempt, String message) {
        if (active != attempt) {
            return;
        }
        active = null;
        publish(SessionPreparationStatus.INVALID, message,
                sessionId(attempt), attempt.id, false);
    }

    private synchronized void fail(Attempt attempt, String message, Throwable failure) {
        if (failure != null) {
            diagnostics.failure(PREPARATION_FAILURE, failure.getClass());
        }
        if (active != attempt) {
            return;
        }
        active = null;
        publish(SessionPreparationStatus.FAILED, message,
                sessionId(attempt), attempt.id, false);
    }

    private long sessionId(Attempt attempt) {
        if (attempt.fingerprint != null) {
            return attempt.fingerprint.sessionId();
        }
        if (attempt.session != null) {
            return attempt.session.sessionId();
        }
        return workspace.current().sourceSessionId();
    }

    private void publish(
            SessionPreparationStatus status,
            String message,
            long sessionId,
            long attemptId,
            boolean cancelEnabled
    ) {
        workspace.publishPreparation(new SessionPreparationSnapshot(
                status, message, sessionId, attemptId, cancelEnabled));
    }

    private static boolean replacesAuthoredContent(SessionPlan session) {
        return !session.encounters().isEmpty()
                || !session.restPlacements().isEmpty()
                || !session.manualLootNotes().isEmpty()
                || !session.treasures().isEmpty();
    }

    @FunctionalInterface
    private interface Completion<T> {
        void complete(T result, Throwable failure);
    }

    private static final class Attempt {
        private final long id;
        private final PrepareSessionCommand command;
        private SessionPlan session;
        private SessionPreparationFingerprint fingerprint;
        private GenerationDraft generationDraft;
        private PreparedSessionDraft prepared;
        private long partyReadStartedNanos;
        private long generationDraftStartedNanos;
        private long encounterPrepareStartedNanos;
        private long foreignCommitsStartedNanos;
        private long plannerCommitStartedNanos;
        private int foreignCompletions;
        private GenerationRunResponse generationCommit;
        private Throwable generationCommitFailure;
        private CommittedGeneratedEncounterBatchResult encounterCommit;
        private Throwable encounterCommitFailure;
        private boolean plannerCommitPointOfNoReturn;

        private Attempt(long id, PrepareSessionCommand command) {
            this.id = id;
            this.command = Objects.requireNonNull(command, "command");
        }
    }
}
