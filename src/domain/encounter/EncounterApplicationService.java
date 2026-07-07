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

    private static final int REFRESH_ACTION_CODE = 1;
    private static final int GENERATE_ACTION_CODE = 2;
    private static final int SAVE_CURRENT_PLAN_ACTION_CODE = 3;
    private static final int OPEN_SAVED_PLAN_ACTION_CODE = 4;
    private static final int CLEAR_GENERATION_HISTORY_ACTION_CODE = 5;
    private static final int SHIFT_ALTERNATIVE_ACTION_CODE = 6;
    private static final int ADD_CREATURE_ACTION_CODE = 7;
    private static final int INCREMENT_CREATURE_ACTION_CODE = 8;
    private static final int DECREMENT_CREATURE_ACTION_CODE = 9;
    private static final int REMOVE_CREATURE_ACTION_CODE = 10;
    private static final int UNDO_REMOVE_ACTION_CODE = 11;
    private static final int OPEN_INITIATIVE_ACTION_CODE = 12;
    private static final int BACK_TO_BUILDER_ACTION_CODE = 13;
    private static final int CONFIRM_INITIATIVE_ACTION_CODE = 14;
    private static final int ADVANCE_TURN_ACTION_CODE = 15;
    private static final int ADJUST_INITIATIVE_ACTION_CODE = 16;
    private static final int ADD_PARTY_MEMBER_TO_COMBAT_ACTION_CODE = 17;
    private static final int END_COMBAT_ACTION_CODE = 18;
    private static final int AWARD_XP_ACTION_CODE = 19;
    private static final int RETURN_TO_BUILDER_AFTER_RESULTS_ACTION_CODE = 20;
    private static final int MUTATE_HP_ACTION_CODE = 21;

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
        ApplyEncounterStateUseCase.Action action = switch (command.actionCode()) {
            case REFRESH_ACTION_CODE -> ApplyEncounterStateUseCase.Action.REFRESH;
            case GENERATE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.GENERATE;
            case SAVE_CURRENT_PLAN_ACTION_CODE -> ApplyEncounterStateUseCase.Action.SAVE_CURRENT_PLAN;
            case OPEN_SAVED_PLAN_ACTION_CODE -> ApplyEncounterStateUseCase.Action.OPEN_SAVED_PLAN;
            case CLEAR_GENERATION_HISTORY_ACTION_CODE ->
                    ApplyEncounterStateUseCase.Action.CLEAR_GENERATION_HISTORY;
            case SHIFT_ALTERNATIVE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.SHIFT_ALTERNATIVE;
            case ADD_CREATURE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.ADD_CREATURE;
            case INCREMENT_CREATURE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.INCREMENT_CREATURE;
            case DECREMENT_CREATURE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.DECREMENT_CREATURE;
            case REMOVE_CREATURE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.REMOVE_CREATURE;
            case UNDO_REMOVE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.UNDO_REMOVE;
            case OPEN_INITIATIVE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.OPEN_INITIATIVE;
            case BACK_TO_BUILDER_ACTION_CODE -> ApplyEncounterStateUseCase.Action.BACK_TO_BUILDER;
            case CONFIRM_INITIATIVE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.CONFIRM_INITIATIVE;
            case ADVANCE_TURN_ACTION_CODE -> ApplyEncounterStateUseCase.Action.ADVANCE_TURN;
            case ADJUST_INITIATIVE_ACTION_CODE -> ApplyEncounterStateUseCase.Action.ADJUST_INITIATIVE;
            case ADD_PARTY_MEMBER_TO_COMBAT_ACTION_CODE ->
                    ApplyEncounterStateUseCase.Action.ADD_PARTY_MEMBER_TO_COMBAT;
            case END_COMBAT_ACTION_CODE -> ApplyEncounterStateUseCase.Action.END_COMBAT;
            case AWARD_XP_ACTION_CODE -> ApplyEncounterStateUseCase.Action.AWARD_XP;
            case RETURN_TO_BUILDER_AFTER_RESULTS_ACTION_CODE ->
                    ApplyEncounterStateUseCase.Action.RETURN_TO_BUILDER_AFTER_RESULTS;
            case MUTATE_HP_ACTION_CODE -> ApplyEncounterStateUseCase.Action.MUTATE_HP;
            default -> throw new IllegalArgumentException("Unknown encounter state action code.");
        };
        return new ApplyEncounterStateUseCase.Request(
                action,
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
