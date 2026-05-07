package src.domain.encounter.plan.port;

import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;

public interface EncounterPlanPublishedStateRepository {

    void publishSavedPlans(SavedEncounterPlanListResult savedPlans);

    void publishPlanBudget(EncounterPlanBudgetResult planBudget);

    SavedEncounterPlanListModel savedPlansModel();

    EncounterPlanBudgetModel planBudgetModel();
}
