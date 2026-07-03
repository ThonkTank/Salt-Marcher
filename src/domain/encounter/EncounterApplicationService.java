package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.model.plan.usecase.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.model.session.usecase.UpdateEncounterBuilderInputsUseCase;
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

    public EncounterApplicationService(
            ApplyEncounterStateUseCase applyStateUseCase,
            UpdateEncounterBuilderInputsUseCase updateBuilderInputsUseCase,
            PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase
    ) {
        this.applyStateUseCase = Objects.requireNonNull(applyStateUseCase, "applyStateUseCase");
        this.updateBuilderInputsUseCase = Objects.requireNonNull(updateBuilderInputsUseCase, "updateBuilderInputsUseCase");
        this.publishPlanBudgetUseCase = Objects.requireNonNull(publishPlanBudgetUseCase, "publishPlanBudgetUseCase");
    }

    public void applyState(ApplyEncounterStateCommand command) {
        applyStateUseCase.execute(toApplyStateRequest(command));
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        updateBuilderInputsUseCase.execute(toBuilderInputsRequest(command));
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudgetUseCase.execute(command == null ? 0L : command.planId());
    }

    private static ApplyEncounterStateUseCase.Request toApplyStateRequest(ApplyEncounterStateCommand command) {
        if (command == null) {
            return ApplyEncounterStateUseCase.Request.refresh();
        }
        List<ApplyEncounterStateUseCase.InitiativeInput> initiativeInputs = new ArrayList<>();
        List<String> initiativeIds = command.initiativeIds();
        List<Integer> initiativeScores = command.initiativeScores();
        int count = Math.min(initiativeIds.size(), initiativeScores.size());
        for (int index = 0; index < count; index++) {
            initiativeInputs.add(new ApplyEncounterStateUseCase.InitiativeInput(
                    initiativeIds.get(index),
                    initiativeScores.get(index).intValue()));
        }
        return new ApplyEncounterStateUseCase.Request(
                command.action().name(),
                command.creatureId(),
                command.planId(),
                command.worldNpcId(),
                command.delta(),
                command.undoToken(),
                initiativeInputs,
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static UpdateEncounterBuilderInputsUseCase.Request toBuilderInputsRequest(
            UpdateEncounterBuilderInputsCommand command
    ) {
        if (command == null) {
            return UpdateEncounterBuilderInputsUseCase.Request.empty();
        }
        return new UpdateEncounterBuilderInputsUseCase.Request(
                command.creatureTypes(),
                command.creatureSubtypes(),
                command.biomes(),
                command.autoDifficulty(),
                command.difficultyLevel(),
                command.autoBalance(),
                command.balanceLevel(),
                command.autoAmount(),
                command.amountValue(),
                command.autoDiversity(),
                command.diversityLevel(),
                command.encounterTableIds(),
                command.worldFactionIds(),
                command.worldLocationId());
    }

}
