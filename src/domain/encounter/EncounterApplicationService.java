package src.domain.encounter;

import java.util.Objects;
import src.domain.encounter.application.ApplyEncounterStateUseCase;
import src.domain.encounter.application.PublishEncounterPlanBudgetUseCase;
import src.domain.encounter.application.UpdateEncounterBuilderInputsUseCase;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;
import src.domain.encounter.model.session.model.EncounterInitiativeInput;
import src.domain.encounter.model.session.model.EncounterSessionCommand;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
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
        applyStateUseCase.execute(toInternalCommand(command));
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        updateBuilderInputsUseCase.execute(toInternal(command == null ? null : command.inputs()));
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudgetUseCase.execute(command == null ? 0L : command.planId());
    }

    private static EncounterSessionCommand toInternalCommand(ApplyEncounterStateCommand command) {
        if (command == null) {
            return EncounterSessionCommand.refresh();
        }
        return new EncounterSessionCommand(
                toInternalAction(command.action()),
                java.util.Optional.empty(),
                EncounterGenerationInputs.empty(),
                command.creatureId(),
                command.planId(),
                command.delta(),
                command.undoToken(),
                command.initiativeValues().stream()
                        .map(input -> new EncounterInitiativeInput(input.id(), input.initiative()))
                        .toList(),
                command.combatantId(),
                command.initiative(),
                command.partyMemberId(),
                command.amount(),
                command.healing());
    }

    private static EncounterSessionCommand.Action toInternalAction(ApplyEncounterStateCommand.Action action) {
        ApplyEncounterStateCommand.Action effective = action == null
                ? ApplyEncounterStateCommand.Action.REFRESH
                : action;
        return EncounterSessionCommand.Action.valueOf(effective.name());
    }

    private static EncounterGenerationInputs toInternal(EncounterBuilderInputs inputs) {
        EncounterBuilderInputs safeInputs = inputs == null ? EncounterBuilderInputs.empty() : inputs;
        return new EncounterGenerationInputs(
                safeInputs.creatureTypes(),
                safeInputs.creatureSubtypes(),
                safeInputs.biomes(),
                EncounterRequestedDifficulty.fromPublishedDifficulty(
                        safeInputs.autoDifficulty(),
                        safeInputs.difficultyLevel()),
                EncounterTuningIntent.fromPublishedValues(
                        safeInputs.autoBalance(),
                        safeInputs.balanceLevel(),
                        safeInputs.autoAmount(),
                        safeInputs.amountValue(),
                        safeInputs.autoDiversity(),
                        safeInputs.diversityLevel()),
                safeInputs.encounterTableIds());
    }
}
