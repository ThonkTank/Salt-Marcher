package src.domain.encounter.published;

import org.jspecify.annotations.Nullable;

public record SavedEncounterPlanResult(
        SavedEncounterPlanStatus status,
        @Nullable SavedEncounterPlan plan,
        String message
) {
    public SavedEncounterPlanResult {
        status = status == null ? SavedEncounterPlanStatus.STORAGE_ERROR : status;
        message = message == null ? "" : message;
    }
}
