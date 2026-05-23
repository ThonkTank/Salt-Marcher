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
        applyStateUseCase.execute(toStateArguments(command));
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        updateBuilderInputsUseCase.execute(toBuilderArguments(command));
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        publishPlanBudgetUseCase.execute(command == null ? 0L : command.planId());
    }

    private static Object[] toStateArguments(ApplyEncounterStateCommand command) {
        if (command == null) {
            return defaultStateArguments();
        }
        long[] stateIds = new long[] {
                command.creatureId(),
                command.planId(),
                command.undoToken(),
                command.partyMemberId()
        };
        int[] stateValues = new int[] {
                command.delta(),
                command.initiative(),
                command.amount()
        };
        List<String> initiativeIds = new ArrayList<>();
        List<Integer> initiatives = new ArrayList<>();
        int initiativeValueCount = command.initiativeValues().size();
        for (int index = 0; index < initiativeValueCount; index++) {
            initiativeIds.add(command.initiativeValues().get(index).id());
            initiatives.add(command.initiativeValues().get(index).initiative());
        }
        return new Object[] {
                command.action().name(),
                stateIds,
                stateValues,
                initiativeIds,
                initiatives,
                command.combatantId(),
                command.healing()
        };
    }

    private static Object[] toBuilderArguments(UpdateEncounterBuilderInputsCommand command) {
        if (command == null) {
            return defaultBuilderArguments();
        }
        boolean[] autoFlags = new boolean[] {
                command.inputs().autoDifficulty(),
                command.inputs().autoBalance(),
                command.inputs().autoAmount(),
                command.inputs().autoDiversity()
        };
        int[] tuningLevels = new int[] {
                command.inputs().difficultyLevel(),
                command.inputs().balanceLevel(),
                command.inputs().diversityLevel()
        };
        return new Object[] {
                command.inputs().creatureTypes(),
                command.inputs().creatureSubtypes(),
                command.inputs().biomes(),
                autoFlags,
                tuningLevels,
                command.inputs().amountValue(),
                command.inputs().encounterTableIds()
        };
    }

    private static Object[] defaultStateArguments() {
        return new Object[] {
                null,
                new long[] {0L, 0L, 0L, 0L},
                new int[] {0, 0, 0},
                List.of(),
                List.of(),
                "",
                false
        };
    }

    private static Object[] defaultBuilderArguments() {
        return new Object[] {
                null,
                null,
                null,
                new boolean[] {false, false, false, false},
                new int[] {0, 0, 0},
                0.0,
                null
        };
    }
}
