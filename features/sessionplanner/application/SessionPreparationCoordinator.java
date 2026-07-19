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
import platform.execution.ExecutionLane;

public final class SessionPreparationCoordinator {

    private static final DiagnosticId PREPARATION_FAILURE =
            new DiagnosticId("sessionplanner.preparation-failure");

    private final SessionPlanRepository repository;
    private final SessionPreparedSessionStore preparedSessions;
    private final PartyApi party;
    private final SessionPlannerWorkspacePublicationCoordinator workspace;
    private final SessionGenerationApi generation;
    private final EncounterApi encounters;
    private final ExecutionLane executionLane;
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
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.preparedSessions = Objects.requireNonNull(preparedSessions, "preparedSessions");
        this.party = Objects.requireNonNull(party, "party");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.generation = Objects.requireNonNull(generation, "generation");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    void prepare(PrepareSessionCommand command) {
        Objects.requireNonNull(command, "command");
        executionLane.execute(() -> prepareOnLane(command));
    }

    void cancel() {
        executionLane.execute(() -> invalidateOnLane(
                SessionPreparationStatus.CANCELLED, "Vorbereitung abgebrochen."));
    }

    void invalidate() {
        executionLane.execute(() -> invalidateOnLane(SessionPreparationStatus.IDLE, ""));
    }

    private void prepareOnLane(PrepareSessionCommand command) {
        long attemptId = ++attemptSequence;
        active = null;
        Optional<SessionPlan> loaded;
        try {
            loaded = repository.loadCurrent();
        } catch (IllegalStateException exception) {
            diagnostics.failure(PREPARATION_FAILURE, exception.getClass());
            publish(SessionPreparationStatus.FAILED, "Session konnte nicht geladen werden.", 0L, attemptId, false);
            return;
        }
        if (loaded.isEmpty()) {
            publish(SessionPreparationStatus.INVALID, "Keine Session verfügbar.", 0L, attemptId, false);
            return;
        }
        SessionPlan session = loaded.orElseThrow();
        if (replacesAuthoredContent(session) && !command.replacementConfirmed()) {
            publish(
                    SessionPreparationStatus.CONFIRMING_REPLACEMENT,
                    "Vorhandene Szenen, Rasten und Beutenotizen werden ersetzt.",
                    session.sessionId(), attemptId, false);
            return;
        }
        publish(SessionPreparationStatus.GENERATING, "Session wird generiert …",
                session.sessionId(), attemptId, true);
        CompletionStage<PartyPlanningFactsResponse> planningStage;
        try {
            planningStage = party.loadPlanningFacts(new PartyPlanningFactsQuery(session.participantRefs(), 0));
        } catch (RuntimeException exception) {
            diagnostics.failure(PREPARATION_FAILURE, exception.getClass());
            publish(SessionPreparationStatus.FAILED, "Party-Planungsdaten konnten nicht geladen werden.",
                    session.sessionId(), attemptId, false);
            return;
        }
        if (planningStage == null) {
            publish(SessionPreparationStatus.FAILED, "Party-Planungsdaten konnten nicht geladen werden.",
                    session.sessionId(), attemptId, false);
            return;
        }
        try {
            planningStage.whenComplete((response, failure) -> {
                try {
                    executionLane.execute(() ->
                            completePlanningFacts(attemptId, session, command, response, failure));
                } catch (RuntimeException schedulingFailure) {
                    diagnostics.failure(PREPARATION_FAILURE, schedulingFailure.getClass());
                    if (attemptSequence == attemptId) {
                        publish(SessionPreparationStatus.FAILED,
                                "Party-Planungsdaten konnten nicht abgeschlossen werden.",
                                session.sessionId(), attemptId, false);
                    }
                }
            });
        } catch (RuntimeException exception) {
            diagnostics.failure(PREPARATION_FAILURE, exception.getClass());
            publish(SessionPreparationStatus.FAILED, "Party-Planungsdaten konnten nicht geladen werden.",
                    session.sessionId(), attemptId, false);
        }
    }

    private void completePlanningFacts(
            long attemptId,
            SessionPlan session,
            PrepareSessionCommand command,
            PartyPlanningFactsResponse facts,
            Throwable failure
    ) {
        if (attemptSequence != attemptId) {
            return;
        }
        if (failure != null) {
            diagnostics.failure(PREPARATION_FAILURE, failure.getClass());
            publish(SessionPreparationStatus.FAILED, "Party-Planungsdaten konnten nicht geladen werden.",
                    session.sessionId(), attemptId, false);
            return;
        }
        Optional<SessionPreparationFingerprint> captured = SessionPreparationFingerprint.capture(
                session, facts, command.encounterCount(), command.seed());
        if (captured.isEmpty()) {
            publish(
                    SessionPreparationStatus.INVALID,
                    "Alle Session-Teilnehmer müssen mit gültigem Level verfügbar sein.",
                    session.sessionId(), attemptId, false);
            return;
        }
        Attempt attempt = new Attempt(attemptId, captured.orElseThrow());
        active = attempt;
        CompletionStage<GenerationDraftResponse> stage;
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

    private void completeGenerationDraft(
            Attempt attempt,
            GenerationDraftResponse response,
            Throwable failure
    ) {
        if (!isLive(attempt)) {
            return;
        }
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

    private void completeEncounterPrepare(
            Attempt attempt,
            PreparedGeneratedEncounterBatchResult response,
            Throwable failure
    ) {
        if (!isLive(attempt)) {
            return;
        }
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
        try {
            prepared = PreparedSessionDraft.assemble(
                    attempt.fingerprint,
                    attempt.generationDraft,
                    response.batch().orElseThrow());
        } catch (RuntimeException exception) {
            invalid(attempt, "Vorbereitete Session ist unvollständig oder widersprüchlich.");
            return;
        }
        if (!isLive(attempt)) {
            return;
        }
        attempt.prepared = prepared;
        publish(SessionPreparationStatus.SAVING, "Vorbereitete Session wird gespeichert …",
                attempt.fingerprint.sessionId(), attempt.id, true);
        startForeignCommits(attempt);
    }

    private void startForeignCommits(Attempt attempt) {
        CompletionStage<GenerationRunResponse> generationStage;
        CompletionStage<CommittedGeneratedEncounterBatchResult> encounterStage;
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
                    () -> {
                        attempt.generationCommit = result;
                        attempt.generationCommitFailure = failure;
                        completeForeignCommits(attempt);
                    },
                    "Generierte Session konnte nicht abgeschlossen werden."));
        } catch (RuntimeException exception) {
            attempt.generationCommitFailure = exception;
            completeForeignCommits(attempt);
        }
    }

    private void observeForeignEncounters(
            Attempt attempt,
            CompletionStage<CommittedGeneratedEncounterBatchResult> stage
    ) {
        try {
            stage.whenComplete((result, failure) -> scheduleCallback(
                    attempt,
                    () -> {
                        attempt.encounterCommit = result;
                        attempt.encounterCommitFailure = failure;
                        completeForeignCommits(attempt);
                    },
                    "Encounter-Speicherung konnte nicht abgeschlossen werden."));
        } catch (RuntimeException exception) {
            attempt.encounterCommitFailure = exception;
            completeForeignCommits(attempt);
        }
    }

    private void completeForeignCommits(Attempt attempt) {
        attempt.foreignCompletions++;
        if (attempt.foreignCompletions < 2) {
            return;
        }
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
        CommitPreparedSessionResult result;
        try {
            result = preparedSessions.commitPreparedSession(command);
        } catch (RuntimeException exception) {
            fail(attempt, "Session konnte nicht gespeichert werden.", exception);
            return;
        }
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
        List<CommitPreparedSessionCommand.GeneratedRewardReference> rewards = prepared.rewards().stream()
                .map(reward -> new CommitPreparedSessionCommand.GeneratedRewardReference(
                        reward.sceneId(), reward.generationRunId(), reward.treasureId(),
                        reward.lastKnownLabel())).toList();
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
                rewards.stream().map(reward -> new PreparedSessionPersistenceFingerprint.GeneratedRewardReference(
                        reward.sceneId(), reward.generationRunIdentity(), reward.treasureId(),
                        reward.lastKnownLabel())).toList(),
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
                rewards,
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
        if (!isActive(attempt)) {
            return false;
        }
        Optional<SessionPlan> current;
        try {
            current = repository.loadCurrent();
        } catch (IllegalStateException exception) {
            fail(attempt, "Session konnte nicht auf Änderungen geprüft werden.", exception);
            return false;
        }
        if (current.isEmpty()
                || current.orElseThrow().sessionId() != attempt.fingerprint.sessionId()
                || !current.orElseThrow().revision().equals(attempt.fingerprint.sourceRevision())) {
            active = null;
            attemptSequence++;
            publish(SessionPreparationStatus.INVALID,
                    "Session wurde geändert; die ältere Vorbereitung wurde verworfen.",
                    attempt.fingerprint.sessionId(), attempt.id, false);
            return false;
        }
        return true;
    }

    private boolean isActive(Attempt attempt) {
        return active == attempt && attemptSequence == attempt.id;
    }

    private void scheduleCallback(
            Attempt attempt,
            Runnable callback,
            String failureMessage
    ) {
        try {
            executionLane.execute(callback);
        } catch (RuntimeException exception) {
            fail(attempt, failureMessage, exception);
        }
    }

    private void invalidateOnLane(SessionPreparationStatus status, String message) {
        long sessionId = workspace.current().preparation().sessionId();
        long attemptId = ++attemptSequence;
        active = null;
        publish(status, message, sessionId, attemptId, false);
    }

    private void invalid(Attempt attempt, String message) {
        if (active != attempt) {
            return;
        }
        active = null;
        publish(SessionPreparationStatus.INVALID, message,
                attempt.fingerprint.sessionId(), attempt.id, false);
    }

    private void fail(Attempt attempt, String message, Throwable failure) {
        if (failure != null) {
            diagnostics.failure(PREPARATION_FAILURE, failure.getClass());
        }
        if (active != attempt) {
            return;
        }
        active = null;
        publish(SessionPreparationStatus.FAILED, message,
                attempt.fingerprint.sessionId(), attempt.id, false);
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
                || !session.generatedRewards().isEmpty();
    }

    @FunctionalInterface
    private interface Completion<T> {
        void complete(T result, Throwable failure);
    }

    private static final class Attempt {
        private final long id;
        private final SessionPreparationFingerprint fingerprint;
        private GenerationDraft generationDraft;
        private PreparedSessionDraft prepared;
        private int foreignCompletions;
        private GenerationRunResponse generationCommit;
        private Throwable generationCommitFailure;
        private CommittedGeneratedEncounterBatchResult encounterCommit;
        private Throwable encounterCommitFailure;

        private Attempt(long id, SessionPreparationFingerprint fingerprint) {
            this.id = id;
            this.fingerprint = fingerprint;
        }
    }
}
