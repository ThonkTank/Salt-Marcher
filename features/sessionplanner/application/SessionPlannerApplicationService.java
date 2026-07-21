package features.sessionplanner.application;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRestPlacement;
import features.sessionplanner.domain.session.repository.SessionPlanRepository;
import features.sessionplanner.domain.session.repository.SessionPlanDeleteResult;
import features.sessionplanner.api.AddSessionManualLootNoteCommand;
import features.sessionplanner.api.AddSessionSceneCommand;
import features.sessionplanner.api.AttachSessionEncounterCommand;
import features.sessionplanner.api.ClearSessionRestGapCommand;
import features.sessionplanner.api.DetachSessionEncounterCommand;
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
import features.sessionplanner.api.UpdateSessionManualLootNoteCommand;
import features.sessionplanner.api.SessionPlannerAuthoredTarget;
import features.sessionplanner.api.PrepareSessionCommand;
import features.sessionplanner.api.SearchSessionEncounterPlansCommand;

public final class SessionPlannerApplicationService implements features.sessionplanner.api.SessionPlannerApi {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("sessionplanner.storage-failure");

    private static final String COMMAND_PARAMETER = "command";
    private static final long INITIAL_SESSION_ID = 1L;
    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final SessionPlannerWorkspacePublicationCoordinator workspace;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private final SessionPreparationCoordinator preparation;
    private final AtomicBoolean initializationRequested = new AtomicBoolean();
    private final AtomicBoolean initialized = new AtomicBoolean();

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPlannerWorkspacePublicationCoordinator workspace,
            SessionPreparationCoordinator preparation,
            ExecutionLane executionLane,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.preparation = Objects.requireNonNull(preparation, "preparation");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
    }

    public void initialize() {
        if (initializationRequested.compareAndSet(false, true)) {
            workspace.initialize();
            initialized.set(true);
        }
    }

    public void refreshForeignFacts() {
        workspace.providerRefresh();
    }

    public void refreshPartyFacts() {
        if (!initialized.get()) {
            return;
        }
        preparation.invalidate();
        workspace.providerRefresh();
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
        executeAuthoredCommand(command.target(), () -> renameSessionOnLane(command));
    }

    public void deleteSession(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> deleteSessionOnLane(command));
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> true, "", session -> session.addParticipant(command.characterId())));
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> session.participantRefs().contains(command.characterId()),
                "Teilnehmer wurde bereits entfernt.", session -> session.removeParticipant(command.characterId())));
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> true, "",
                session -> session.setEncounterDays(new EncounterDays(command.encounterDays()))));
    }

    public void addScene(AddSessionSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> true, "", SessionPlan::addScene));
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.sceneToken()),
                "Szene wurde entfernt. Encounter wurde nicht verknüpft.",
                session -> session.attachEncounter(command.sceneToken(), command.encounterPlanId())));
    }

    public void detachEncounter(DetachSessionEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.sceneToken()),
                "Szene wurde bereits entfernt.", session -> session.detachEncounter(command.sceneToken())));
    }

    @Override
    public void searchEncounterPlans(SearchSessionEncounterPlansCommand command) {
        workspace.searchEncounterPlans(Objects.requireNonNull(command, COMMAND_PARAMETER));
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeEncounterCommand(command, session -> session.removeEncounter(command.encounterId()));
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeEncounterCommand(command, session -> session.moveEncounterUp(command.encounterId()));
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeEncounterCommand(command, session -> session.moveEncounterDown(command.encounterId()));
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeEncounterCommand(command, session -> session.selectEncounter(command.encounterId()));
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.encounterId()),
                "Szene wurde entfernt. Budget wurde nicht gespeichert.",
                session -> session.setEncounterAllocation(command.encounterId(), command.budgetPercentage())));
    }

    public void updateEncounterScene(UpdateSessionEncounterSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> updateEncounterSceneOnLane(command));
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.leftEncounterId())
                        && containsScene(session, command.rightEncounterId()),
                "Szenenfolge wurde geändert. Rast wurde nicht gespeichert.",
                session -> session.setRestPlacement(toRestPlacement(
                        command.leftEncounterId(), command.rightEncounterId(), command.restKind()))));
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.leftEncounterId())
                        && containsScene(session, command.rightEncounterId()),
                "Szenenfolge wurde geändert. Rast wurde nicht entfernt.",
                session -> session.clearRestPlacement(command.leftEncounterId(), command.rightEncounterId())));
    }

    public void addManualLootNote(AddSessionManualLootNoteCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(),
                session -> containsScene(session, command.sceneId()),
                "Szene wurde entfernt. Beutenotiz wurde nicht gespeichert.",
                session -> session.addManualLootNote(command.sceneId(), command.authoredText())));
    }

    public void updateManualLootNote(UpdateSessionManualLootNoteCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(),
                session -> containsNote(session, command.sceneId(), command.noteId()),
                "Beutenotiz wurde entfernt. Änderung wurde nicht gespeichert.",
                session -> session.updateManualLootNote(
                        command.sceneId(), command.noteId(), command.authoredText())));
    }

    public void removeManualLootNote(RemoveSessionManualLootNoteCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(),
                session -> containsNote(session, command.sceneId(), command.noteId()),
                "Beutenotiz wurde bereits entfernt.",
                session -> session.removeManualLootNote(command.sceneId(), command.noteId())));
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
        Optional<SessionPlan> requested;
        try {
            requested = repository.loadById(sessionId);
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            publishFailure("Session konnte nicht geöffnet werden.", workspace.current().sourceSessionId());
            return;
        }
        if (requested.isEmpty()) {
            publishFailure("Ziel-Session wurde nicht gefunden.", workspace.current().sourceSessionId());
            return;
        }
        SessionPlan sourceAfterEdit = null;
        if (command.pendingSceneEdit().isPresent()) {
            GuardedSave guarded = saveGuardedScene(command.pendingSceneEdit().orElseThrow());
            if (!guarded.success()) {
                publishFailure(guarded.message(), guarded.sessionId());
                return;
            }
            sourceAfterEdit = guarded.saved();
        }
        SessionPlan target = sourceAfterEdit != null && sourceAfterEdit.sessionId() == sessionId
                ? sourceAfterEdit : requested.orElseThrow();
        try {
            repository.setCurrentSessionId(sessionId);
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            if (sourceAfterEdit != null) {
                workspace.authoredMutation(sourceAfterEdit.withStatus(
                        "Szenenänderung gespeichert; Ziel-Session konnte nicht geöffnet werden."));
            } else {
                publishFailure("Ziel-Session konnte nicht geöffnet werden.", workspace.current().sourceSessionId());
            }
            return;
        }
        preparation.invalidate();
        workspace.authoredMutation(target.clearStatus().withStatus("Session geoeffnet."));
    }

    private void renameSessionOnLane(SessionPlannerCatalogCommand.RenameSessionCommand command) {
        guardedMutation(command.target(), session -> true, "", session -> session.rename(command.displayName()));
    }

    private void deleteSessionOnLane(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        SessionPlannerAuthoredTarget target = command.target();
        List<Long> replacementParticipants = workspace.current().participants().activePartyMembers().stream()
                .map(features.sessionplanner.api.SessionPlannerParticipantsProjection.ActivePartyMember::characterId)
                .toList();
        SessionPlanDeleteResult result = repository.deleteGuarded(
                target.sessionId(), new features.sessionplanner.domain.session.SessionRevision(target.expectedRevision()),
                replacementParticipants);
        if (result.status() != SessionPlanDeleteResult.Status.SUCCESS) {
            String message = switch (result.status()) {
                case STALE -> "Session wurde zwischenzeitlich geändert. Bitte Löschen erneut prüfen.";
                case NOT_FOUND -> "Session wurde bereits entfernt.";
                case STORAGE_FAILURE -> "Session konnte nicht gelöscht werden.";
                case SUCCESS -> throw new IllegalStateException("unreachable delete result");
            };
            publishFailure(message, target.sessionId());
            return;
        }
        Optional<SessionPlan> authoritative = repository.loadCurrent();
        if (authoritative.isEmpty()) {
            publishFailure("Session konnte nach dem Löschen nicht geladen werden.", target.sessionId());
            return;
        }
        SessionPlan current = authoritative.orElseThrow().clearStatus().withStatus("Session geloescht.");
        if (workspace.current().sourceSessionId() == target.sessionId()) {
            preparation.invalidate(target);
            workspace.authoredMutation(current);
        } else {
            workspace.authoredNonCurrentMutation(current);
        }
    }

    private void updateEncounterSceneOnLane(UpdateSessionEncounterSceneCommand command) {
        if (command.locationId() > 0L && !workspace.locationExists(command.locationId())) {
            publishFailure("Location wurde entfernt. Szene wurde nicht gespeichert.", command.target().sessionId());
            return;
        }
        guardedMutation(
                command.target(),
                session -> containsScene(session, command.encounterId()),
                "Szene wurde entfernt. Änderung wurde nicht gespeichert.",
                session -> session.updateEncounterScene(
                        command.encounterId(), command.sceneTitle(), command.sceneNotes(), command.locationId()));
    }

    private GuardedSave saveGuardedScene(UpdateSessionEncounterSceneCommand command) {
        if (command.locationId() > 0L && !workspace.locationExists(command.locationId())) {
            return GuardedSave.failure(command.target().sessionId(),
                    "Location wurde entfernt. Session-Wechsel wurde abgebrochen.");
        }
        return saveGuarded(
                command.target(),
                session -> containsScene(session, command.encounterId()),
                "Szene wurde entfernt. Session-Wechsel wurde abgebrochen.",
                session -> session.updateEncounterScene(
                        command.encounterId(), command.sceneTitle(), command.sceneNotes(), command.locationId()));
    }

    private void guardedMutation(
            SessionPlannerAuthoredTarget target,
            Predicate<SessionPlan> referenceExists,
            String missingMessage,
            UnaryOperator<SessionPlan> mutation
    ) {
        GuardedSave guarded = saveGuarded(target, referenceExists, missingMessage, mutation);
        if (!guarded.success()) {
            publishFailure(guarded.message(), guarded.sessionId());
            return;
        }
        completeAuthoredMutation(target, guarded.saved());
    }

    private GuardedSave saveGuarded(
            SessionPlannerAuthoredTarget target,
            Predicate<SessionPlan> referenceExists,
            String missingMessage,
            UnaryOperator<SessionPlan> mutation
    ) {
        SessionPlan stable;
        try {
            Optional<SessionPlan> loaded = repository.loadById(target.sessionId());
            if (loaded.isEmpty()) {
                return GuardedSave.failure(target.sessionId(), "Session wurde entfernt. Änderung wurde nicht gespeichert.");
            }
            stable = loaded.orElseThrow().clearStatus();
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return GuardedSave.failure(target.sessionId(), SAVE_FAILURE_STATUS);
        }
        if (stable.revision().value() != target.expectedRevision()) {
            return GuardedSave.failure(target.sessionId(),
                    "Session wurde zwischenzeitlich geändert. Bitte Änderung erneut prüfen.");
        }
        if (!referenceExists.test(stable)) {
            return GuardedSave.failure(target.sessionId(), missingMessage);
        }
        SessionPlan candidate = mutation.apply(stable);
        if (candidate.equals(stable)) {
            return GuardedSave.success(stable);
        }
        try {
            SessionPlanSaveResult result = repository.save(candidate);
            if (result.status() != SessionPlanSaveResult.Status.SUCCESS) {
                return GuardedSave.failure(target.sessionId(), result.status() == SessionPlanSaveResult.Status.STALE
                        ? "Session wurde zwischenzeitlich geändert. Bitte Änderung erneut prüfen."
                        : SAVE_FAILURE_STATUS);
            }
            return GuardedSave.success(result.committedSession().orElseThrow());
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            return GuardedSave.failure(target.sessionId(), SAVE_FAILURE_STATUS);
        }
    }

    private static boolean containsScene(SessionPlan session, long sceneId) {
        return session.encounters().stream().anyMatch(scene -> scene.encounterId() == sceneId);
    }

    private static boolean containsNote(SessionPlan session, long sceneId, long noteId) {
        return session.manualLootNotes().stream()
                .anyMatch(note -> note.sceneId() == sceneId && note.noteId() == noteId);
    }

    private void executeEncounterCommand(SessionPlannerEncounterCommand command, UnaryOperator<SessionPlan> mutation) {
        executeAuthoredCommand(command.target(), () -> guardedMutation(
                command.target(), session -> containsScene(session, command.encounterId()),
                "Szene wurde bereits entfernt.", mutation));
    }

    private void completeAuthoredMutation(SessionPlannerAuthoredTarget target, SessionPlan saved) {
        Optional<SessionPlan> authoritative;
        try {
            authoritative = repository.loadCurrent();
        } catch (IllegalStateException exception) {
            reportStorageFailure(exception);
            publishFailure(SAVE_FAILURE_STATUS, target.sessionId());
            return;
        }
        if (authoritative.isEmpty()) {
            publishFailure(SAVE_FAILURE_STATUS, target.sessionId());
            return;
        }
        SessionPlan current = authoritative.orElseThrow();
        if (current.sessionId() == saved.sessionId()) {
            preparation.invalidate(target);
            workspace.authoredMutation(saved);
        } else {
            workspace.authoredNonCurrentMutation(current);
        }
    }

    private void executeStorageCommand(Runnable command) {
        workspace.authoredIntent();
        executionLane.execute(() -> {
            try {
                command.run();
            } catch (IllegalStateException exception) {
                reportStorageFailure(exception);
            }
        });
    }

    private void executeAuthoredCommand(SessionPlannerAuthoredTarget target, Runnable command) {
        workspace.authoredIntent(target);
        executionLane.execute(() -> {
            try {
                command.run();
            } catch (IllegalStateException exception) {
                reportStorageFailure(exception);
                publishFailure(SAVE_FAILURE_STATUS, target.sessionId());
            }
        });
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
        workspace.authoredMutation(saved);
    }

    private SessionPlan seedSession(long sessionId) {
        try {
            List<Long> participantRefs = workspace.current().participants().activePartyMembers().stream()
                    .map(features.sessionplanner.api.SessionPlannerParticipantsProjection.ActivePartyMember::characterId)
                    .toList();
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

    private void publishFailure(String message, long sessionId) {
        workspace.publishAuthoredFailure(sessionId, message);
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

    private record GuardedSave(boolean success, long sessionId, SessionPlan saved, String message) {
        private static GuardedSave success(SessionPlan saved) {
            return new GuardedSave(true, saved.sessionId(), saved, "");
        }

        private static GuardedSave failure(long sessionId, String message) {
            return new GuardedSave(false, sessionId, null, message);
        }
    }
}
