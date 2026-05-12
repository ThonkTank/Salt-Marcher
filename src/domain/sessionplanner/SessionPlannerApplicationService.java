package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

public final class SessionPlannerApplicationService {

    private final CreateSessionPlanUseCase createSessionUseCase;
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

    @SuppressWarnings("DomainPublicBoundarySignaturePurity")
    public SessionPlannerApplicationService(
            CreateSessionPlanUseCase createSessionUseCase,
            AddSessionParticipantUseCase addParticipantUseCase,
            RemoveSessionParticipantUseCase removeParticipantUseCase,
            SetSessionEncounterDaysUseCase setEncounterDaysUseCase,
            AttachSessionEncounterUseCase attachEncounterUseCase,
            RemoveSessionEncounterUseCase removeEncounterUseCase,
            MoveSessionEncounterUpUseCase moveEncounterUpUseCase,
            MoveSessionEncounterDownUseCase moveEncounterDownUseCase,
            SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase,
            SelectSessionEncounterUseCase selectEncounterUseCase,
            SetSessionRestGapUseCase setRestGapUseCase,
            ClearSessionRestGapUseCase clearRestGapUseCase,
            AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase,
            RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase
    ) {
        this.createSessionUseCase = Objects.requireNonNull(createSessionUseCase, "createSessionUseCase");
        this.addParticipantUseCase = Objects.requireNonNull(addParticipantUseCase, "addParticipantUseCase");
        this.removeParticipantUseCase = Objects.requireNonNull(removeParticipantUseCase, "removeParticipantUseCase");
        this.setEncounterDaysUseCase = Objects.requireNonNull(setEncounterDaysUseCase, "setEncounterDaysUseCase");
        this.attachEncounterUseCase = Objects.requireNonNull(attachEncounterUseCase, "attachEncounterUseCase");
        this.removeEncounterUseCase = Objects.requireNonNull(removeEncounterUseCase, "removeEncounterUseCase");
        this.moveEncounterUpUseCase = Objects.requireNonNull(moveEncounterUpUseCase, "moveEncounterUpUseCase");
        this.moveEncounterDownUseCase = Objects.requireNonNull(moveEncounterDownUseCase, "moveEncounterDownUseCase");
        this.setEncounterAllocationUseCase = Objects.requireNonNull(setEncounterAllocationUseCase, "setEncounterAllocationUseCase");
        this.selectEncounterUseCase = Objects.requireNonNull(selectEncounterUseCase, "selectEncounterUseCase");
        this.setRestGapUseCase = Objects.requireNonNull(setRestGapUseCase, "setRestGapUseCase");
        this.clearRestGapUseCase = Objects.requireNonNull(clearRestGapUseCase, "clearRestGapUseCase");
        this.addLootPlaceholderUseCase = Objects.requireNonNull(addLootPlaceholderUseCase, "addLootPlaceholderUseCase");
        this.removeLootPlaceholderUseCase = Objects.requireNonNull(removeLootPlaceholderUseCase, "removeLootPlaceholderUseCase");
    }

    public void createSession(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, "command");
        createSessionUseCase.execute();
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        SessionPlannerParticipantCommand effective = Objects.requireNonNull(command, "command");
        addParticipantUseCase.execute(effective.characterId());
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        SessionPlannerParticipantCommand effective = Objects.requireNonNull(command, "command");
        removeParticipantUseCase.execute(effective.characterId());
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = Objects.requireNonNull(command, "command");
        setEncounterDaysUseCase.execute(effective.encounterDays());
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = Objects.requireNonNull(command, "command");
        attachEncounterUseCase.execute(effective.encounterPlanId());
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        removeEncounterUseCase.execute(effective.encounterId());
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterUpUseCase.execute(effective.encounterId());
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterDownUseCase.execute(effective.encounterId());
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        selectEncounterUseCase.execute(effective.encounterId());
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        SessionPlannerEncounterAllocationCommand effective = Objects.requireNonNull(command, "command");
        setEncounterAllocationUseCase.execute(
                effective.encounterId(),
                effective.budgetPercentage());
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        setRestGapUseCase.execute(effective.leftEncounterId(), effective.rightEncounterId(), effective.restKind().name());
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        clearRestGapUseCase.execute(
                effective.leftEncounterId(),
                effective.rightEncounterId());
    }

    public void addLootPlaceholder(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, "command");
        addLootPlaceholderUseCase.execute();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = Objects.requireNonNull(command, "command");
        removeLootPlaceholderUseCase.execute(effective.lootId());
    }
}
