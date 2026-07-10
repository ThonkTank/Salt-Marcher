package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
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

    private final Consumer<ApplyEncounterStateCommand> applyStateAction;
    private final Consumer<UpdateEncounterBuilderInputsCommand> updateBuilderInputsAction;
    private final Consumer<RefreshEncounterPlanBudgetCommand> refreshPlanBudgetAction;

    public EncounterApplicationService(
            ApplyEncounterStateUseCase applyStateUseCase,
            UpdateEncounterBuilderInputsUseCase updateBuilderInputsUseCase,
            PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase
    ) {
        this(
                applyStateAction(applyStateUseCase),
                updateBuilderInputsAction(updateBuilderInputsUseCase),
                refreshPlanBudgetAction(publishPlanBudgetUseCase));
    }

    EncounterApplicationService(
            Consumer<ApplyEncounterStateCommand> applyStateAction,
            Consumer<UpdateEncounterBuilderInputsCommand> updateBuilderInputsAction,
            Consumer<RefreshEncounterPlanBudgetCommand> refreshPlanBudgetAction
    ) {
        this.applyStateAction = Objects.requireNonNull(applyStateAction, "applyStateAction");
        this.updateBuilderInputsAction = Objects.requireNonNull(updateBuilderInputsAction, "updateBuilderInputsAction");
        this.refreshPlanBudgetAction = Objects.requireNonNull(refreshPlanBudgetAction, "refreshPlanBudgetAction");
    }

    public void applyState(ApplyEncounterStateCommand command) {
        applyStateAction.accept(command);
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        updateBuilderInputsAction.accept(command);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        refreshPlanBudgetAction.accept(command);
    }

    private static Consumer<ApplyEncounterStateCommand> applyStateAction(
            ApplyEncounterStateUseCase applyStateUseCase
    ) {
        ApplyEncounterStateUseCase safeApplyStateUseCase =
                Objects.requireNonNull(applyStateUseCase, "applyStateUseCase");
        return command -> safeApplyStateUseCase.execute(toApplyStateRequest(command));
    }

    private static Consumer<UpdateEncounterBuilderInputsCommand> updateBuilderInputsAction(
            UpdateEncounterBuilderInputsUseCase updateBuilderInputsUseCase
    ) {
        UpdateEncounterBuilderInputsUseCase safeUpdateBuilderInputsUseCase =
                Objects.requireNonNull(updateBuilderInputsUseCase, "updateBuilderInputsUseCase");
        return command -> safeUpdateBuilderInputsUseCase.execute(toBuilderInputsRequest(command));
    }

    private static Consumer<RefreshEncounterPlanBudgetCommand> refreshPlanBudgetAction(
            PublishEncounterPlanBudgetUseCase publishPlanBudgetUseCase
    ) {
        PublishEncounterPlanBudgetUseCase safePublishPlanBudgetUseCase =
                Objects.requireNonNull(publishPlanBudgetUseCase, "publishPlanBudgetUseCase");
        return command -> safePublishPlanBudgetUseCase.execute(command == null ? 0L : command.planId());
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
                command.actionCode(),
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
