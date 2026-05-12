package src.domain.encounter.model.plan.model;

import java.util.List;

public record SavedEncounterPlansLoadResult(
        Status status,
        List<EncounterPlanSummary> plans,
        String message
) {

    public SavedEncounterPlansLoadResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }

    public static SavedEncounterPlansLoadResult success(List<EncounterPlanSummary> plans) {
        return new SavedEncounterPlansLoadResult(Status.SUCCESS, plans, "");
    }

    public static SavedEncounterPlansLoadResult storageError(String message) {
        return new SavedEncounterPlansLoadResult(Status.STORAGE_ERROR, List.of(), message);
    }

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }
}
