package src.domain.encounter.runtime.port;

public interface EncounterPlanPublishedStateRepository<S, B> {

    void publishSavedPlans(S result);

    void publishPlanBudget(B result);
}
