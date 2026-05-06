package src.domain.sessionplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
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
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
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
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts
    ) {
        CurrentSessionPlanRuntimeAccess runtime = new CurrentSessionPlanRuntimeAccess(
                Objects.requireNonNull(repository, "repository"),
                Objects.requireNonNull(partyFacts, "partyFacts"),
                Objects.requireNonNull(encounterFacts, "encounterFacts"));
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

    public void createSession(CreateSessionPlanCommand command) {
        createSessionUseCase.execute();
        publishCurrentSnapshot();
    }

    public void refreshSession(RefreshSessionPlannerCommand command) {
        refreshSessionUseCase.execute();
        publishCurrentSnapshot();
    }

    public void addParticipant(AddSessionParticipantCommand command) {
        AddSessionParticipantCommand effective = command == null
                ? new AddSessionParticipantCommand(0L)
                : command;
        addParticipantUseCase.execute(effective.characterId());
        publishCurrentSnapshot();
    }

    public void removeParticipant(RemoveSessionParticipantCommand command) {
        RemoveSessionParticipantCommand effective = command == null
                ? new RemoveSessionParticipantCommand(0L)
                : command;
        removeParticipantUseCase.execute(effective.characterId());
        publishCurrentSnapshot();
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = command == null
                ? new SetSessionEncounterDaysCommand(java.math.BigDecimal.ONE)
                : command;
        setEncounterDaysUseCase.execute(effective.encounterDays());
        publishCurrentSnapshot();
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = command == null
                ? new AttachSessionEncounterCommand(0L)
                : command;
        attachEncounterUseCase.execute(effective.encounterPlanId());
        publishCurrentSnapshot();
    }

    public void removeEncounter(RemoveSessionEncounterCommand command) {
        RemoveSessionEncounterCommand effective = command == null
                ? new RemoveSessionEncounterCommand(0L)
                : command;
        removeEncounterUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void moveEncounterUp(MoveSessionEncounterUpCommand command) {
        MoveSessionEncounterUpCommand effective = command == null
                ? new MoveSessionEncounterUpCommand(0L)
                : command;
        moveEncounterUpUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void moveEncounterDown(MoveSessionEncounterDownCommand command) {
        MoveSessionEncounterDownCommand effective = command == null
                ? new MoveSessionEncounterDownCommand(0L)
                : command;
        moveEncounterDownUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void setEncounterAllocation(SetSessionEncounterAllocationCommand command) {
        SetSessionEncounterAllocationCommand effective = command == null
                ? new SetSessionEncounterAllocationCommand(0L, java.math.BigDecimal.ZERO)
                : command;
        setEncounterAllocationUseCase.execute(effective.encounterId(), effective.budgetPercentage());
        publishCurrentSnapshot();
    }

    public void selectEncounter(SelectSessionEncounterCommand command) {
        SelectSessionEncounterCommand effective = command == null
                ? new SelectSessionEncounterCommand(0L)
                : command;
        selectEncounterUseCase.execute(effective.encounterId());
        publishCurrentSnapshot();
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = command == null
                ? new SetSessionRestGapCommand(0L, 0L, src.domain.sessionplanner.published.SessionPlannerRestKind.NONE)
                : command;
        setRestGapUseCase.execute(
                effective.leftEncounterId(),
                effective.rightEncounterId(),
                toSessionRestKind(effective.restKind()));
        publishCurrentSnapshot();
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = command == null
                ? new ClearSessionRestGapCommand(0L, 0L)
                : command;
        clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        publishCurrentSnapshot();
    }

    public void addLootPlaceholder(AddSessionLootPlaceholderCommand command) {
        addLootPlaceholderUseCase.execute();
        publishCurrentSnapshot();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = command == null
                ? new RemoveSessionLootPlaceholderCommand(0L)
                : command;
        removeLootPlaceholderUseCase.execute(effective.lootId());
        publishCurrentSnapshot();
    }

    private void publishCurrentSnapshot() {
        SessionPlannerSnapshot snapshot = currentSessionSnapshot();
        notifySessionListeners(snapshot);
    }

    private SessionPlannerSnapshot currentSessionSnapshot() {
        return toPublishedSnapshot(assembleSnapshotUseCase.execute());
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

    private static SessionPlannerSnapshot toPublishedSnapshot(AssembleSessionPlannerSnapshotUseCase.ReadData readData) {
        AssembleSessionPlannerSnapshotUseCase.ReadData safe = readData == null
                ? new AssembleSessionPlannerSnapshotUseCase.ReadData(
                AssembleSessionPlannerSnapshotUseCase.ReadData.PartyData.empty(),
                AssembleSessionPlannerSnapshotUseCase.ReadData.SessionStateData.empty(),
                AssembleSessionPlannerSnapshotUseCase.ReadData.XpBudgetData.empty(),
                AssembleSessionPlannerSnapshotUseCase.ReadData.RestAdviceData.empty(),
                AssembleSessionPlannerSnapshotUseCase.ReadData.GoldBudgetData.placeholder(0),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                "")
                : readData;
        return new SessionPlannerSnapshot(
                new SessionPlannerSnapshot.PartyState(
                        safe.party().resolvedLevels(),
                        safe.party().participantCount(),
                        safe.party().averageLevel(),
                        safe.party().ready(),
                        safe.party().headline(),
                        safe.party().detail()),
                new SessionPlannerSnapshot.SessionState(
                        safe.session().sessionId(),
                        safe.session().encounterDays(),
                        safe.session().encounterDaysText(),
                        safe.session().selectedEncounterId(),
                        safe.session().hasSelectedEncounter()),
                new SessionPlannerSnapshot.XpBudgetState(
                        safe.xpBudget().available(),
                        safe.xpBudget().totalBudgetXp(),
                        safe.xpBudget().plannedEncounterXp(),
                        safe.xpBudget().remainingXp(),
                        safe.xpBudget().overBudgetXp(),
                        safe.xpBudget().firstShortRestXp(),
                        safe.xpBudget().secondShortRestXp(),
                        safe.xpBudget().progressFraction(),
                        safe.xpBudget().overBudget(),
                        safe.xpBudget().summary()),
                new SessionPlannerSnapshot.RestAdviceState(
                        safe.restAdvice().available(),
                        safe.restAdvice().recommendedShortRests(),
                        safe.restAdvice().recommendedLongRests(),
                        safe.restAdvice().placedShortRests(),
                        safe.restAdvice().placedLongRests(),
                        safe.restAdvice().summary()),
                new SessionPlannerSnapshot.GoldBudgetState(
                        safe.goldBudget().available(),
                        safe.goldBudget().headline(),
                        safe.goldBudget().detail()),
                safe.availableEncounterPlans().stream()
                        .map(plan -> new SessionPlannerSnapshot.AvailableEncounterPlan(
                                plan.planId(),
                                plan.name(),
                                plan.generatedLabel(),
                                plan.creatureCount(),
                                plan.adjustedXp(),
                                plan.difficultyLabel(),
                                plan.statusText(),
                                plan.importEnabled()))
                        .toList(),
                safe.participants().stream()
                        .map(participant -> new SessionPlannerSnapshot.SessionParticipant(
                                participant.characterId(),
                                participant.name(),
                                participant.level(),
                                participant.available(),
                                participant.statusText()))
                        .toList(),
                safe.plannedEncounters().stream()
                        .map(encounter -> new SessionPlannerSnapshot.PlannedEncounter(
                                encounter.encounterId(),
                                encounter.encounterPlanId(),
                                encounter.name(),
                                encounter.generatedLabel(),
                                encounter.creatureCount(),
                                encounter.totalBaseXp(),
                                encounter.adjustedXp(),
                                encounter.xpMultiplier(),
                                encounter.difficultyLabel(),
                                encounter.budgetPercentage(),
                                encounter.targetXp(),
                                encounter.selected()))
                        .toList(),
                safe.restGaps().stream()
                        .map(gap -> new SessionPlannerSnapshot.RestGap(
                                gap.gapIndex(),
                                gap.leftEncounterId(),
                                gap.rightEncounterId(),
                                toPublishedRestKind(gap.restKind())))
                        .toList(),
                safe.lootPlaceholders().stream()
                        .map(loot -> new SessionPlannerSnapshot.LootPlaceholder(
                                loot.token(),
                                loot.label()))
                        .toList(),
                safe.status());
    }

    private static src.domain.sessionplanner.published.SessionPlannerRestKind toPublishedRestKind(SessionRestKind restKind) {
        return switch (restKind == null ? SessionRestKind.NONE : restKind) {
            case NONE -> src.domain.sessionplanner.published.SessionPlannerRestKind.NONE;
            case SHORT_REST -> src.domain.sessionplanner.published.SessionPlannerRestKind.SHORT_REST;
            case LONG_REST -> src.domain.sessionplanner.published.SessionPlannerRestKind.LONG_REST;
        };
    }
}
