package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;

@SuppressWarnings("DomainApplicationServiceRoleBoundary")
public final class SessionPlannerEncounterApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final SetSessionEncounterDaysUseCase setEncounterDaysUseCase;
    private final AttachSessionEncounterUseCase attachEncounterUseCase;
    private final RemoveSessionEncounterUseCase removeEncounterUseCase;
    private final MoveSessionEncounterUpUseCase moveEncounterUpUseCase;
    private final MoveSessionEncounterDownUseCase moveEncounterDownUseCase;
    private final SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase;
    private final SelectSessionEncounterUseCase selectEncounterUseCase;

    public SessionPlannerEncounterApplicationService(
            SetSessionEncounterDaysUseCase setEncounterDaysUseCase,
            AttachSessionEncounterUseCase attachEncounterUseCase,
            RemoveSessionEncounterUseCase removeEncounterUseCase,
            MoveSessionEncounterUpUseCase moveEncounterUpUseCase,
            MoveSessionEncounterDownUseCase moveEncounterDownUseCase,
            SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase,
            SelectSessionEncounterUseCase selectEncounterUseCase
    ) {
        this.setEncounterDaysUseCase = Objects.requireNonNull(setEncounterDaysUseCase, "setEncounterDaysUseCase");
        this.attachEncounterUseCase = Objects.requireNonNull(attachEncounterUseCase, "attachEncounterUseCase");
        this.removeEncounterUseCase = Objects.requireNonNull(removeEncounterUseCase, "removeEncounterUseCase");
        this.moveEncounterUpUseCase = Objects.requireNonNull(moveEncounterUpUseCase, "moveEncounterUpUseCase");
        this.moveEncounterDownUseCase = Objects.requireNonNull(moveEncounterDownUseCase, "moveEncounterDownUseCase");
        this.setEncounterAllocationUseCase = Objects.requireNonNull(
                setEncounterAllocationUseCase,
                "setEncounterAllocationUseCase");
        this.selectEncounterUseCase = Objects.requireNonNull(selectEncounterUseCase, "selectEncounterUseCase");
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        setEncounterDaysUseCase.execute(command.encounterDays());
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        attachEncounterUseCase.execute(command.encounterPlanId());
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        removeEncounterUseCase.execute(command.encounterId());
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        moveEncounterUpUseCase.execute(command.encounterId());
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        moveEncounterDownUseCase.execute(command.encounterId());
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        selectEncounterUseCase.execute(command.encounterId());
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        setEncounterAllocationUseCase.execute(
                command.encounterId(),
                command.budgetPercentage());
    }
}
