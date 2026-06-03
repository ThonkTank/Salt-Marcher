package src.domain.encounter;

import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;
import src.domain.encounter.model.plan.repository.EncounterPlanPublishedStateRepository;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.SavedEncounterPlanListResult;

final class EncounterPlanPublishedStateServiceAssembly implements EncounterPlanPublishedStateRepository {

    private static final String PLAN_STORAGE_NOT_REGISTERED = "Encounter plan storage is not registered.";
    private static final String PLAN_BUDGET_NOT_REGISTERED = "Encounter plan budget service is not registered.";

    private final EncounterPublishedStateChannelServiceAssembly<SavedEncounterPlanListResult> savedPlans =
            new EncounterPublishedStateChannelServiceAssembly<>(
                    EncounterSavedPlanProjectionServiceAssembly.emptySavedPlans());
    private final EncounterPublishedStateChannelServiceAssembly<EncounterPlanBudgetResult> planBudget =
            new EncounterPublishedStateChannelServiceAssembly<>(
                    EncounterPlanBudgetProjectionServiceAssembly.emptyPlanBudget());
    private final src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel =
            new src.domain.encounter.published.SavedEncounterPlanListModel(
                    savedPlans::current,
                    savedPlans::subscribe);
    private final src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel =
            new src.domain.encounter.published.EncounterPlanBudgetModel(
                    planBudget::current,
                    planBudget::subscribe);

    src.domain.encounter.published.SavedEncounterPlanListModel savedPlansModel() {
        return savedPlansModel;
    }

    src.domain.encounter.published.EncounterPlanBudgetModel planBudgetModel() {
        return planBudgetModel;
    }

    @Override
    public void publishSavedPlans(SavedEncounterPlansLoadResult result) {
        savedPlans.publish(result == null
                ? EncounterSavedPlanProjectionServiceAssembly.storageUnavailable(PLAN_STORAGE_NOT_REGISTERED)
                : EncounterSavedPlanProjectionServiceAssembly.toPublishedSavedPlans(result));
    }

    @Override
    public void publishPlanBudget(EncounterPlanBudgetLoadResult result) {
        planBudget.publish(result == null
                ? EncounterPlanBudgetProjectionServiceAssembly.budgetUnavailable(PLAN_BUDGET_NOT_REGISTERED)
                : EncounterPlanBudgetProjectionServiceAssembly.toPublishedPlanBudget(result));
    }
}
