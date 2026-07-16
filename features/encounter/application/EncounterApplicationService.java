package features.encounter.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import features.encounter.domain.generation.EncounterGenerationInputs;
import features.encounter.domain.generation.EncounterCreatureFilters;
import features.encounter.domain.generation.EncounterRequestedDifficulty;
import features.encounter.domain.generation.EncounterTuningIntent;
import features.encounter.domain.session.CombatantId;
import features.encounter.domain.session.EncounterInitiativeInput;
import features.encounter.domain.session.EncounterSession;
import features.encounter.domain.session.EncounterSessionCommand;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;

/**
 * Public encounter command boundary below the view layer.
 */
public final class EncounterApplicationService implements features.encounter.api.EncounterApi {

    private static final int REFRESH_ACTION_CODE = 1;
    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 3;
    private static final Map<Integer, EncounterSessionCommand.Action> SESSION_ACTIONS_BY_CODE = Map.ofEntries(
            Map.entry(Integer.valueOf(REFRESH_ACTION_CODE), EncounterSessionCommand.Action.REFRESH),
            Map.entry(Integer.valueOf(2), EncounterSessionCommand.Action.GENERATE),
            Map.entry(Integer.valueOf(3), EncounterSessionCommand.Action.SAVE_CURRENT_PLAN),
            Map.entry(Integer.valueOf(4), EncounterSessionCommand.Action.OPEN_SAVED_PLAN),
            Map.entry(Integer.valueOf(5), EncounterSessionCommand.Action.CLEAR_GENERATION_HISTORY),
            Map.entry(Integer.valueOf(6), EncounterSessionCommand.Action.SHIFT_ALTERNATIVE),
            Map.entry(Integer.valueOf(7), EncounterSessionCommand.Action.ADD_CREATURE),
            Map.entry(Integer.valueOf(8), EncounterSessionCommand.Action.INCREMENT_CREATURE),
            Map.entry(Integer.valueOf(9), EncounterSessionCommand.Action.DECREMENT_CREATURE),
            Map.entry(Integer.valueOf(10), EncounterSessionCommand.Action.REMOVE_CREATURE),
            Map.entry(Integer.valueOf(11), EncounterSessionCommand.Action.UNDO_REMOVE),
            Map.entry(Integer.valueOf(12), EncounterSessionCommand.Action.OPEN_INITIATIVE),
            Map.entry(Integer.valueOf(13), EncounterSessionCommand.Action.BACK_TO_BUILDER),
            Map.entry(Integer.valueOf(14), EncounterSessionCommand.Action.CONFIRM_INITIATIVE),
            Map.entry(Integer.valueOf(15), EncounterSessionCommand.Action.ADVANCE_TURN),
            Map.entry(Integer.valueOf(16), EncounterSessionCommand.Action.ADJUST_INITIATIVE),
            Map.entry(Integer.valueOf(17), EncounterSessionCommand.Action.ADD_PARTY_MEMBER_TO_COMBAT),
            Map.entry(Integer.valueOf(18), EncounterSessionCommand.Action.END_COMBAT),
            Map.entry(Integer.valueOf(19), EncounterSessionCommand.Action.AWARD_XP),
            Map.entry(Integer.valueOf(20), EncounterSessionCommand.Action.RETURN_TO_BUILDER_AFTER_RESULTS),
            Map.entry(Integer.valueOf(21), EncounterSessionCommand.Action.MUTATE_HP));

    private final CommandActions commands;
    private final ExecutionLane executionLane;

    public EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            ExecutionLane executionLane
    ) {
        this(RuntimeCommandActions.create(runtimeAccess, plans, publishedState), executionLane);
    }

    EncounterApplicationService(CommandActions commands) {
        this(commands, DirectExecutionLane.INSTANCE);
    }

    EncounterApplicationService(CommandActions commands, ExecutionLane executionLane) {
        this.commands = Objects.requireNonNull(commands, "commands");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.executionLane.execute(commands::initialize);
    }

    public void applyState(ApplyEncounterStateCommand command) {
        executionLane.execute(() -> commands.applyState(command));
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        executionLane.execute(() -> commands.updateBuilderInputs(command));
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        executionLane.execute(() -> commands.refreshPlanBudget(command));
    }

    private static EncounterSessionCommand toSessionCommand(ApplyEncounterStateCommand command) {
        ApplyEncounterStateCommand effective = command == null
                ? ApplyEncounterStateCommand.action(ApplyEncounterStateCommand.Action.REFRESH)
                : command;
        return new EncounterSessionCommand(
                toSessionAction(effective.actionCode()),
                java.util.Optional.empty(),
                EncounterGenerationInputs.empty(),
                effective.creatureId(),
                effective.planId(),
                effective.worldNpcId(),
                effective.delta(),
                effective.undoToken(),
                initiativeInputs(effective),
                CombatantId.from(effective.combatantId()),
                effective.initiative(),
                effective.partyMemberId(),
                effective.amount(),
                effective.healing());
    }

    private static EncounterSessionCommand.Action toSessionAction(int actionCode) {
        EncounterSessionCommand.Action action = SESSION_ACTIONS_BY_CODE.get(Integer.valueOf(actionCode));
        if (action == null) {
            throw new IllegalArgumentException("Unknown encounter state action code.");
        }
        return action;
    }

    private static List<EncounterInitiativeInput> initiativeInputs(ApplyEncounterStateCommand command) {
        List<EncounterInitiativeInput> inputs = new ArrayList<>();
        List<String> initiativeIds = command.initiativeIds();
        List<Integer> initiativeScores = command.initiativeScores();
        int count = Math.min(initiativeIds.size(), initiativeScores.size());
        for (int index = 0; index < count; index++) {
            inputs.add(new EncounterInitiativeInput(
                    initiativeIds.get(index),
                    initiativeScores.get(index).intValue()));
        }
        return List.copyOf(inputs);
    }

    private static EncounterGenerationInputs toGenerationInputs(UpdateEncounterBuilderInputsCommand command) {
        UpdateEncounterBuilderInputsCommand effective = command == null ? emptyBuilderInputsCommand() : command;
        EncounterCreatureFilters filters = new EncounterCreatureFilters(
                effective.creatureTypes(),
                effective.creatureSubtypes(),
                effective.biomes());
        return new EncounterGenerationInputs(
                filters.creatureTypes(),
                filters.creatureSubtypes(),
                filters.biomes(),
                EncounterRequestedDifficulty.fromPublishedDifficulty(
                        effective.autoDifficulty(),
                        effective.difficultyLevel()),
                EncounterTuningIntent.fromPublishedValues(
                        effective.autoBalance(),
                        effective.balanceLevel(),
                        effective.autoAmount(),
                        effective.amountValue(),
                        effective.autoDiversity(),
                        effective.diversityLevel()),
                effective.encounterTableIds(),
                effective.worldFactionIds(),
                effective.worldLocationId(),
                Map.of());
    }

    private static UpdateEncounterBuilderInputsCommand emptyBuilderInputsCommand() {
        return new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty());
    }

    interface CommandActions {

        default void initialize() {
        }

        void applyState(ApplyEncounterStateCommand command);

        void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command);

        void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command);
    }

    private static final class RuntimeCommandActions implements CommandActions {

        private final EncounterSessionRuntimeAccess runtimeAccess;
        private final EncounterPlanGateway plans;
        private final EncounterPublishedState publishedState;
        private final EncounterSession session = new EncounterSession();

        private RuntimeCommandActions(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState
        ) {
            this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
            this.plans = Objects.requireNonNull(plans, "plans");
            this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        }

        private static RuntimeCommandActions create(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState
        ) {
            return new RuntimeCommandActions(runtimeAccess, plans, publishedState);
        }

        @Override
        public void initialize() {
            session.apply(EncounterSessionCommand.refresh(), runtimeAccess);
            publishCurrentSession();
            publishSavedPlans();
            publishPlanBudget(0L);
        }

        @Override
        public void applyState(ApplyEncounterStateCommand command) {
            EncounterSessionCommand effective = toSessionCommand(command);
            session.apply(effective, runtimeAccess);
            publishCurrentSession();
            if (effective.action().republishesSavedPlans()) {
                publishSavedPlans();
            }
        }

        @Override
        public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
            session.apply(EncounterSessionCommand.updateBuilderInputs(toGenerationInputs(command)), runtimeAccess);
            publishCurrentSession();
        }

        @Override
        public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
            publishPlanBudget(command == null ? 0L : command.planId());
        }

        private void publishCurrentSession() {
            publishedState.publishCurrentSession(session, plans);
        }

        private void publishSavedPlans() {
            publishedState.publishSavedPlans(plans.listPlans());
        }

        private void publishPlanBudget(long planId) {
            publishedState.publishPlanBudget(plans.loadPlanBudgetForPublication(planId));
        }
    }

}
