package features.encounter.api;

public record RefreshEncounterPlanBudgetCommand(long planId) {

    public RefreshEncounterPlanBudgetCommand {
        planId = Math.max(0L, planId);
    }
}
