package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;
import src.domain.sessionplanner.application.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.application.AddSessionParticipantUseCase;
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
import src.domain.sessionplanner.published.MoveSessionEncounterDownCommand;
import src.domain.sessionplanner.published.MoveSessionEncounterUpCommand;
import src.domain.sessionplanner.published.RefreshSessionPlannerCommand;
import src.domain.sessionplanner.published.RemoveSessionEncounterCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.RemoveSessionParticipantCommand;
import src.domain.sessionplanner.published.SelectSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SetSessionEncounterAllocationCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;
import src.domain.sessionplanner.session.port.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class SessionPlannerApplicationService {

    private final CurrentSessionPlanRuntimeAccess runtime;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;
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

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionEncounterFactsLookup encounterFacts,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(partyFacts, "partyFacts");
        Objects.requireNonNull(encounterFacts, "encounterFacts");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.runtime = new CurrentSessionPlanRuntimeAccess(repository, partyFacts);
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
    }

    public void createSession(CreateSessionPlanCommand command) {
        Objects.requireNonNull(command, "command");
        createSessionUseCase.execute();
        publishCurrentState();
    }

    public void refreshSession(RefreshSessionPlannerCommand command) {
        Objects.requireNonNull(command, "command");
        refreshSessionUseCase.execute();
        publishCurrentState();
    }

    public void addParticipant(AddSessionParticipantCommand command) {
        AddSessionParticipantCommand effective = Objects.requireNonNull(command, "command");
        addParticipantUseCase.execute(effective.characterId());
        publishCurrentState();
    }

    public void removeParticipant(RemoveSessionParticipantCommand command) {
        RemoveSessionParticipantCommand effective = Objects.requireNonNull(command, "command");
        removeParticipantUseCase.execute(effective.characterId());
        publishCurrentState();
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = Objects.requireNonNull(command, "command");
        setEncounterDaysUseCase.execute(effective.encounterDays());
        publishCurrentState();
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = Objects.requireNonNull(command, "command");
        attachEncounterUseCase.execute(effective.encounterPlanId());
        publishCurrentState();
    }

    public void removeEncounter(RemoveSessionEncounterCommand command) {
        RemoveSessionEncounterCommand effective = Objects.requireNonNull(command, "command");
        removeEncounterUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void moveEncounterUp(MoveSessionEncounterUpCommand command) {
        MoveSessionEncounterUpCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterUpUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void moveEncounterDown(MoveSessionEncounterDownCommand command) {
        MoveSessionEncounterDownCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterDownUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void setEncounterAllocation(SetSessionEncounterAllocationCommand command) {
        SetSessionEncounterAllocationCommand effective = Objects.requireNonNull(command, "command");
        setEncounterAllocationUseCase.execute(effective.encounterId(), effective.budgetPercentage());
        publishCurrentState();
    }

    public void selectEncounter(SelectSessionEncounterCommand command) {
        SelectSessionEncounterCommand effective = Objects.requireNonNull(command, "command");
        selectEncounterUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        if (effective.restKind() == SessionPlannerRestKind.NONE) {
            clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        } else {
            setRestGapUseCase.execute(toRestPlacement(effective));
        }
        publishCurrentState();
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        clearRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId());
        publishCurrentState();
    }

    public void addLootPlaceholder(AddSessionLootPlaceholderCommand command) {
        Objects.requireNonNull(command, "command");
        addLootPlaceholderUseCase.execute();
        publishCurrentState();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = Objects.requireNonNull(command, "command");
        removeLootPlaceholderUseCase.execute(effective.lootId());
        publishCurrentState();
    }

    private void publishCurrentState() {
        publishedStateRepository.publishCurrentSession(runtime.loadOrCreateCurrent());
    }

    private static SessionRestPlacement toRestPlacement(SetSessionRestGapCommand command) {
        return switch (command.restKind()) {
            case SHORT_REST -> SessionRestPlacement.shortRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case LONG_REST -> SessionRestPlacement.longRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case NONE -> throw new IllegalArgumentException("NONE rest kind has no placement.");
        };
    }
}
