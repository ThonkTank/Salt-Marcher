package src.domain.encounter.model.plan.repository;

import src.domain.encounter.model.plan.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.SavedEncounterPlansLoadResult;

public interface EncounterPlanPublishedStateRepository {

    void publishSavedPlans(SavedEncounterPlansLoadResult result);

    void publishPlanBudget(EncounterPlanBudgetLoadResult result);
}
