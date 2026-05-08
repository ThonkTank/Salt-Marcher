package src.data.encounter.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.encounter.EncounterPlanPublishedStateRepository;
import src.domain.encounter.EncounterSessionPublishedStateRepository;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;

public final class EncounterPublishedStateRepositoryAdapter
        implements EncounterSessionPublishedStateRepository, EncounterPlanPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";

    private final List<Consumer<EncounterStateSnapshot>> stateListeners = new ArrayList<>();
    private final List<Consumer<EncounterBuilderInputs>> builderInputsListeners = new ArrayList<>();
    private final List<Consumer<EncounterTuningPreviewResult>> tuningPreviewListeners = new ArrayList<>();
    private final List<Consumer<SavedEncounterPlanListResult>> savedPlansListeners = new ArrayList<>();
    private final List<Consumer<EncounterPlanBudgetResult>> planBudgetListeners = new ArrayList<>();
    public final EncounterStateModel stateModel = new EncounterStateModel(
            this::currentState,
            this::subscribeStateListener);
    public final EncounterBuilderInputsModel builderInputsModel = new EncounterBuilderInputsModel(
            this::currentBuilderInputs,
            this::subscribeBuilderInputsListener);
    public final EncounterTuningPreviewModel tuningPreviewModel = new EncounterTuningPreviewModel(
            this::currentTuningPreview,
            this::subscribeTuningPreviewListener);
    public final SavedEncounterPlanListModel savedPlansModel = new SavedEncounterPlanListModel(
            this::currentSavedPlans,
            this::subscribeSavedPlansListener);
    public final EncounterPlanBudgetModel planBudgetModel = new EncounterPlanBudgetModel(
            this::currentPlanBudget,
            this::subscribePlanBudgetListener);
    private EncounterStateSnapshot currentState = EncounterStateSnapshot.empty("Encounter state is not registered.");
    private EncounterBuilderInputs currentBuilderInputs = EncounterBuilderInputs.empty();
    private EncounterTuningPreviewResult currentTuningPreview = emptyTuningPreview();
    private SavedEncounterPlanListResult currentSavedPlans = emptySavedPlans();
    private EncounterPlanBudgetResult currentPlanBudget = emptyPlanBudget();

    @Override
    public void publishCurrentSession(
            EncounterStateSnapshot state,
            EncounterBuilderInputs builderInputs,
            EncounterTuningPreviewResult tuningPreview
    ) {
        currentState = state == null ? EncounterStateSnapshot.empty("Encounter state is not registered.") : state;
        currentBuilderInputs = builderInputs == null ? EncounterBuilderInputs.empty() : builderInputs;
        currentTuningPreview = tuningPreview == null ? emptyTuningPreview() : tuningPreview;
        notifyStateListeners(currentState);
        notifyBuilderInputsListeners(currentBuilderInputs);
        notifyTuningPreviewListeners(currentTuningPreview);
    }

    @Override
    public void publishSavedPlans(SavedEncounterPlanListResult savedPlans) {
        currentSavedPlans = savedPlans == null ? emptySavedPlans() : savedPlans;
        notifySavedPlansListeners(currentSavedPlans);
    }

    @Override
    public void publishPlanBudget(EncounterPlanBudgetResult planBudget) {
        currentPlanBudget = planBudget == null ? emptyPlanBudget() : planBudget;
        notifyPlanBudgetListeners(currentPlanBudget);
    }

    @Override
    public EncounterStateModel stateModel() {
        return stateModel;
    }

    @Override
    public EncounterBuilderInputsModel builderInputsModel() {
        return builderInputsModel;
    }

    @Override
    public EncounterTuningPreviewModel tuningPreviewModel() {
        return tuningPreviewModel;
    }

    @Override
    public SavedEncounterPlanListModel savedPlansModel() {
        return savedPlansModel;
    }

    @Override
    public EncounterPlanBudgetModel planBudgetModel() {
        return planBudgetModel;
    }

    private EncounterStateSnapshot currentState() {
        return currentState;
    }

    private EncounterBuilderInputs currentBuilderInputs() {
        return currentBuilderInputs;
    }

    private EncounterTuningPreviewResult currentTuningPreview() {
        return currentTuningPreview;
    }

    private SavedEncounterPlanListResult currentSavedPlans() {
        return currentSavedPlans;
    }

    private EncounterPlanBudgetResult currentPlanBudget() {
        return currentPlanBudget;
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

    private Runnable subscribeTuningPreviewListener(Consumer<EncounterTuningPreviewResult> listener) {
        Consumer<EncounterTuningPreviewResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        tuningPreviewListeners.add(safeListener);
        return () -> tuningPreviewListeners.remove(safeListener);
    }

    private Runnable subscribeSavedPlansListener(Consumer<SavedEncounterPlanListResult> listener) {
        Consumer<SavedEncounterPlanListResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        savedPlansListeners.add(safeListener);
        return () -> savedPlansListeners.remove(safeListener);
    }

    private Runnable subscribePlanBudgetListener(Consumer<EncounterPlanBudgetResult> listener) {
        Consumer<EncounterPlanBudgetResult> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
        planBudgetListeners.add(safeListener);
        return () -> planBudgetListeners.remove(safeListener);
    }

    private void notifyStateListeners(EncounterStateSnapshot state) {
        for (Consumer<EncounterStateSnapshot> listener : List.copyOf(stateListeners)) {
            listener.accept(state);
        }
    }

    private void notifyBuilderInputsListeners(EncounterBuilderInputs builderInputs) {
        for (Consumer<EncounterBuilderInputs> listener : List.copyOf(builderInputsListeners)) {
            listener.accept(builderInputs);
        }
    }

    private void notifyTuningPreviewListeners(EncounterTuningPreviewResult tuningPreview) {
        for (Consumer<EncounterTuningPreviewResult> listener : List.copyOf(tuningPreviewListeners)) {
            listener.accept(tuningPreview);
        }
    }

    private void notifySavedPlansListeners(SavedEncounterPlanListResult savedPlans) {
        for (Consumer<SavedEncounterPlanListResult> listener : List.copyOf(savedPlansListeners)) {
            listener.accept(savedPlans);
        }
    }

    private void notifyPlanBudgetListeners(EncounterPlanBudgetResult planBudget) {
        for (Consumer<EncounterPlanBudgetResult> listener : List.copyOf(planBudgetListeners)) {
            listener.accept(planBudget);
        }
    }

    private static EncounterTuningPreviewResult emptyTuningPreview() {
        return new EncounterTuningPreviewResult(
                EncounterGenerationStatus.STORAGE_ERROR,
                new EncounterTuningPreviewLabels(List.of(), List.of(), List.of(), List.of()),
                "");
    }

    private static SavedEncounterPlanListResult emptySavedPlans() {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
    }

    private static EncounterPlanBudgetResult emptyPlanBudget() {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, "");
    }
}
