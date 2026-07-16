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
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encounter.published.EncounterRuntimeContextApi;
import src.domain.encounter.model.session.EncounterSessionMemento;
import src.domain.encounter.model.session.SceneNpcData;
import src.domain.encounter.model.session.repository.EncounterRuntimeStateRepository;

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

    EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            EncounterRuntimeStateRepository runtimeStates
    ) {
        this(RuntimeCommandActions.create(runtimeAccess, plans, publishedState, runtimeStates));
    }

    EncounterApplicationService(CommandActions commands) {
        this.commands = Objects.requireNonNull(commands, "commands");
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

    public EncounterRuntimeContextApi runtimeContexts() {
        if (commands instanceof EncounterRuntimeContextApi api) {
            return api;
        }
        return command -> new EncounterRuntimeContextApi.SyncResult(false, "Encounter-Kontexte sind nicht verfügbar.");
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

    private static final class RuntimeCommandActions implements CommandActions, EncounterRuntimeContextApi {

        private final EncounterSessionRuntimeAccess runtimeAccess;
        private final EncounterPlanGateway plans;
        private final EncounterPublishedState publishedState;
        private final EncounterRuntimeStateRepository runtimeStates;
        private final Map<String, EncounterSessionMemento> restoredStates;
        private final Map<String, ContextRuntime> contexts = new java.util.LinkedHashMap<>();
        private String focusedContextKey = "legacy";

        private RuntimeCommandActions(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState,
                EncounterRuntimeStateRepository runtimeStates
        ) {
            this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
            this.plans = Objects.requireNonNull(plans, "plans");
            this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
            this.runtimeStates = Objects.requireNonNull(runtimeStates, "runtimeStates");
            this.restoredStates = new java.util.LinkedHashMap<>(runtimeStates.loadAll());
        }

        private static RuntimeCommandActions create(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState,
                EncounterRuntimeStateRepository runtimeStates
        ) {
            RuntimeCommandActions actions = new RuntimeCommandActions(runtimeAccess, plans, publishedState, runtimeStates);
            actions.initialize();
            return actions;
        }

        private void initialize() {
            ContextRuntime legacy = new ContextRuntime(new EncounterSession(), runtimeAccess, List.of(), false);
            legacy.session.apply(EncounterSessionCommand.refresh(), legacy.access);
            contexts.put(focusedContextKey, legacy);
            publishCurrentSession();
            publishSavedPlans();
            publishPlanBudget(0L);
        }

        @Override
        public void applyState(ApplyEncounterStateCommand command) {
            EncounterSessionCommand effective = toSessionCommand(command);
            ContextRuntime current = current();
            current.session.apply(effective, current.access);
            current.reconcileSceneNpcs();
            persist();
            publishCurrentSession();
            if (effective.action().republishesSavedPlans()) {
                publishSavedPlans();
            }
        }

        @Override
        public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
            ContextRuntime current = current();
            current.session.apply(EncounterSessionCommand.updateBuilderInputs(toGenerationInputs(command)), current.access);
            current.reconcileSceneNpcs();
            persist();
            publishCurrentSession();
        }

        @Override
        public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
            publishPlanBudget(command == null ? 0L : command.planId());
        }

        private void publishCurrentSession() {
            publishedState.publishCurrentSession(current().session, plans);
        }

        private void publishSavedPlans() {
            publishedState.publishSavedPlans(plans.listPlans());
        }

        private void publishPlanBudget(long planId) {
            publishedState.publishPlanBudget(plans.loadPlanBudgetForPublication(planId));
        }

        @Override
        public SyncResult synchronize(SynchronizeEncounterContextsCommand command) {
            if (command == null || command.contexts().isEmpty()) {
                return new SyncResult(false, "Mindestens ein Encounter-Kontext ist erforderlich.");
            }
            try {
                java.util.Set<String> retained = new java.util.LinkedHashSet<>();
                for (Context context : command.contexts()) {
                    if (context.key().isBlank()) {
                        continue;
                    }
                    retained.add(context.key());
                    ContextRuntime runtime = contexts.get(context.key());
                    EncounterSessionRuntimeAccess scoped = runtimeAccess.scoped(
                            context.partyMemberIds(), context.worldLocationId());
                    if (runtime == null) {
                        runtime = new ContextRuntime(new EncounterSession(), scoped, sceneNpcs(context), true);
                        EncounterSessionMemento restored = restoredStates.remove(context.key());
                        if (restored == null) {
                            runtime.session.apply(EncounterSessionCommand.refresh(), scoped);
                            if (context.initialEncounterPlanId() > 0L) {
                                runtime.session.apply(toSessionCommand(
                                        ApplyEncounterStateCommand.openSavedPlan(context.initialEncounterPlanId())), scoped);
                            }
                        } else {
                            runtime.session.restore(restored, scoped);
                            runtime.session.reconcileParty(scoped);
                        }
                        contexts.put(context.key(), runtime);
                    } else {
                        runtime.access = scoped;
                        runtime.sceneNpcs = sceneNpcs(context);
                        runtime.session.reconcileParty(scoped);
                    }
                    runtime.reconcileSceneNpcs();
                }
                contexts.keySet().removeIf(key -> !retained.contains(key));
                if (!contexts.containsKey(command.focusedContextKey())) {
                    return new SyncResult(false, "Fokussierter Encounter-Kontext fehlt.");
                }
                focusedContextKey = command.focusedContextKey();
                persist();
                publishCurrentSession();
                return new SyncResult(true, "Encounter-Kontexte synchronisiert.");
            } catch (IllegalStateException exception) {
                return new SyncResult(false, "Encounter-Kontexte konnten nicht synchronisiert werden.");
            }
        }

        private ContextRuntime current() {
            ContextRuntime runtime = contexts.get(focusedContextKey);
            if (runtime == null) {
                throw new IllegalStateException("Focused encounter context is missing.");
            }
            return runtime;
        }

        private static List<SceneNpcData> sceneNpcs(Context context) {
            return context.npcs().stream()
                    .map(npc -> new SceneNpcData(
                            npc.worldNpcId(), npc.creatureId(),
                            SceneNpcData.Role.valueOf(npc.role().name()), npc.active()))
                    .toList();
        }

        private void persist() {
            Map<String, EncounterSessionMemento> snapshots = new java.util.LinkedHashMap<>();
            for (Map.Entry<String, ContextRuntime> entry : contexts.entrySet()) {
                if (!"legacy".equals(entry.getKey())) {
                    snapshots.put(entry.getKey(), entry.getValue().session.memento());
                }
            }
            runtimeStates.saveAll(snapshots);
        }

        private static final class ContextRuntime {
            private final EncounterSession session;
            private EncounterSessionRuntimeAccess access;
            private List<SceneNpcData> sceneNpcs;
            private final boolean sceneManaged;

            private ContextRuntime(
                    EncounterSession session,
                    EncounterSessionRuntimeAccess access,
                    List<SceneNpcData> sceneNpcs,
                    boolean sceneManaged
            ) {
                this.session = session;
                this.access = access;
                this.sceneNpcs = List.copyOf(sceneNpcs);
                this.sceneManaged = sceneManaged;
            }

            private void reconcileSceneNpcs() {
                if (sceneManaged) {
                    session.reconcileSceneNpcs(sceneNpcs, access);
                }
            }
        }
    }

}
