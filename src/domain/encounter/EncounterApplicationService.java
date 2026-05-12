package src.domain.encounter;

import java.util.Objects;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.application.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.application.UpdateEncounterBuilderInputsUseCase;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;

/**
 * Public encounter command boundary below the view layer.
 */
public final class EncounterApplicationService {

    private final ApplyEncounterStateUseCase applyStateUseCase;
    private final UpdateEncounterBuilderInputsUseCase updateBuilderInputsUseCase;
    private final PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase;

    EncounterApplicationService(
            ApplyEncounterStateUseCase applyStateUseCase,
            UpdateEncounterBuilderInputsUseCase updateBuilderInputsUseCase,
            PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase
    ) {
        this.applyStateUseCase = Objects.requireNonNull(applyStateUseCase, "applyStateUseCase");
        this.updateBuilderInputsUseCase = Objects.requireNonNull(updateBuilderInputsUseCase, "updateBuilderInputsUseCase");
        this.publishPlanBudgetUseCase = Objects.requireNonNull(publishPlanBudgetUseCase, "publishPlanBudgetUseCase");
    }

    public void applyState(ApplyEncounterStateCommand command) {
        applyStateUseCase.execute(command);
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        updateBuilderInputsUseCase.execute(command);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudgetUseCase.execute(command == null ? 0L : command.planId());
    }
}
