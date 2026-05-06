package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.application.ApplyEncounterSessionUseCase;
import src.domain.encounter.application.EncounterBuilderInputsBoundaryTranslator;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterGenerationUseCase;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.EncounterSessionRuntimeAdapter;
import src.domain.encounter.application.EncounterStateBoundaryTranslator;
import src.domain.encounter.application.EncounterStateSnapshotProjector;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.application.LoadSavedEncounterPlanUseCase;
import src.domain.encounter.application.SaveEncounterPlanUseCase;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.session.entity.EncounterSession;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadEncounterBuilderInputsQuery;
import src.domain.encounter.published.LoadEncounterPlanBudgetQuery;
import src.domain.encounter.published.LoadEncounterStateQuery;
import src.domain.encounter.published.LoadEncounterTuningPreviewQuery;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.UpdateEncounterBuilderInputsCommand;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encounter.session.value.EncounterSessionCommand;

/**
 * Public encounter facade that owns generation, saved-plan persistence, and
 * the transient encounter-builder or combat session state for the view layer.
 */
@SuppressWarnings("PMD.AvoidCatchingGenericException")
public final class EncounterApplicationService {

    private static final String QUERY_PARAMETER = "query";
    private static final String LISTENER_PARAMETER = "listener";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";

    private final @Nullable LoadEncounterBudgetUseCase loadBudgetUseCase;
    private final @Nullable LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;
    private final @Nullable ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final @Nullable ApplyEncounterSessionUseCase applySessionUseCase;
    private final List<Consumer<EncounterStateSnapshot>> stateListeners = new ArrayList<>();
    private final List<Consumer<EncounterBuilderInputs>> builderInputsListeners = new ArrayList<>();
    private final List<Consumer<EncounterTuningPreviewResult>> tuningPreviewListeners = new ArrayList<>();
    private final EncounterStateModel stateModel = new EncounterStateModel(
            this::currentStateSnapshot,
            this::subscribeStateListener);
    private final EncounterBuilderInputsModel builderInputsModel = new EncounterBuilderInputsModel(
            this::currentBuilderInputs,
            this::subscribeBuilderInputsListener);
    private final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            this::currentTuningPreview,
            this::subscribeTuningPreviewListener);
    private EncounterTuningPreviewResult currentTuningPreview = new EncounterTuningPreviewResult(
            EncounterGenerationStatus.STORAGE_ERROR,
            new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
            "");

    public EncounterApplicationService(EncounterPartyFactsRepository party, CreaturesApplicationService creatures) {
        this(party, creatures, null, null);
    }

    public EncounterApplicationService(
            EncounterPartyFactsRepository party,
            CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables
    ) {
        this(party, creatures, encounterTables, null);
    }

    public EncounterApplicationService(EncounterPlanRepository encounterPlans) {
        this(null, null, null, encounterPlans);
    }

    public EncounterApplicationService(
            @Nullable EncounterPartyFactsRepository party,
            @Nullable CreaturesApplicationService creatures,
            @Nullable EncounterTableApplicationService encounterTables,
            @Nullable EncounterPlanRepository encounterPlans
    ) {
        SaveEncounterPlanUseCase nextSavePlanUseCase =
                encounterPlans == null ? null : new SaveEncounterPlanUseCase(encounterPlans);
        LoadSavedEncounterPlanUseCase nextLoadSavedPlanUseCase =
                encounterPlans == null ? null : new LoadSavedEncounterPlanUseCase(encounterPlans);
        ListSavedEncounterPlansUseCase nextListSavedPlansUseCase =
                encounterPlans == null ? null : new ListSavedEncounterPlansUseCase(encounterPlans);
        EncounterGenerationUseCase nextGenerator;
        LoadEncounterBudgetUseCase nextLoadBudgetUseCase;
        ApplyEncounterSessionUseCase nextApplySessionUseCase;
        if (party != null && creatures != null) {
            nextGenerator = new EncounterGenerationUseCase(party, creatures, encounterTables);
            nextLoadBudgetUseCase = new LoadEncounterBudgetUseCase(party);
            nextApplySessionUseCase = new ApplyEncounterSessionUseCase(new EncounterSessionRuntimeAdapter(
                    party,
                    creatures,
                    nextGenerator,
                    nextLoadBudgetUseCase,
                    nextSavePlanUseCase,
                    nextLoadSavedPlanUseCase,
                    nextListSavedPlansUseCase));
        } else {
            nextGenerator = null;
            nextLoadBudgetUseCase = null;
            nextApplySessionUseCase = null;
        }
        this.loadBudgetUseCase = nextLoadBudgetUseCase;
        this.applySessionUseCase = nextApplySessionUseCase;
        if (party != null && creatures != null && encounterPlans != null) {
            this.loadPlanBudgetUseCase = new LoadEncounterPlanBudgetUseCase(encounterPlans, party, creatures);
        } else {
            this.loadPlanBudgetUseCase = null;
        }
        this.listSavedPlansUseCase = nextListSavedPlansUseCase;
    }

    public EncounterTuningPreviewResult loadTuningPreview(LoadEncounterTuningPreviewQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        currentTuningPreview = refreshTuningPreview();
        notifyTuningPreviewListeners(currentTuningPreview);
        return currentTuningPreview;
    }

    private EncounterTuningPreviewResult refreshTuningPreview() {
        if (loadBudgetUseCase == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    "Encounter tuning preview service is not registered.");
        }
        try {
            LoadEncounterBudgetUseCase.Result result = loadBudgetUseCase.execute();
            EncounterBudgetSummary budget = EncounterBudgetBoundaryTranslator.toPublishedBudget(result.budget());
            return new EncounterTuningPreviewResult(
                    EncounterBudgetBoundaryTranslator.mapBudgetStatus(result.status()),
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(budget),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    EncounterBudgetBoundaryTranslator.tuningPreviewLabels(null),
                    "Encounter tuning preview could not be loaded.");
        }
    }

    public EncounterPlanBudgetResult loadPlanBudget(LoadEncounterPlanBudgetQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        if (loadPlanBudgetUseCase == null) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget service is not registered.");
        }
        try {
            LoadEncounterPlanBudgetUseCase.Result result = loadPlanBudgetUseCase.execute(query.planId());
            return new EncounterPlanBudgetResult(
                    EncounterBudgetBoundaryTranslator.toPublishedPlanBudgetStatus(result.status()),
                    EncounterBudgetBoundaryTranslator.toPublishedPlanBudget(result.summary()),
                    result.message());
        } catch (RuntimeException exception) {
            return new EncounterPlanBudgetResult(
                    EncounterPlanBudgetStatus.STORAGE_ERROR,
                    null,
                    "Encounter plan budget could not be loaded.");
        }
    }

    public SavedEncounterPlanListResult listPlans(ListSavedEncounterPlansQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        ListSavedEncounterPlansUseCase useCase = listSavedPlansUseCase;
        if (useCase == null) {
            return new SavedEncounterPlanListResult(
                    SavedEncounterPlanStatus.STORAGE_ERROR,
                    List.of(),
                    PLAN_STORAGE_NOT_REGISTERED);
        }
        ListSavedEncounterPlansUseCase.Result result = useCase.execute();
        return new SavedEncounterPlanListResult(
                EncounterPlanBoundaryTranslator.toPublishedListPlansStatus(result.status()),
                result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedSummary).toList(),
                result.message());
    }

    public EncounterStateModel loadStateModel(LoadEncounterStateQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return stateModel;
    }

    public EncounterBuilderInputsModel loadBuilderInputsModel(LoadEncounterBuilderInputsQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return builderInputsModel;
    }

    public EncounterTuningPreviewModel loadTuningPreviewModel(LoadEncounterTuningPreviewQuery query) {
        Objects.requireNonNull(query, QUERY_PARAMETER);
        return tuningPreviewModel;
    }

    public EncounterStateSnapshot applyState(ApplyEncounterStateCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED);
        }
        EncounterSession session = useCase.apply(EncounterStateBoundaryTranslator.toInternalCommand(command));
        return publishSnapshot(session);
    }

    public EncounterBuilderInputs updateBuilderInputs(UpdateEncounterBuilderInputsCommand command) {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterBuilderInputs.empty();
        }
        UpdateEncounterBuilderInputsCommand effective = command == null
                ? new UpdateEncounterBuilderInputsCommand(EncounterBuilderInputs.empty())
                : command;
        EncounterSession session = useCase.apply(new EncounterSessionCommand(
                EncounterSessionCommand.Action.UPDATE_BUILDER_INPUTS,
                Optional.empty(),
                EncounterBuilderInputsBoundaryTranslator.toInternal(effective.inputs()),
                0L,
                0L,
                0,
                0L,
                List.of(),
                "",
                0,
                0L,
                0,
                false));
        publishSnapshot(session);
        return EncounterStateSnapshotProjector.toPublishedBuilderInputs(session);
    }

    private EncounterStateSnapshot currentStateSnapshot() {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED);
        }
        return EncounterStateSnapshotProjector.toPublishedSnapshot(useCase.session());
    }

    private EncounterBuilderInputs currentBuilderInputs() {
        ApplyEncounterSessionUseCase useCase = applySessionUseCase;
        if (useCase == null) {
            return EncounterBuilderInputs.empty();
        }
        return EncounterStateSnapshotProjector.toPublishedBuilderInputs(useCase.session());
    }

    private Runnable subscribeStateListener(Consumer<EncounterStateSnapshot> listener) {
        Consumer<EncounterStateSnapshot> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        stateListeners.add(safeListener);
        return () -> stateListeners.remove(safeListener);
    }

    private Runnable subscribeBuilderInputsListener(Consumer<EncounterBuilderInputs> listener) {
        Consumer<EncounterBuilderInputs> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        builderInputsListeners.add(safeListener);
        return () -> builderInputsListeners.remove(safeListener);
    }

    private EncounterTuningPreviewResult currentTuningPreview() {
        return currentTuningPreview;
    }

    private Runnable subscribeTuningPreviewListener(Consumer<EncounterTuningPreviewResult> listener) {
        Consumer<EncounterTuningPreviewResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        tuningPreviewListeners.add(safeListener);
        return () -> tuningPreviewListeners.remove(safeListener);
    }

    private EncounterStateSnapshot publishSnapshot(EncounterSession session) {
        EncounterStateSnapshot state = EncounterStateSnapshotProjector.toPublishedSnapshot(session);
        EncounterBuilderInputs builderInputs = EncounterStateSnapshotProjector.toPublishedBuilderInputs(session);
        notifyStateListeners(state);
        notifyBuilderInputsListeners(builderInputs);
        currentTuningPreview = refreshTuningPreview();
        notifyTuningPreviewListeners(currentTuningPreview);
        return state;
    }

    private void notifyStateListeners(EncounterStateSnapshot snapshot) {
        for (Consumer<EncounterStateSnapshot> listener : List.copyOf(stateListeners)) {
            listener.accept(snapshot);
        }
    }

    private void notifyBuilderInputsListeners(EncounterBuilderInputs builderInputs) {
        for (Consumer<EncounterBuilderInputs> listener : List.copyOf(builderInputsListeners)) {
            listener.accept(builderInputs);
        }
    }

    private void notifyTuningPreviewListeners(EncounterTuningPreviewResult result) {
        for (Consumer<EncounterTuningPreviewResult> listener : List.copyOf(tuningPreviewListeners)) {
            listener.accept(result);
        }
    }
}
