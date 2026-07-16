package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterCreatureFilters;
import src.domain.encounter.model.generation.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.session.CombatantId;
import src.domain.encounter.model.session.EncounterInitiativeInput;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionCommand;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.GeneratedEncounterImportResult;
import src.domain.encounter.published.ImportGeneratedEncounterPlansCommand;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;

/**
 * Public encounter command boundary below the view layer.
 */
public final class EncounterApplicationService {

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
    private final GeneratedEncounterPlanImporter generatedPlanImporter;

    EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            GeneratedEncounterPlanImporter generatedPlanImporter
    ) {
        commands = RuntimeCommandActions.create(runtimeAccess, plans, publishedState);
        this.generatedPlanImporter = Objects.requireNonNull(generatedPlanImporter, "generatedPlanImporter");
    }

    EncounterApplicationService(CommandActions commands) {
        this.commands = Objects.requireNonNull(commands, "commands");
        generatedPlanImporter = null;
    }

    public void applyState(ApplyEncounterStateCommand command) {
        commands.applyState(command);
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        commands.updateBuilderInputs(command);
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        commands.refreshPlanBudget(command);
    }

    public GeneratedEncounterImportResult importGeneratedPlans(ImportGeneratedEncounterPlansCommand command) {
        return generatedPlanImporter == null
                ? GeneratedEncounterImportResult.unavailable("Generated encounter import is not registered.")
                : generatedPlanImporter.importPlans(command);
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
        EncounterCreatureFilters filters = EncounterCreatureFilters.from(effective);
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
            RuntimeCommandActions actions = new RuntimeCommandActions(runtimeAccess, plans, publishedState);
            actions.initialize();
            return actions;
        }

        private void initialize() {
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
