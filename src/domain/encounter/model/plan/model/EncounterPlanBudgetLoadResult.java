package src.domain.encounter.model.plan.model;

import org.jspecify.annotations.Nullable;

public record EncounterPlanBudgetLoadResult(
        Status status,
        @Nullable EncounterPlanBudgetSummaryData summary,
        String message
) {

    public EncounterPlanBudgetLoadResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        message = message == null ? "" : message;
    }

    public static EncounterPlanBudgetLoadResult success(EncounterPlanBudgetSummaryData summary) {
        return new EncounterPlanBudgetLoadResult(Status.SUCCESS, summary, "");
    }

    public static EncounterPlanBudgetLoadResult notFound(String message) {
        return new EncounterPlanBudgetLoadResult(Status.NOT_FOUND, null, message);
    }

    public static EncounterPlanBudgetLoadResult noActiveParty(String message) {
        return new EncounterPlanBudgetLoadResult(Status.NO_ACTIVE_PARTY, null, message);
    }

    public static EncounterPlanBudgetLoadResult invalidRequest(String message) {
        return new EncounterPlanBudgetLoadResult(Status.INVALID_REQUEST, null, message);
    }

    public static EncounterPlanBudgetLoadResult storageError(String message) {
        return new EncounterPlanBudgetLoadResult(Status.STORAGE_ERROR, null, message);
    }

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        NO_ACTIVE_PARTY,
        INVALID_REQUEST,
        STORAGE_ERROR
    }
}
