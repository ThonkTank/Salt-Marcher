package features.sessionplanner.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.UnaryOperator;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionActivePartyMembersFact;
import features.sessionplanner.domain.session.SessionPartyMemberProfile;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.SessionRestPlacement;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.ClearSessionRestGapCommand;
import features.sessionplanner.api.RemoveSessionManualLootNoteCommand;
import features.sessionplanner.domain.session.repository.SessionPlanSaveResult;
import features.sessionplanner.api.SessionPlannerCatalogCommand;
import features.sessionplanner.api.SessionPlannerEncounterAllocationCommand;
import features.sessionplanner.api.SessionPlannerEncounterCommand;
import features.sessionplanner.api.SessionPlannerParticipantCommand;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SetSessionEncounterDaysCommand;
import features.sessionplanner.api.SetSessionRestGapCommand;
import features.sessionplanner.api.UpdateSessionEncounterSceneCommand;
import features.sessionplanner.api.PrepareSessionCommand;

public final class SessionPlannerApplicationService implements features.sessionplanner.api.SessionPlannerApi {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("sessionplanner.storage-failure");

    private static final String COMMAND_PARAMETER = "command";
    private static final long INITIAL_SESSION_ID = 1L;
    private static final long NO_SESSION_ID = 0L;
    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final SessionPlannerForeignFacts facts;
    private final SessionPlannerPublishedState publishedState;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private final SessionPreparationCoordinator preparation;
    private final AtomicBoolean initializationRequested = new AtomicBoolean();
    private final AtomicBoolean initialized = new AtomicBoolean();

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPlannerForeignFacts facts,
            SessionPlannerPublishedState publishedState,
            SessionPreparationCoordinator preparation,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.facts = Objects.requireNonNull(facts, "facts");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.preparation = Objects.requireNonNull(preparation, "preparation");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public void initialize() {
        if (initializationRequested.compareAndSet(false, true)) {
            executeStorageCommand(() -> {
                publishedState.initialize();
                initialized.set(true);
            });
        }
    }

    public void refreshForeignFacts() {
        executeStorageCommand(publishedState::publishLoadedCurrentSession);
    }

    public void refreshPartyFacts() {
        if (!initialized.get()) {
            return;
        }
        executeStorageCommand(() -> {
            preparation.invalidate();
            publishedState.publishLoadedCurrentSession();
        });
    }

    public void createSession(SessionPlannerCatalogCommand.CreateSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> createSessionOnLane(command));
    }

    public void selectSession(SessionPlannerCatalogCommand.SelectSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> selectSessionOnLane(command));
    }

    public void renameSession(SessionPlannerCatalogCommand.RenameSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> renameSessionOnLane(command));
    }

    public void deleteSession(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> deleteSessionOnLane(command));
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.addParticipant(command.characterId())));
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.removeParticipant(command.characterId())));
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(
                session -> session.setEncounterDays(new EncounterDays(command.encounterDays()))));
    }

    public void addScene(AddSessionSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(SessionPlan::addScene));
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.attachEncounter(command.encounterPlanId())));
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.removeEncounter(command.encounterId())));
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.moveEncounterUp(command.encounterId())));
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.moveEncounterDown(command.encounterId())));
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.selectEncounter(command.encounterId())));
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.setEncounterAllocation(
                command.encounterId(),
                command.budgetPercentage())));
    }

    public void updateEncounterScene(UpdateSessionEncounterSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> updateEncounterSceneOnLane(command));
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.setRestPlacement(toRestPlacement(
                command.leftEncounterId(),
                command.rightEncounterId(),
                command.restKind()))));
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.clearRestPlacement(
                command.leftEncounterId(),
                command.rightEncounterId())));
    }

    public void addManualLootNote(AddSessionManualLootNoteCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.addManualLootNote(command.sceneId())));
    }

    public void removeManualLootNote(RemoveSessionManualLootNoteCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeStorageCommand(() -> mutateCurrent(session -> session.removeManualLootNote(command.noteId())));
    }

    @Override
    public void prepareSession(PrepareSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        preparation.prepare(command);
    }

    @Override
    public void cancelPreparation() {
        preparation.cancel();
    }

    private void createSessionOnLane(SessionPlannerCatalogCommand.CreateSessionCommand command) {
        OptionalLong nextId = nextSessionId();
        if (nextId.isEmpty()) {
            return;
        }
        String requestedName = command.displayName();
        SessionPlan seeded = seedSession(nextId.getAsLong());
        if (!requestedName.isBlank()) {
            seeded = seeded.rename(requestedName);
        }
        saveNewCurrent(seeded.withStatus("Neue Session erstellt."));
    }

    private void selectSessionOnLane(SessionPlannerCatalogCommand.SelectSessionCommand command) {
        long sessionId = command.sessionId();
        if (sessionId > NO_SESSION_ID) {
            repository.loadById(sessionId).ifPresent(this::selectLoadedSession);
        }
    }

    private void renameSessionOnLane(SessionPlannerCatalogCommand.RenameSessionCommand command) {
        if (command.sessionId() <= NO_SESSION_ID || command.displayName().isBlank()) {
            return;
        }
        repository.loadById(command.sessionId()).ifPresent(session ->
                saveCurrent(session, session.rename(command.displayName())));
    }

    private void deleteSessionOnLane(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        long sessionId = command.sessionId();
        if (sessionId <= NO_SESSION_ID) {
            return;
        }
        repository.delete(sessionId);
        List<SessionPlanSummary> remaining = repository.listSessions();
        if (remaining.isEmpty()) {
            saveNewCurrent(seedSession(repository.nextSessionId()).withStatus("Session geloescht."));
            return;
        }
        repository.loadById(remaining.get(0).sessionId())
                .ifPresent(session -> selectFallback(session.clearStatus().withStatus("Session geloescht.")));
    }

    private void updateEncounterSceneOnLane(UpdateSessionEncounterSceneCommand command) {
        mutateCurrent(session -> {
            if (command.locationId() > 0L && !facts.locationExists(command.locationId())) {
                return session.withStatus("Location nicht gefunden.");
            }
            return session.updateEncounterScene(
                    command.encounterId(), command.sceneTitle(), command.sceneNotes(), command.locationId());
        });
    }

    private void executeStorageCommand(Runnable command) {
        executionLane.execute(() -> {
            try {
                command.run();
            } catch (IllegalStateException exception) {
                reportStorageFailure(exception);
            }
        });
    }

    private void selectLoadedSession(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        preparation.invalidate();
        publishedState.publishCurrentSession(sessionPlan.clearStatus().withStatus("Session geoeffnet."));
    }

    private void selectFallback(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        preparation.invalidate();
        publishedState.publishCurrentSession(sessionPlan);
    }

    private Optional<SessionPlan> loadCurrentSession() {
        try {
            Optional<SessionPlan> currentSession = repository.loadCurrent();
            if (currentSession.isPresent()) {
                return Optional.of(currentSession.get().clearStatus());
            }
            return Optional.of(seedSession(INITIAL_SESSION_ID));
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return Optional.empty();
        }
    }

    private void mutateCurrent(UnaryOperator<SessionPlan> mutation) {
        Optional<SessionPlan> loaded = loadCurrentSession();
        if (loaded.isEmpty()) {
            return;
        }
        SessionPlan stable = loaded.get();
        saveCurrent(stable, mutation.apply(stable));
    }

    private void saveCurrent(SessionPlan stableSession, SessionPlan candidate) {
        SessionPlanSaveResult result;
        try {
            result = repository.save(Objects.requireNonNull(candidate, "candidate"));
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            publishedState.publishCurrentSessionWithoutCatalogRefresh(
                    stableSession.withStatus(SAVE_FAILURE_STATUS));
            return;
        }
        if (result.status() != SessionPlanSaveResult.Status.SUCCESS) {
            publishedState.publishCurrentSessionWithoutCatalogRefresh(
                    stableSession.withStatus(result.status() == SessionPlanSaveResult.Status.STALE
                            ? "Session wurde zwischenzeitlich geändert."
                            : SAVE_FAILURE_STATUS));
            return;
        }
        SessionPlan saved = result.committedSession().orElseThrow();
        preparation.invalidate();
        publishedState.publishCurrentSession(saved);
    }

    private void saveNewCurrent(SessionPlan sessionPlan) {
        SessionPlan saved;
        try {
            SessionPlanSaveResult result = repository.insert(Objects.requireNonNull(sessionPlan, "sessionPlan"));
            if (result.status() != SessionPlanSaveResult.Status.SUCCESS) {
                return;
            }
            saved = result.committedSession().orElseThrow();
            repository.setCurrentSessionId(saved.sessionId());
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return;
        }
        preparation.invalidate();
        publishedState.publishCurrentSession(saved);
    }

    private SessionPlan seedSession(long sessionId) {
        try {
            SessionActivePartyMembersFact activeParty = facts.activePartyMembers();
            List<Long> participantRefs = activeParty.available()
                    ? participantRefs(activeParty)
                    : List.of();
            return SessionPlan.seeded(sessionId, participantRefs, EncounterDays.one());
        } catch (IllegalStateException exception) {
            return SessionPlan.seeded(sessionId, List.of(), EncounterDays.one());
        }
    }

    private OptionalLong nextSessionId() {
        try {
            return OptionalLong.of(Math.max(INITIAL_SESSION_ID, repository.nextSessionId()));
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return OptionalLong.empty();
        }
    }

    private void reportStorageFailure(IllegalStateException exception) {
        diagnostics.failure(STORAGE_FAILURE, exception.getClass());
    }

    private static List<Long> participantRefs(SessionActivePartyMembersFact activeParty) {
        List<Long> participantRefs = new ArrayList<>();
        for (SessionPartyMemberProfile member : activeParty.members()) {
            participantRefs.add(member.characterId());
        }
        return participantRefs;
    }

    private static SessionRestPlacement toRestPlacement(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerRestKind restKind
    ) {
        return switch (restKind) {
            case SHORT_REST -> SessionRestPlacement.shortRestBetween(leftEncounterId, rightEncounterId);
            case LONG_REST -> SessionRestPlacement.longRestBetween(leftEncounterId, rightEncounterId);
            case NONE -> throw new IllegalArgumentException("Rest kind has no placement.");
        };
    }
}
