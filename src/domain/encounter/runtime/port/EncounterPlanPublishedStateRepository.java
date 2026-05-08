package src.domain.encounter.runtime.port;

import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;

public interface EncounterPlanPublishedStateRepository {

    void publishSavedPlans(ListSavedEncounterPlansUseCase.Result result);

    void publishPlanBudget(LoadEncounterPlanBudgetUseCase.Result result);
}
