package features.encounter.api;

public interface EncounterApi {

    void applyState(ApplyEncounterStateCommand command);

    void updatePoolFilters(UpdateEncounterPoolFiltersCommand command);

    void updateTuning(UpdateEncounterTuningCommand command);

    /** Compatibility entry point for consumers that still submit one complete snapshot. */
    void updateBuilderInputs(UpdateEncounterBuilderInputsCommand command);

    void refreshPlanBudget(RefreshEncounterPlanBudgetCommand command);

    default java.util.concurrent.CompletionStage<OpenSavedEncounterPlanResult> openSavedPlan(
            OpenSavedEncounterPlanCommand command
    ) {
        long planId = command == null ? 0L : command.planId();
        if (planId <= 0L) {
            return java.util.concurrent.CompletableFuture.completedFuture(new OpenSavedEncounterPlanResult(
                    OpenSavedEncounterPlanResult.Status.INVALID, 0L, "Encounter-Plan-ID fehlt."));
        }
        applyState(ApplyEncounterStateCommand.openSavedPlan(planId));
        return java.util.concurrent.CompletableFuture.completedFuture(new OpenSavedEncounterPlanResult(
                OpenSavedEncounterPlanResult.Status.OPENED, planId, "Encounter geöffnet."));
    }
}
