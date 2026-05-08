package src.data.encounter.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.application.EncounterBudgetBoundaryTranslator;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.EncounterStateSnapshotProjector;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterBudgetUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewLabels;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.runtime.port.EncounterPlanPublishedStateRepository;
import src.domain.encounter.runtime.port.EncounterSessionPublishedStateRepository;
import src.domain.encounter.session.entity.EncounterSession;

public final class EncounterPublishedStateRepositoryAdapter
        implements EncounterSessionPublishedStateRepository, EncounterPlanPublishedStateRepository {

    private static final String LISTENER_PARAMETER = "listener";
    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String TUNING_PREVIEW_NOT_REGISTERED = "Encounter tuning preview service is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

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
            @Nullable EncounterSession session,
            LoadEncounterBudgetUseCase.Result budgetResult
    ) {
        currentState = session == null
                ? EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED)
                : EncounterStateSnapshotProjector.toPublishedSnapshot(session);
        currentBuilderInputs = session == null
                ? EncounterBuilderInputs.empty()
                : EncounterStateSnapshotProjector.toPublishedBuilderInputs(session);
        currentTuningPreview = toTuningPreviewResult(budgetResult);
        notifyStateListeners(currentState);
        notifyBuilderInputsListeners(currentBuilderInputs);
        notifyTuningPreviewListeners(currentTuningPreview);
    }

    @Override
    public void publishSavedPlans(ListSavedEncounterPlansUseCase.Result result) {
        currentSavedPlans = result == null
                ? new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), PLAN_STORAGE_NOT_REGISTERED)
                : new SavedEncounterPlanListResult(
                        toSavedPlanStatus(result.status()),
                        result.plans().stream().map(EncounterPlanBoundaryTranslator::toPublishedChoice).toList(),
                        result.message());
        notifySavedPlansListeners(currentSavedPlans);
    }

    @Override
    public void publishPlanBudget(LoadEncounterPlanBudgetUseCase.Result result) {
        currentPlanBudget = toPlanBudgetResult(result);
        notifyPlanBudgetListeners(currentPlanBudget);
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

    private static EncounterTuningPreviewResult toTuningPreviewResult(LoadEncounterBudgetUseCase.Result result) {
        if (result == null) {
            return new EncounterTuningPreviewResult(
                    EncounterGenerationStatus.STORAGE_ERROR,
                    defaultTuningPreviewLabels(),
                    TUNING_PREVIEW_NOT_REGISTERED);
        }
        return new EncounterTuningPreviewResult(
                toEncounterGenerationStatus(result.status()),
                EncounterBudgetBoundaryTranslator.tuningPreviewLabels(
                        result.budget() == null ? emptyBudgetSummary() : result.budget()),
                result.message());
    }

    private static EncounterPlanBudgetResult toPlanBudgetResult(LoadEncounterPlanBudgetUseCase.Result result) {
        if (result == null) {
            return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, PLAN_BUDGET_NOT_REGISTERED);
        }
        LoadEncounterPlanBudgetUseCase.PlanBudgetSummary summary = result.summary();
        return new EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.valueOf(result.status().name()),
                summary == null
                        ? null
                        : new EncounterPlanBudgetSummary(
                                summary.planId(),
                                summary.name(),
                                summary.generatedLabel(),
                                summary.creatureCount(),
                                summary.totalBaseXp(),
                                summary.adjustedXp(),
                                summary.xpMultiplier(),
                                summary.difficultyLabel()),
                result.message());
    }

    private static SavedEncounterPlanStatus toSavedPlanStatus(ListSavedEncounterPlansUseCase.Status status) {
        return status == ListSavedEncounterPlansUseCase.Status.SUCCESS
                ? SavedEncounterPlanStatus.SUCCESS
                : SavedEncounterPlanStatus.STORAGE_ERROR;
    }

    private static EncounterGenerationStatus toEncounterGenerationStatus(
            src.domain.encounter.session.port.EncounterPartyFactsRepository.Status status
    ) {
        if (status == null) {
            return EncounterGenerationStatus.STORAGE_ERROR;
        }
        return switch (status) {
            case SUCCESS -> EncounterGenerationStatus.SUCCESS;
            case NO_ACTIVE_PARTY -> EncounterGenerationStatus.NO_ACTIVE_PARTY;
            case STORAGE_ERROR -> EncounterGenerationStatus.STORAGE_ERROR;
        };
    }

    private static EncounterTuningPreviewLabels defaultTuningPreviewLabels() {
        return EncounterBudgetBoundaryTranslator.tuningPreviewLabels(emptyBudgetSummary());
    }

    private static EncounterDifficultyMath.BudgetSummary emptyBudgetSummary() {
        return new EncounterDifficultyMath.BudgetSummary(List.of(), 1, 0, 0, 0, 0, 0, 0, 0);
    }
}
