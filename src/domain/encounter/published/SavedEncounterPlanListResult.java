package src.domain.encounter.published;

import java.util.List;

public record SavedEncounterPlanListResult(
        SavedEncounterPlanStatus status,
        List<SavedEncounterPlanSummary> plans,
        String message
) {
    public SavedEncounterPlanListResult {
        status = status == null ? SavedEncounterPlanStatus.STORAGE_ERROR : status;
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }
}
