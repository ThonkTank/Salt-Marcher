package features.encounter.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
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
import features.encounter.domain.session.Mode;
import features.encounter.api.ApplyEncounterStateCommand;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterPoolFilters;
import features.encounter.api.EncounterTuningSettings;
import features.encounter.api.RefreshEncounterPlanBudgetCommand;
import features.encounter.api.UpdateEncounterBuilderInputsCommand;
import features.encounter.api.UpdateEncounterPoolFiltersCommand;
import features.encounter.api.UpdateEncounterTuningCommand;
import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.api.EncounterRuntimeContextSyncResult;
import features.encounter.api.EncounterRuntimeNpcRole;
import features.encounter.api.SynchronizeEncounterRuntimeContextsCommand;
import features.encounter.api.OpenSavedEncounterPlanCommand;
import features.encounter.api.OpenSavedEncounterPlanResult;
import features.encounter.domain.session.SceneNpcData;
import features.encounter.domain.generation.EncounterGenerationRequest;
import features.encounter.domain.session.EncounterSessionMemento;

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
    private final EncounterRuntimeContextApi runtimeContexts;
    private final GeneratedEncounterBatchService generatedBatches;
    private final SavedEncounterPlanSearchService savedPlanSearch;
    private final AtomicBoolean initializationRequested = new AtomicBoolean();

    public EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            ExecutionLane executionLane
    ) {
        this(runtimeAccess, plans, publishedState, new InMemoryRuntimeContextRepository(), executionLane, null, null);
    }

    public EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            EncounterRuntimeContextRepository contextRepository,
            ExecutionLane executionLane
    ) {
        this(runtimeAccess, plans, publishedState, contextRepository, executionLane, null, null);
    }

    public EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            EncounterRuntimeContextRepository contextRepository,
            ExecutionLane executionLane,
            GeneratedEncounterBatchService generatedBatches
    ) {
        this(runtimeAccess, plans, publishedState, contextRepository, executionLane, generatedBatches, null);
    }

    public EncounterApplicationService(
            EncounterSessionRuntimeAccess runtimeAccess,
            EncounterPlanGateway plans,
            EncounterPublishedState publishedState,
            EncounterRuntimeContextRepository contextRepository,
            ExecutionLane executionLane,
            GeneratedEncounterBatchService generatedBatches,
            SavedEncounterPlanSearchService savedPlanSearch
    ) {
        this(RuntimeCommandActions.create(runtimeAccess, plans, publishedState, contextRepository),
                executionLane, generatedBatches, savedPlanSearch);
    }

    EncounterApplicationService(CommandActions commands) {
        this(commands, DirectExecutionLane.INSTANCE, null, null);
    }

    EncounterApplicationService(CommandActions commands, ExecutionLane executionLane) {
        this(commands, executionLane, null, null);
    }

    EncounterApplicationService(
            CommandActions commands,
            ExecutionLane executionLane,
            GeneratedEncounterBatchService generatedBatches
    ) {
        this(commands, executionLane, generatedBatches, null);
    }

    EncounterApplicationService(
            CommandActions commands,
            ExecutionLane executionLane,
            GeneratedEncounterBatchService generatedBatches,
            SavedEncounterPlanSearchService savedPlanSearch
    ) {
        this.commands = Objects.requireNonNull(commands, "commands");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.runtimeContexts = commands instanceof RuntimeCommandActions runtime
                ? new RuntimeContextApi(runtime, executionLane)
                : command -> CompletableFuture.completedFuture(new EncounterRuntimeContextSyncResult(
                        EncounterRuntimeContextSyncResult.Status.INVALID,
                        0L,
                        "Encounter runtime contexts are unavailable."));
        this.generatedBatches = generatedBatches;
        this.savedPlanSearch = savedPlanSearch;
    }

    public void initialize() {
        if (initializationRequested.compareAndSet(false, true)) {
            executionLane.execute(commands::initialize);
        }
    }

    @Override
    public java.util.concurrent.CompletionStage<features.encounter.api.PreparedGeneratedEncounterBatchResult>
            prepareGeneratedBatch(features.encounter.api.PrepareGeneratedEncounterBatchCommand command) {
        if (generatedBatches == null) {
            return java.util.concurrent.CompletableFuture.completedFuture(
                    features.encounter.api.PreparedGeneratedEncounterBatchResult.failure(
                            features.encounter.api.GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                            "Generated encounter preparation is unavailable."));
        }
        return generatedBatches.prepare(command);
    }

    @Override
    public java.util.concurrent.CompletionStage<features.encounter.api.CommittedGeneratedEncounterBatchResult>
            commitGeneratedBatch(features.encounter.api.CommitGeneratedEncounterBatchCommand command) {
        if (generatedBatches == null) {
            return java.util.concurrent.CompletableFuture.completedFuture(
                    features.encounter.api.CommittedGeneratedEncounterBatchResult.failure(
                            features.encounter.api.GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                            "Generated encounter commit is unavailable."));
        }
        return generatedBatches.commit(command);
    }

    @Override
    public java.util.concurrent.CompletionStage<features.encounter.api.GeneratedEncounterPlanSummaryBatchResult>
            loadGeneratedPlanSummaries(features.encounter.api.GeneratedEncounterPlanSummaryBatchQuery query) {
        if (generatedBatches == null) {
            return java.util.concurrent.CompletableFuture.completedFuture(
                    features.encounter.api.GeneratedEncounterPlanSummaryBatchResult.failure(
                            features.encounter.api.GeneratedEncounterBatchStatus.STORAGE_FAILURE,
                            "Generated encounter summaries are unavailable."));
        }
        return generatedBatches.loadSummaries(query);
    }

    @Override
    public java.util.concurrent.CompletionStage<features.encounter.api.SearchSavedEncounterPlansResult>
            searchSavedPlans(features.encounter.api.SearchSavedEncounterPlansQuery query) {
        if (savedPlanSearch == null) {
            return features.encounter.api.EncounterApi.super.searchSavedPlans(query);
        }
        return savedPlanSearch.search(query);
    }

    @Override
    public java.util.concurrent.CompletionStage<features.encounter.api.DuplicateSavedEncounterPlanResult>
            duplicateSavedPlan(features.encounter.api.DuplicateSavedEncounterPlanCommand command) {
        CompletableFuture<features.encounter.api.DuplicateSavedEncounterPlanResult> result = new CompletableFuture<>();
        executionLane.execute(() -> result.complete(commands.duplicateSavedPlan(command)));
        return result;
    }

    public EncounterRuntimeContextApi runtimeContexts() {
        return runtimeContexts;
    }

    public void applyState(ApplyEncounterStateCommand command) {
        executionLane.execute(() -> commands.applyState(command));
    }

    public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        executionLane.execute(() -> commands.updateBuilderInputs(command));
    }

    @Override
    public void updatePoolFilters(UpdateEncounterPoolFiltersCommand command) {
        executionLane.execute(() -> commands.updatePoolFilters(command));
    }

    @Override
    public void updateTuning(UpdateEncounterTuningCommand command) {
        executionLane.execute(() -> commands.updateTuning(command));
    }

    public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
        executionLane.execute(() -> commands.refreshPlanBudget(command));
    }

    @Override
    public java.util.concurrent.CompletionStage<OpenSavedEncounterPlanResult> openSavedPlan(
            OpenSavedEncounterPlanCommand command
    ) {
        CompletableFuture<OpenSavedEncounterPlanResult> result = new CompletableFuture<>();
        executionLane.execute(() -> {
            if (commands instanceof RuntimeCommandActions runtime) {
                try {
                    result.complete(runtime.openSavedPlan(command));
                } catch (RuntimeException exception) {
                    result.complete(new OpenSavedEncounterPlanResult(
                            OpenSavedEncounterPlanResult.Status.STORAGE_ERROR,
                            command == null ? 0L : command.planId(),
                            "Encounter konnte nicht geöffnet werden."));
                }
            } else {
                result.complete(new OpenSavedEncounterPlanResult(
                        OpenSavedEncounterPlanResult.Status.INVALID,
                        command == null ? 0L : command.planId(),
                        "Encounter-Laufzeit ist nicht verfügbar."));
            }
        });
        return result;
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
                effective.nameQuery(),
                effective.challengeRatingMin(),
                effective.challengeRatingMax(),
                effective.sizes(),
                effective.alignments(),
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

        default void updatePoolFilters(UpdateEncounterPoolFiltersCommand command) {
            EncounterPoolFilters filters = command == null ? EncounterPoolFilters.empty() : command.filters();
            updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(
                    new EncounterBuilderInputs(filters, EncounterTuningSettings.defaults())));
        }

        default void updateTuning(UpdateEncounterTuningCommand command) {
            EncounterTuningSettings tuning = command == null ? EncounterTuningSettings.defaults() : command.settings();
            updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(
                    new EncounterBuilderInputs(EncounterPoolFilters.empty(), tuning)));
        }

        void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command);

        default features.encounter.api.DuplicateSavedEncounterPlanResult duplicateSavedPlan(
                features.encounter.api.DuplicateSavedEncounterPlanCommand command
        ) {
            return new features.encounter.api.DuplicateSavedEncounterPlanResult(
                    features.encounter.api.DuplicateSavedEncounterPlanResult.Status.STORAGE_FAILURE,
                    0L, "Encounter duplication is unavailable.");
        }
    }

    private static final class RuntimeCommandActions implements CommandActions {

        private final EncounterSessionRuntimeAccess runtimeAccess;
        private final EncounterPlanGateway plans;
        private final EncounterPublishedState publishedState;
        private final EncounterRuntimeContextRepository contextRepository;
        private final Map<String, ContextRuntime> contexts = new LinkedHashMap<>();
        private final HashSet<String> combatDirtyContexts = new HashSet<>();
        private EncounterRuntimeContextId focusedContextId = new EncounterRuntimeContextId("global");
        private long sourceRevision;

        private RuntimeCommandActions(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState,
                EncounterRuntimeContextRepository contextRepository
        ) {
            this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
            this.plans = Objects.requireNonNull(plans, "plans");
            this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
            this.contextRepository = Objects.requireNonNull(contextRepository, "contextRepository");
        }

        private static RuntimeCommandActions create(
                EncounterSessionRuntimeAccess runtimeAccess,
                EncounterPlanGateway plans,
                EncounterPublishedState publishedState,
                EncounterRuntimeContextRepository contextRepository
        ) {
            return new RuntimeCommandActions(runtimeAccess, plans, publishedState, contextRepository);
        }

        @Override
        public void initialize() {
            EncounterRuntimeContextRepository.StoredRuntimeContexts stored = contextRepository.load();
            sourceRevision = stored.sourceRevision();
            for (EncounterRuntimeContextRepository.StoredRuntimeContext value : stored.contexts()) {
                ContextRuntime runtime = newRuntime(value.specification());
                runtime.session().restore(value.session(), runtime.access());
                runtime.session().reconcileParty(runtime.access());
                runtime.session().reconcileSceneNpcs(toSceneNpcs(value.specification()), runtime.access());
                contexts.put(value.specification().contextId().value(), runtime);
            }
            if (stored.focusedContextId() != null
                    && contexts.containsKey(stored.focusedContextId().value())) {
                focusedContextId = stored.focusedContextId();
            }
            if (contexts.isEmpty()) {
                EncounterRuntimeContextSpec global = new EncounterRuntimeContextSpec(
                        focusedContextId, List.of(), 0L, 0L, List.of());
                ContextRuntime runtime = newRuntime(global);
                runtime.session().apply(EncounterSessionCommand.refresh(), runtime.access());
                contexts.put(focusedContextId.value(), runtime);
                persist();
            }
            publishCurrentSession();
            publishSavedPlans();
            publishPlanBudget(0L);
        }

        @Override
        public void applyState(ApplyEncounterStateCommand command) {
            EncounterSessionCommand effective = toSessionCommand(command);
            if (effective.action() == EncounterSessionCommand.Action.OPEN_SAVED_PLAN && isFocusedDirty()) {
                publishCurrentSession();
                return;
            }
            int previousMode = focused().session().memento().mode();
            focused().session().apply(effective, focused().access());
            if (isCombatRuntimeMutation(effective.action(), previousMode)) {
                combatDirtyContexts.add(focusedContextId.value());
            } else if (effective.action() == EncounterSessionCommand.Action.OPEN_SAVED_PLAN) {
                combatDirtyContexts.remove(focusedContextId.value());
            }
            persist();
            publishCurrentSession();
            if (effective.action().republishesSavedPlans()) {
                publishSavedPlans();
            }
        }

        @Override
        public void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
            focused().session().apply(
                    EncounterSessionCommand.updateBuilderInputs(toGenerationInputs(command)),
                    focused().access());
            persist();
            publishCurrentSession();
        }

        @Override
        public void updatePoolFilters(UpdateEncounterPoolFiltersCommand command) {
            EncounterPoolFilters filters = command == null ? EncounterPoolFilters.empty() : command.filters();
            EncounterGenerationInputs current = focused().session().builderInputs();
            updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(new EncounterBuilderInputs(
                    filters,
                    EncounterProjection.builderInputs(current).tuning())));
        }

        @Override
        public void updateTuning(UpdateEncounterTuningCommand command) {
            EncounterTuningSettings tuning = command == null ? EncounterTuningSettings.defaults() : command.settings();
            EncounterGenerationInputs current = focused().session().builderInputs();
            updateBuilderInputs(new UpdateEncounterBuilderInputsCommand(new EncounterBuilderInputs(
                    EncounterProjection.builderInputs(current).poolFilters(),
                    tuning)));
        }

        @Override
        public void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command) {
            publishPlanBudget(command == null ? 0L : command.planId());
        }

        private void publishCurrentSession() {
            publishedState.publishCurrentSession(focused().session(), plans);
        }

        private void publishSavedPlans() {
            publishedState.publishSavedPlans(plans.listPlans());
        }

        private void publishPlanBudget(long planId) {
            publishedState.publishPlanBudget(plans.loadPlanBudgetForPublication(planId));
        }

        private OpenSavedEncounterPlanResult openSavedPlan(OpenSavedEncounterPlanCommand command) {
            if (command == null || command.planId() <= 0L) {
                return new OpenSavedEncounterPlanResult(
                        OpenSavedEncounterPlanResult.Status.INVALID,
                        0L,
                        "Encounter-Plan-ID fehlt.");
            }
            boolean unsaved = isFocusedDirty();
            if (unsaved && !command.discardUnsavedChanges()) {
                return new OpenSavedEncounterPlanResult(
                        OpenSavedEncounterPlanResult.Status.CONFIRMATION_REQUIRED,
                        command.planId(),
                        "Ungespeicherte Encounter-Änderungen verwerfen?");
            }
            focused().session().apply(
                    toSessionCommand(ApplyEncounterStateCommand.openSavedPlan(command.planId())),
                    focused().access());
            combatDirtyContexts.remove(focusedContextId.value());
            persist();
            publishCurrentSession();
            return new OpenSavedEncounterPlanResult(
                    OpenSavedEncounterPlanResult.Status.OPENED,
                    command.planId(),
                    "Encounter geöffnet.");
        }

        @Override
        public features.encounter.api.DuplicateSavedEncounterPlanResult duplicateSavedPlan(
                features.encounter.api.DuplicateSavedEncounterPlanCommand command
        ) {
            if (command == null || command.sourcePlanId() <= 0L) {
                return new features.encounter.api.DuplicateSavedEncounterPlanResult(
                        features.encounter.api.DuplicateSavedEncounterPlanResult.Status.INVALID,
                        0L, "Encounter-Plan-ID fehlt.");
            }
            features.encounter.domain.session.PlanOutcome loaded = plans.loadPlan(command.sourcePlanId());
            if (loaded.plan().isEmpty()) {
                return new features.encounter.api.DuplicateSavedEncounterPlanResult(
                        features.encounter.api.DuplicateSavedEncounterPlanResult.Status.NOT_FOUND,
                        0L, loaded.message());
            }
            features.encounter.domain.plan.EncounterPlan source = loaded.plan().orElseThrow();
            features.encounter.domain.session.PlanOutcome saved = plans.savePlan(
                    new features.encounter.domain.plan.EncounterPlan(
                            0L, source.name() + " · Session", "", source.creatures()));
            if (saved.plan().isEmpty()) {
                return new features.encounter.api.DuplicateSavedEncounterPlanResult(
                        features.encounter.api.DuplicateSavedEncounterPlanResult.Status.STORAGE_FAILURE,
                        0L, saved.message());
            }
            publishSavedPlans();
            long duplicatedId = saved.plan().orElseThrow().id();
            return new features.encounter.api.DuplicateSavedEncounterPlanResult(
                    features.encounter.api.DuplicateSavedEncounterPlanResult.Status.DUPLICATED,
                    duplicatedId, "Encounter für Session dupliziert.");
        }

        private EncounterRuntimeContextSyncResult synchronize(SynchronizeEncounterRuntimeContextsCommand command) {
            if (command == null || command.contexts().isEmpty()) {
                return new EncounterRuntimeContextSyncResult(
                        EncounterRuntimeContextSyncResult.Status.INVALID,
                        sourceRevision,
                        "Mindestens ein Encounter-Kontext ist erforderlich.");
            }
            if (command.sourceRevision() <= sourceRevision) {
                return new EncounterRuntimeContextSyncResult(
                        EncounterRuntimeContextSyncResult.Status.STALE_IGNORED,
                        sourceRevision,
                        "Veraltete Scene-Revision ignoriert.");
            }
            HashSet<String> ids = new HashSet<>();
            for (EncounterRuntimeContextSpec spec : command.contexts()) {
                if (!ids.add(spec.contextId().value())) {
                    return new EncounterRuntimeContextSyncResult(
                            EncounterRuntimeContextSyncResult.Status.INVALID,
                            sourceRevision,
                            "Encounter-Kontext-IDs müssen eindeutig sein.");
                }
            }
            if (!ids.contains(command.focusedContextId().value())) {
                return new EncounterRuntimeContextSyncResult(
                        EncounterRuntimeContextSyncResult.Status.INVALID,
                        sourceRevision,
                        "Der fokussierte Encounter-Kontext fehlt.");
            }

            Map<String, ContextRuntime> next = new LinkedHashMap<>();
            for (EncounterRuntimeContextSpec spec : command.contexts()) {
                ContextRuntime existing = contexts.get(spec.contextId().value());
                boolean created = existing == null;
                ContextRuntime runtime;
                if (created) {
                    runtime = newRuntime(spec);
                    runtime.session().apply(EncounterSessionCommand.refresh(), runtime.access());
                    if (spec.initialEncounterPlanId() > 0L) {
                        runtime.session().apply(
                                toSessionCommand(ApplyEncounterStateCommand.openSavedPlan(
                                        spec.initialEncounterPlanId())),
                                runtime.access());
                    }
                } else {
                    runtime = newRuntime(spec);
                    runtime.session().restore(existing.session().memento(), runtime.access());
                    runtime.session().reconcileParty(runtime.access());
                }
                runtime.session().reconcileSceneNpcs(toSceneNpcs(spec), runtime.access());
                next.put(spec.contextId().value(), runtime);
            }
            contextRepository.replace(storedContexts(
                    next,
                    command.sourceRevision(),
                    command.focusedContextId()));
            contexts.clear();
            contexts.putAll(next);
            combatDirtyContexts.retainAll(ids);
            focusedContextId = command.focusedContextId();
            sourceRevision = command.sourceRevision();
            publishCurrentSession();
            return new EncounterRuntimeContextSyncResult(
                    EncounterRuntimeContextSyncResult.Status.APPLIED,
                    sourceRevision,
                    "Encounter-Kontexte synchronisiert.");
        }

        private ContextRuntime focused() {
            ContextRuntime runtime = contexts.get(focusedContextId.value());
            if (runtime == null) {
                throw new IllegalStateException("Focused Encounter runtime context is missing.");
            }
            return runtime;
        }

        private ContextRuntime newRuntime(EncounterRuntimeContextSpec spec) {
            return new ContextRuntime(spec, contextAccess(spec), new EncounterSession());
        }

        private EncounterSession.SessionRepository contextAccess(EncounterRuntimeContextSpec spec) {
            return new ContextSessionRepository(runtimeAccess, spec);
        }

        private void persist() {
            contextRepository.replace(storedContexts(contexts, sourceRevision, focusedContextId));
        }

        private EncounterRuntimeContextRepository.StoredRuntimeContexts storedContexts(
                Map<String, ContextRuntime> source,
                long revision,
                EncounterRuntimeContextId focused
        ) {
            List<EncounterRuntimeContextRepository.StoredRuntimeContext> stored = source.values().stream()
                    .map(value -> new EncounterRuntimeContextRepository.StoredRuntimeContext(
                            value.specification(), persistedMemento(value)))
                    .toList();
            return new EncounterRuntimeContextRepository.StoredRuntimeContexts(revision, focused, stored);
        }

        private EncounterSessionMemento persistedMemento(ContextRuntime runtime) {
            EncounterSessionMemento current = runtime.session().memento();
            if (current.dirty() || !combatDirtyContexts.contains(runtime.specification().contextId().value())) {
                return current;
            }
            return new EncounterSessionMemento(
                    current.mode(),
                    current.status(),
                    current.builderInputs(),
                    current.generatedAlternatives(),
                    current.generatedAdvisories(),
                    current.selectedAlternativeIndex(),
                    current.generatedAdjustedXp(),
                    current.generatedDifficulty(),
                    current.generatedTitle(),
                    current.generationHistoryPresent(),
                    true,
                    current.roster(),
                    current.pendingUndo(),
                    current.nextUndoToken(),
                    current.activeSavedPlanId(),
                    current.initiativeEntries(),
                    current.combatants(),
                    current.currentTurnIndex(),
                    current.round(),
                    current.resultState());
        }

        private boolean isFocusedDirty() {
            return focused().session().memento().dirty()
                    || combatDirtyContexts.contains(focusedContextId.value());
        }

        private static boolean isCombatRuntimeMutation(EncounterSessionCommand.Action action, int previousMode) {
            return switch (action) {
                case OPEN_INITIATIVE,
                        BACK_TO_BUILDER,
                        CONFIRM_INITIATIVE,
                        ADVANCE_TURN,
                        ADJUST_INITIATIVE,
                        ADD_PARTY_MEMBER_TO_COMBAT,
                        END_COMBAT,
                        AWARD_XP,
                        RETURN_TO_BUILDER_AFTER_RESULTS,
                        MUTATE_HP -> true;
                case ADD_CREATURE -> Mode.isCombatMode(previousMode);
                default -> false;
            };
        }

        private static List<SceneNpcData> toSceneNpcs(EncounterRuntimeContextSpec spec) {
            return spec.npcs().stream()
                    .map(npc -> new SceneNpcData(
                            npc.worldNpcId(),
                            npc.statblockId(),
                            switch (npc.role()) {
                                case ENEMY -> SceneNpcData.Role.HOSTILE;
                                case ALLY -> SceneNpcData.Role.FRIENDLY;
                                case NEUTRAL -> SceneNpcData.Role.NEUTRAL;
                            }))
                    .toList();
        }
    }

    private record ContextRuntime(
            EncounterRuntimeContextSpec specification,
            EncounterSession.SessionRepository access,
            EncounterSession session
    ) { }

    private static final class RuntimeContextApi implements EncounterRuntimeContextApi {

        private final RuntimeCommandActions commands;
        private final ExecutionLane executionLane;

        private RuntimeContextApi(RuntimeCommandActions commands, ExecutionLane executionLane) {
            this.commands = commands;
            this.executionLane = executionLane;
        }

        @Override
        public java.util.concurrent.CompletionStage<EncounterRuntimeContextSyncResult> synchronize(
                SynchronizeEncounterRuntimeContextsCommand command
        ) {
            CompletableFuture<EncounterRuntimeContextSyncResult> result = new CompletableFuture<>();
            executionLane.execute(() -> {
                try {
                    result.complete(commands.synchronize(command));
                } catch (RuntimeException exception) {
                    result.complete(new EncounterRuntimeContextSyncResult(
                            EncounterRuntimeContextSyncResult.Status.STORAGE_ERROR,
                            commands.sourceRevision,
                            "Encounter-Kontexte konnten nicht gespeichert werden."));
                }
            });
            return result;
        }
    }

    private static final class ContextSessionRepository implements EncounterSession.SessionRepository {

        private final EncounterSessionRuntimeAccess delegate;
        private final EncounterRuntimeContextSpec specification;

        private ContextSessionRepository(
                EncounterSessionRuntimeAccess delegate,
                EncounterRuntimeContextSpec specification
        ) {
            this.delegate = delegate;
            this.specification = specification;
        }

        @Override
        public List<features.encounter.domain.session.PartyMemberData> loadActiveParty() {
            List<features.encounter.domain.session.PartyMemberData> active = delegate.loadActiveParty();
            if ("global".equals(specification.contextId().value())) {
                return active;
            }
            return active.stream()
                    .filter(member -> specification.partyMemberIds().contains(member.numericId()))
                    .toList();
        }

        @Override
        public java.util.Optional<features.encounter.domain.session.BudgetData> loadBudget() {
            if ("global".equals(specification.contextId().value())) {
                return delegate.loadBudget();
            }
            return delegate.loadBudgetForParty(loadActiveParty());
        }

        @Override
        public features.encounter.domain.session.GenerationResultData generate(
                features.encounter.domain.generation.EncounterGenerationRequest request) {
            if ("global".equals(specification.contextId().value())) {
                return delegate.generate(request);
            }
            return delegate.generateForParty(withSynchronizedLocation(request), loadActiveParty());
        }

        private EncounterGenerationRequest withSynchronizedLocation(EncounterGenerationRequest request) {
            EncounterGenerationRequest effective = request == null
                    ? new EncounterGenerationRequest(
                            EncounterGenerationInputs.empty(), 0, 0L, List.of(), List.of())
                    : request;
            EncounterGenerationInputs original = effective.inputs();
            EncounterGenerationInputs scoped = new EncounterGenerationInputs(
                    original.creatureTypes(),
                    original.creatureSubtypes(),
                    original.biomes(),
                    original.targetDifficulty(),
                    original.tuning(),
                    original.encounterTableIds(),
                    original.worldFactionIds(),
                    specification.locationId(),
                    original.nameQuery(),
                    original.challengeRatingMin(),
                    original.challengeRatingMax(),
                    original.sizes(),
                    original.alignments(),
                    original.finiteCreatureStockCaps());
            return new EncounterGenerationRequest(
                    scoped,
                    effective.alternativeCount(),
                    effective.generationSeed(),
                    effective.excludedCreatureIds(),
                    effective.lockedCreatures());
        }

        @Override
        public features.encounter.domain.session.PlanOutcome savePlan(
                features.encounter.domain.plan.EncounterPlan plan) {
            return delegate.savePlan(plan);
        }

        @Override
        public features.encounter.domain.session.PlanOutcome loadPlan(long planId) {
            return delegate.loadPlan(planId);
        }

        @Override
        public features.encounter.domain.session.ListPlansOutcome listPlans() {
            return delegate.listPlans();
        }

        @Override
        public java.util.Optional<features.encounter.domain.session.CreatureDetailData> loadCreature(long creatureId) {
            return delegate.loadCreature(creatureId);
        }

        @Override
        public features.encounter.domain.session.AwardXpOutcome awardXp(
                List<Long> partyMemberIds,
                int xpPerCharacter
        ) {
            return delegate.awardXp(partyMemberIds, xpPerCharacter);
        }
    }

    private static final class InMemoryRuntimeContextRepository implements EncounterRuntimeContextRepository {

        private StoredRuntimeContexts value = StoredRuntimeContexts.empty();

        @Override
        public StoredRuntimeContexts load() {
            return value;
        }

        @Override
        public void replace(StoredRuntimeContexts contexts) {
            value = contexts;
        }
    }

}
