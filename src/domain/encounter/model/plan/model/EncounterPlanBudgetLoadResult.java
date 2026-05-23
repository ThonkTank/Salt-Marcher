package src.domain.encounter.model.plan.model;

import org.jspecify.annotations.Nullable;

public record EncounterPlanBudgetLoadResult(
        Outcome outcome,
        @Nullable EncounterPlanBudgetSummaryData summary,
        String message
) {

    public enum Outcome {
        LOADED,
        PLAN_MISSING,
        PARTY_MISSING,
        REJECTED,
        FAILED
    }

    public EncounterPlanBudgetLoadResult {
        outcome = outcome == null ? Outcome.FAILED : outcome;
        if (outcome == Outcome.LOADED && summary == null) {
            throw new IllegalArgumentException("Loaded encounter plan budget requires a summary.");
        }
        message = message == null ? "" : message;
    }

    public static EncounterPlanBudgetLoadResult success(EncounterPlanBudgetSummaryData summary) {
        return new EncounterPlanBudgetLoadResult(Outcome.LOADED, summary, "");
    }

    public static EncounterPlanBudgetLoadResult notFound(String message) {
        return new EncounterPlanBudgetLoadResult(Outcome.PLAN_MISSING, null, message);
    }

    public static EncounterPlanBudgetLoadResult noActiveParty(String message) {
        return new EncounterPlanBudgetLoadResult(Outcome.PARTY_MISSING, null, message);
    }

    public static EncounterPlanBudgetLoadResult invalidRequest(String message) {
        return new EncounterPlanBudgetLoadResult(Outcome.REJECTED, null, message);
    }

    public static EncounterPlanBudgetLoadResult storageError(String message) {
        return new EncounterPlanBudgetLoadResult(Outcome.FAILED, null, message);
    }

    public boolean loadedSuccessfully() {
        return outcome == Outcome.LOADED;
    }

    public boolean planMissing() {
        return outcome == Outcome.PLAN_MISSING;
    }

    public boolean activePartyMissing() {
        return outcome == Outcome.PARTY_MISSING;
    }

    public boolean requestRejected() {
        return outcome == Outcome.REJECTED;
    }

    public boolean storageFailed() {
        return outcome == Outcome.FAILED;
    }
}
