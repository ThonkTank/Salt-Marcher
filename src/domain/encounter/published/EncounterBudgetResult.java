package src.domain.encounter.published;

import org.jspecify.annotations.Nullable;

public record EncounterBudgetResult(
        EncounterGenerationStatus status,
        @Nullable EncounterBudgetSummary budget,
        String message
) {

    public EncounterBudgetResult {
        status = status == null ? EncounterGenerationStatus.defaultFailure() : status;
        message = message == null ? "" : message;
    }
}
