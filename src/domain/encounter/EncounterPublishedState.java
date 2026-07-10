package src.domain.encounter;

import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.session.EncounterSession;
import src.domain.encounter.model.session.EncounterSessionPublicationData;
import src.domain.encounter.published.EncounterBuilderInputs;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encounter.published.EncounterTuningPreviewResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.shared.published.PublishedState;

final class EncounterPublishedState {

    private static final String SESSION_NOT_REGISTERED = "Encounter session is not registered.";
    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final PublishedState<EncounterStateSnapshot> state =
            new PublishedState<>(EncounterStateSnapshot.empty(SESSION_NOT_REGISTERED));
    private final PublishedState<EncounterBuilderInputs> builderInputs =
            new PublishedState<>(EncounterBuilderInputs.empty());
    private final PublishedState<EncounterTuningPreviewResult> tuningPreview =
            new PublishedState<>(EncounterProjection.emptyTuningPreview());
    private final PublishedState<SavedEncounterPlanListResult> savedPlans =
            new PublishedState<>(EncounterProjection.emptySavedPlans());
    private final PublishedState<EncounterPlanBudgetResult> planBudget =
            new PublishedState<>(EncounterProjection.emptyPlanBudget());
    private final EncounterStateModel stateModel = new EncounterStateModel(state::current, state::subscribe);
    private final EncounterBuilderInputsModel builderInputsModel =
            new EncounterBuilderInputsModel(builderInputs::current, builderInputs::subscribe);
    private final EncounterTuningPreviewModel tuningPreviewModel =
            new EncounterTuningPreviewModel(tuningPreview::current, tuningPreview::subscribe);
    private final SavedEncounterPlanListModel savedPlansModel =
            new SavedEncounterPlanListModel(savedPlans::current, savedPlans::subscribe);
    private final EncounterPlanBudgetModel planBudgetModel =
            new EncounterPlanBudgetModel(planBudget::current, planBudget::subscribe);

    EncounterStateModel stateModel() {
        return stateModel;
    }

    EncounterBuilderInputsModel builderInputsModel() {
        return builderInputsModel;
    }

    EncounterTuningPreviewModel tuningPreviewModel() {
        return tuningPreviewModel;
    }

    SavedEncounterPlanListModel savedPlansModel() {
        return savedPlansModel;
    }

    EncounterPlanBudgetModel planBudgetModel() {
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
