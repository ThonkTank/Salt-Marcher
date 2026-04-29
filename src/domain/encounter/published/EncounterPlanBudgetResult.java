package src.domain.encounter.published;

import org.jspecify.annotations.Nullable;

public record EncounterPlanBudgetResult(
        EncounterPlanBudgetStatus status,
        @Nullable EncounterPlanBudgetSummary summary,
        String message
) {

    public EncounterPlanBudgetResult {
        status = status == null ? EncounterPlanBudgetStatus.STORAGE_ERROR : status;
        message = message == null ? "" : message;
    }
}
