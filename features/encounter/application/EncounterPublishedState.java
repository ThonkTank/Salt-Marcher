package features.encounter.application;

import platform.ui.UiDispatcher;
import features.encounter.domain.plan.EncounterPlanBudgetLoadResult;
import features.encounter.domain.plan.SavedEncounterPlansLoadResult;
import features.encounter.domain.session.EncounterSession;
import features.encounter.domain.session.EncounterSessionPublicationData;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterPlanBudgetModel;
import features.encounter.api.EncounterPoolFiltersModel;
import features.encounter.api.EncounterPlanBudgetResult;
import features.encounter.api.EncounterStateModel;
import features.encounter.api.EncounterStateSnapshot;
import features.encounter.api.EncounterTuningPreviewModel;
import features.encounter.api.EncounterTuningPreviewResult;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encounter.api.SavedEncounterPlanListResult;
import platform.state.PublishedState;

public final class EncounterPublishedState {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final PublishedState<EncounterStateSnapshot> state;
    private final PublishedState<EncounterBuilderInputs> builderInputs;
    private final PublishedState<EncounterTuningPreviewResult> tuningPreview;
    private final PublishedState<SavedEncounterPlanListResult> savedPlans;
    private final PublishedState<EncounterPlanBudgetResult> planBudget;
    private final EncounterStateModel stateModel;
    private final EncounterBuilderInputsModel builderInputsModel;
    private final EncounterPoolFiltersModel poolFiltersModel;
    private final EncounterTuningPreviewModel tuningPreviewModel;
    private final SavedEncounterPlanListModel savedPlansModel;
    private final EncounterPlanBudgetModel planBudgetModel;

    public EncounterPublishedState(UiDispatcher dispatcher) {
        state = new PublishedState<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED), dispatcher);
        builderInputs = new PublishedState<>(EncounterBuilderInputs.empty(), dispatcher);
        tuningPreview = new PublishedState<>(EncounterProjection.emptyTuningPreview(), dispatcher);
        savedPlans = new PublishedState<>(EncounterProjection.emptySavedPlans(), dispatcher);
        planBudget = new PublishedState<>(EncounterProjection.emptyPlanBudget(), dispatcher);
        stateModel = new EncounterStateModel(state::current, state::subscribe);
        builderInputsModel = new EncounterBuilderInputsModel(builderInputs::current, builderInputs::subscribe);
        poolFiltersModel = new EncounterPoolFiltersModel(
                () -> builderInputs.current().poolFilters(),
                listener -> builderInputs.subscribe(inputs -> listener.accept(inputs.poolFilters())));
        tuningPreviewModel = new EncounterTuningPreviewModel(tuningPreview::current, tuningPreview::subscribe);
        savedPlansModel = new SavedEncounterPlanListModel(savedPlans::current, savedPlans::subscribe);
        planBudgetModel = new EncounterPlanBudgetModel(planBudget::current, planBudget::subscribe);
    }

    public EncounterStateModel stateModel() {
        return stateModel;
    }

    public EncounterBuilderInputsModel builderInputsModel() {
        return builderInputsModel;
    }

    public EncounterPoolFiltersModel poolFiltersModel() {
        return poolFiltersModel;
    }

    public EncounterTuningPreviewModel tuningPreviewModel() {
        return tuningPreviewModel;
    }

    public SavedEncounterPlanListModel savedPlansModel() {
        return savedPlansModel;
    }

    public EncounterPlanBudgetModel planBudgetModel() {
        return planBudgetModel;
    }

    void publishCurrentSession(EncounterSession session, EncounterPlanGateway plans) {
        EncounterSessionPublicationData publication = session == null
                ? EncounterSessionPublicationData.unavailable(SESSION_NOT_REGISTERED)
                : new EncounterSessionPublicationData(
                        session.snapshot(),
                        session.builderInputs(),
                        EncounterProjection.tuningPreviewData(plans.loadBudgetForTuningPreview()),
                        "");
        state.publish(EncounterProjection.stateSnapshot(publication, SESSION_NOT_REGISTERED));
        builderInputs.publish(EncounterProjection.builderInputs(publication.builderInputs()));
        tuningPreview.publish(EncounterProjection.tuningPreview(publication.tuningPreview()));
    }

    void publishSavedPlans(SavedEncounterPlansLoadResult result) {
        savedPlans.publish(result == null
                ? EncounterProjection.storageUnavailableSavedPlans(PLAN_STORAGE_NOT_REGISTERED)
                : EncounterProjection.savedPlans(result));
    }

    void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
        planBudget.publish(result == null
                ? EncounterProjection.budgetUnavailable(PLAN_BUDGET_NOT_REGISTERED)
                : EncounterProjection.planBudget(result));
    }
}
