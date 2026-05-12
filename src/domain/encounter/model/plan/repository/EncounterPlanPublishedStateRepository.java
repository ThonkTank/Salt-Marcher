package src.domain.encounter.model.plan.repository;

import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.SavedEncounterPlanListResult;

public interface EncounterPlanPublishedStateRepository {

    void publishSavedPlans(SavedEncounterPlanListResult result);

    void publishPlanBudget(EncounterPlanBudgetResult result);
}
