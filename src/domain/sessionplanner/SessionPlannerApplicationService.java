package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.EncounterDays;
import src.domain.sessionplanner.model.session.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;
import src.domain.sessionplanner.model.session.SessionRestPlacement;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionSceneCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerCatalogCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.published.UpdateSessionEncounterSceneCommand;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
public final class SessionPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";
    private static final long INITIAL_SESSION_ID = 1L;
    private static final long NO_SESSION_ID = 0L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";
    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final SessionPlannerForeignFacts facts;
    private final SessionPlannerPublishedState publishedState;

    SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPlannerForeignFacts facts,
            SessionPlannerPublishedState publishedState
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.facts = Objects.requireNonNull(facts, "facts");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
    }

    public void createSession(SessionPlannerCatalogCommand.CreateSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        String requestedName = command.displayName();
        SessionPlan seeded = seedSession(nextSessionId());
        if (!requestedName.isBlank()) {
            seeded = seeded.rename(requestedName);
        }
        saveNewCurrent(seeded.withStatus("Neue Session erstellt."));
    }

    public void selectSession(SessionPlannerCatalogCommand.SelectSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        long sessionId = command.sessionId();
        if (sessionId <= NO_SESSION_ID) {
            return;
        }
        Optional<SessionPlan> loaded = repository.loadById(sessionId);
        loaded.ifPresent(this::selectLoadedSession);
    }

    public void renameSession(SessionPlannerCatalogCommand.RenameSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        if (command.sessionId() <= NO_SESSION_ID || command.displayName().isBlank()) {
            return;
        }
        repository.rename(command.sessionId(), command.displayName());
        Optional<SessionPlan> loaded = repository.loadById(command.sessionId());
        loaded.ifPresent(session -> publishedState.publishCurrentSession(
                session.clearStatus().withStatus("Session umbenannt.")));
    }

    public void deleteSession(SessionPlannerCatalogCommand.DeleteSessionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
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
        Optional<SessionPlan> fallback = repository.loadById(remaining.get(0).sessionId());
        fallback.ifPresent(session -> selectFallback(session.clearStatus().withStatus("Session geloescht.")));
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().addParticipant(command.characterId()));
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().removeParticipant(command.characterId()));
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().setEncounterDays(new EncounterDays(command.encounterDays())));
    }

    public void addScene(AddSessionSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().addScene());
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().attachEncounter(command.encounterPlanId()));
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().removeEncounter(command.encounterId()));
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().moveEncounterUp(command.encounterId()));
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().moveEncounterDown(command.encounterId()));
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().selectEncounter(command.encounterId()));
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().setEncounterAllocation(
                command.encounterId(),
                command.budgetPercentage()));
    }

    public void updateEncounterScene(UpdateSessionEncounterSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        SessionPlan session = loadCurrentSession();
        if (command.locationId() > 0L && !facts.locationExists(command.locationId())) {
            saveCurrent(session.withStatus("Location nicht gefunden."));
            return;
        }
        saveCurrent(session.updateEncounterScene(
                command.encounterId(),
                command.sceneTitle(),
                command.sceneNotes(),
                command.locationId()));
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().setRestPlacement(toRestPlacement(
                command.leftEncounterId(),
                command.rightEncounterId(),
                command.restKind())));
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().clearRestPlacement(
                command.leftEncounterId(),
                command.rightEncounterId()));
    }

    public void addLootPlaceholder(AddSessionLootPlaceholderCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().addLootPlaceholder(command.encounterId()));
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        saveCurrent(loadCurrentSession().removeLootPlaceholder(command.lootId()));
    }

    private void selectLoadedSession(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        publishedState.publishCurrentSession(sessionPlan.clearStatus().withStatus("Session geoeffnet."));
    }

    private void selectFallback(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        publishedState.publishCurrentSession(sessionPlan);
    }

    private SessionPlan loadCurrentSession() {
        try {
            Optional<SessionPlan> currentSession = repository.loadCurrent();
            if (currentSession.isPresent()) {
                return currentSession.get().clearStatus();
            }
            return seedSession(INITIAL_SESSION_ID);
        } catch (IllegalStateException exception) {
            return seedSession(INITIAL_SESSION_ID).withStatus(LOAD_FAILURE_STATUS);
        }
    }

    private void saveCurrent(SessionPlan sessionPlan) {
        publishedState.publishCurrentSession(persist(sessionPlan, false));
    }

    private void saveNewCurrent(SessionPlan sessionPlan) {
        publishedState.publishCurrentSession(persist(sessionPlan, true));
    }

    private SessionPlan persist(SessionPlan sessionPlan, boolean persistAsCurrent) {
        SessionPlan candidate = Objects.requireNonNull(sessionPlan, "sessionPlan");
        try {
            SessionPlan saved = repository.save(candidate);
            if (persistAsCurrent) {
                repository.setCurrentSessionId(saved.sessionId());
            }
            return saved;
        } catch (IllegalStateException exception) {
            return candidate.clearStatus().withStatus(SAVE_FAILURE_STATUS);
        }
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

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (IllegalStateException exception) {
            return INITIAL_SESSION_ID;
        }
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
