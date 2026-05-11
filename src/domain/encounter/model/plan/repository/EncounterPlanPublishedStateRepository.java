package src.domain.encounter.model.plan.repository;

public interface EncounterPlanPublishedStateRepository<S, B> {

    void publishSavedPlans(S result);

    void publishPlanBudget(B result);
}
