package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AddSessionSceneUseCase;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.model.session.usecase.UpdateSessionEncounterSceneUseCase;
import src.domain.sessionplanner.published.AddSessionSceneCommand;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.UpdateSessionEncounterSceneCommand;

public final class SessionPlannerEncounterApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final SetSessionEncounterDaysUseCase setEncounterDaysUseCase;
    private final AddSessionSceneUseCase addSceneUseCase;
    private final AttachSessionEncounterUseCase attachEncounterUseCase;
    private final RemoveSessionEncounterUseCase removeEncounterUseCase;
    private final MoveSessionEncounterUpUseCase moveEncounterUpUseCase;
    private final MoveSessionEncounterDownUseCase moveEncounterDownUseCase;
    private final SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase;
    private final SelectSessionEncounterUseCase selectEncounterUseCase;
    private final UpdateSessionEncounterSceneUseCase updateEncounterSceneUseCase;

    public SessionPlannerEncounterApplicationService(
            SetSessionEncounterDaysUseCase setEncounterDaysUseCase,
            AddSessionSceneUseCase addSceneUseCase,
            AttachSessionEncounterUseCase attachEncounterUseCase,
            RemoveSessionEncounterUseCase removeEncounterUseCase,
            MoveSessionEncounterUpUseCase moveEncounterUpUseCase,
            MoveSessionEncounterDownUseCase moveEncounterDownUseCase,
            SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase,
            SelectSessionEncounterUseCase selectEncounterUseCase,
            UpdateSessionEncounterSceneUseCase updateEncounterSceneUseCase
    ) {
        this.setEncounterDaysUseCase = Objects.requireNonNull(setEncounterDaysUseCase, "setEncounterDaysUseCase");
        this.addSceneUseCase = Objects.requireNonNull(addSceneUseCase, "addSceneUseCase");
        this.attachEncounterUseCase = Objects.requireNonNull(attachEncounterUseCase, "attachEncounterUseCase");
        this.removeEncounterUseCase = Objects.requireNonNull(removeEncounterUseCase, "removeEncounterUseCase");
        this.moveEncounterUpUseCase = Objects.requireNonNull(moveEncounterUpUseCase, "moveEncounterUpUseCase");
        this.moveEncounterDownUseCase = Objects.requireNonNull(moveEncounterDownUseCase, "moveEncounterDownUseCase");
        this.setEncounterAllocationUseCase = Objects.requireNonNull(
                setEncounterAllocationUseCase,
                "setEncounterAllocationUseCase");
        this.selectEncounterUseCase = Objects.requireNonNull(selectEncounterUseCase, "selectEncounterUseCase");
        this.updateEncounterSceneUseCase = Objects.requireNonNull(
                updateEncounterSceneUseCase,
                "updateEncounterSceneUseCase");
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        setEncounterDaysUseCase.execute(command.encounterDays());
    }

    public void addScene(AddSessionSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        addSceneUseCase.execute();
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

    public void updateEncounterScene(UpdateSessionEncounterSceneCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        updateEncounterSceneUseCase.execute(
                command.encounterId(),
                command.sceneTitle(),
                command.sceneNotes(),
                command.locationId());
    }
}
