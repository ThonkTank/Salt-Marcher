package src.domain.encounter.model.plan;

import java.util.List;

public record SavedEncounterPlansLoadResult(
        boolean loadedSuccessfully,
        List<EncounterPlanSummary> plans,
        String message
) {

    public SavedEncounterPlansLoadResult {
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }

    public static SavedEncounterPlansLoadResult success(List<EncounterPlanSummary> plans) {
        return new SavedEncounterPlansLoadResult(true, plans, "");
    }

    public static SavedEncounterPlansLoadResult storageError(String message) {
        return new SavedEncounterPlansLoadResult(false, List.of(), message);
    }
}
