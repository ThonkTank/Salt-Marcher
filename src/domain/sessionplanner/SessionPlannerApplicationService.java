package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.domain.sessionplanner.application.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.application.AddSessionParticipantUseCase;
import src.domain.sessionplanner.application.AssembleSessionPlannerSnapshotUseCase;
import src.domain.sessionplanner.application.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.application.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.application.CreateSessionPlanUseCase;
import src.domain.sessionplanner.application.CurrentSessionPlanRuntimeAccess;
import src.domain.sessionplanner.application.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.application.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.application.RefreshSessionPlanUseCase;
import src.domain.sessionplanner.application.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.application.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.application.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.application.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.application.SessionPlannerRuntimeAdapter;
import src.domain.sessionplanner.application.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.application.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.application.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.AddSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.AddSessionParticipantCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.CreateSessionPlanCommand;
import src.domain.sessionplanner.published.LoadSessionPlannerQuery;
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RefreshSessionPlannerCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerModel;
import src.domain.sessionplanner.published.SessionPlannerSnapshot;
import src.domain.sessionplanner.published.SetSessionEncounterAllocationCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.session.value.SessionRestKind;

public final class SessionPlannerApplicationService {

    private final List<Consumer<SessionPlannerSnapshot>> sessionListeners = new ArrayList<>();
    private final SessionPlannerModel sessionModel = new SessionPlannerModel(
            this::currentSessionSnapshot,
            this::subscribeSessionListener);
    private final CreateSessionPlanUseCase createSessionUseCase;
    private final RefreshSessionPlanUseCase refreshSessionUseCase;
    private final AddSessionParticipantUseCase addParticipantUseCase;
    private final RemoveSessionParticipantUseCase removeParticipantUseCase;
    private final SetSessionEncounterDaysUseCase setEncounterDaysUseCase;
    private final AttachSessionEncounterUseCase attachEncounterUseCase;
    private final RemoveSessionEncounterUseCase removeEncounterUseCase;
    private final MoveSessionEncounterUpUseCase moveEncounterUpUseCase;
    private final MoveSessionEncounterDownUseCase moveEncounterDownUseCase;
    private final SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase;
    private final SelectSessionEncounterUseCase selectEncounterUseCase;
    private final SetSessionRestGapUseCase setRestGapUseCase;
    private final ClearSessionRestGapUseCase clearRestGapUseCase;
    private final AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase;
    private final RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase;
    private final AssembleSessionPlannerSnapshotUseCase assembleSnapshotUseCase;

    public SessionPlannerApplicationService(
            PartyApplicationService party,
            EncounterApplicationService encounters
    ) {
        PartyApplicationService partyService = Objects.requireNonNull(party, "party");
        EncounterApplicationService encounterService = Objects.requireNonNull(encounters, "encounters");
        SessionPlannerRuntimeAdapter runtimeAdapter = new SessionPlannerRuntimeAdapter(partyService, encounterService);
        CurrentSessionPlanRuntimeAccess runtime = new CurrentSessionPlanRuntimeAccess(runtimeAdapter, runtimeAdapter);
        this.createSessionUseCase = new CreateSessionPlanUseCase(runtime);
        this.refreshSessionUseCase = new RefreshSessionPlanUseCase(runtime);
        this.addParticipantUseCase = new AddSessionParticipantUseCase(runtime);
        this.removeParticipantUseCase = new RemoveSessionParticipantUseCase(runtime);
        this.setEncounterDaysUseCase = new SetSessionEncounterDaysUseCase(runtime);
        this.attachEncounterUseCase = new AttachSessionEncounterUseCase(runtime);
        this.removeEncounterUseCase = new RemoveSessionEncounterUseCase(runtime);
        this.moveEncounterUpUseCase = new MoveSessionEncounterUpUseCase(runtime);
        this.moveEncounterDownUseCase = new MoveSessionEncounterDownUseCase(runtime);
        this.setEncounterAllocationUseCase = new SetSessionEncounterAllocationUseCase(runtime);
        this.selectEncounterUseCase = new SelectSessionEncounterUseCase(runtime);
        this.setRestGapUseCase = new SetSessionRestGapUseCase(runtime);
        this.clearRestGapUseCase = new ClearSessionRestGapUseCase(runtime);
        this.addLootPlaceholderUseCase = new AddSessionLootPlaceholderUseCase(runtime);
        this.removeLootPlaceholderUseCase = new RemoveSessionLootPlaceholderUseCase(runtime);
        this.assembleSnapshotUseCase = new AssembleSessionPlannerSnapshotUseCase(runtime);
    }

    public SessionPlannerModel loadSession(LoadSessionPlannerQuery query) {
        Objects.requireNonNull(query, "query");
        currentSessionSnapshot();
        return sessionModel;
    }

    public SessionPlannerSnapshot createSession(CreateSessionPlanCommand command) {
        createSessionUseCase.execute();
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot refreshSession(RefreshSessionPlannerCommand command) {
        refreshSessionUseCase.execute();
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot addParticipant(AddSessionParticipantCommand command) {
        AddSessionParticipantCommand effective = command == null
                ? new AddSessionParticipantCommand(0L)
                : command;
        addParticipantUseCase.execute(effective.characterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot removeParticipant(RemoveSessionParticipantCommand command) {
        RemoveSessionParticipantCommand effective = command == null
                ? new RemoveSessionParticipantCommand(0L)
                : command;
        removeParticipantUseCase.execute(effective.characterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = command == null
                ? new SetSessionEncounterDaysCommand(null)
                : command;
        setEncounterDaysUseCase.execute(effective.encounterDays());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = command == null
                ? new AttachSessionEncounterCommand(0L)
                : command;
        attachEncounterUseCase.execute(effective.encounterPlanId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot removeEncounter(RemoveSessionEncounterCommand command) {
        RemoveSessionEncounterCommand effective = command == null
                ? new RemoveSessionEncounterCommand(0L)
                : command;
        removeEncounterUseCase.execute(effective.encounterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot moveEncounterUp(MoveSessionEncounterUpCommand command) {
        MoveSessionEncounterUpCommand effective = command == null
                ? new MoveSessionEncounterUpCommand(0L)
                : command;
        moveEncounterUpUseCase.execute(effective.encounterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot moveEncounterDown(MoveSessionEncounterDownCommand command) {
        MoveSessionEncounterDownCommand effective = command == null
                ? new MoveSessionEncounterDownCommand(0L)
                : command;
        moveEncounterDownUseCase.execute(effective.encounterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot setEncounterAllocation(SetSessionEncounterAllocationCommand command) {
        SetSessionEncounterAllocationCommand effective = command == null
                ? new SetSessionEncounterAllocationCommand(0L, null)
                : command;
        setEncounterAllocationUseCase.execute(effective.encounterId(), effective.budgetPercentage());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot selectEncounter(SelectSessionEncounterCommand command) {
        SelectSessionEncounterCommand effective = command == null
                ? new SelectSessionEncounterCommand(0L)
                : command;
        selectEncounterUseCase.execute(effective.encounterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = command == null
                ? new SetSessionRestGapCommand(0L, 0L, null)
                : command;
        setRestGapUseCase.execute(
                effective.leftEncounterId(),
                effective.rightEncounterId(),
                toSessionRestKind(effective.restKind()));
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = command == null
                ? new ClearSessionRestGapCommand(0L, 0L)
                : command;
        clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot addLootPlaceholder(AddSessionLootPlaceholderCommand command) {
        addLootPlaceholderUseCase.execute();
        return publishCurrentSnapshot();
    }

    public SessionPlannerSnapshot removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = command == null
                ? new RemoveSessionLootPlaceholderCommand(0L)
                : command;
        removeLootPlaceholderUseCase.execute(effective.lootId());
        return publishCurrentSnapshot();
    }

    private SessionPlannerSnapshot publishCurrentSnapshot() {
        SessionPlannerSnapshot snapshot = currentSessionSnapshot();
        notifySessionListeners(snapshot);
        return snapshot;
    }

    private SessionPlannerSnapshot currentSessionSnapshot() {
        return assembleSnapshotUseCase.execute();
    }

    private Runnable subscribeSessionListener(Consumer<SessionPlannerSnapshot> listener) {
        Consumer<SessionPlannerSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        sessionListeners.add(safeListener);
        return () -> sessionListeners.remove(safeListener);
    }

    private void notifySessionListeners(SessionPlannerSnapshot snapshot) {
        List<Consumer<SessionPlannerSnapshot>> listeners = List.copyOf(sessionListeners);
        for (Consumer<SessionPlannerSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private static SessionRestKind toSessionRestKind(src.domain.sessionplanner.published.SessionPlannerRestKind restKind) {
        return switch (restKind == null ? src.domain.sessionplanner.published.SessionPlannerRestKind.NONE : restKind) {
            case NONE -> SessionRestKind.NONE;
            case SHORT_REST -> SessionRestKind.SHORT_REST;
            case LONG_REST -> SessionRestKind.LONG_REST;
        };
    }
}
