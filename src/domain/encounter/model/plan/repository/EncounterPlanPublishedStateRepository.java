package src.domain.encounter.model.plan.repository;

import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;

public interface EncounterPlanPublishedStateRepository {

    void publishSavedPlans(SavedEncounterPlansLoadResult result);

    void publishPlanBudget(EncounterPlanBudgetLoadResult result);
}
