package src.domain.encounter.published;

public record LoadEncounterPlanBudgetQuery(long planId) {

    public LoadEncounterPlanBudgetQuery {
        planId = Math.max(0L, planId);
    }
}
