package features.encounter.api;

public record OpenSavedEncounterPlanResult(Status status, long planId, String message) {

    public OpenSavedEncounterPlanResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        planId = Math.max(0L, planId);
        message = message == null ? "" : message;
    }

    public enum Status {
        OPENED,
        CONFIRMATION_REQUIRED,
        INVALID,
        STORAGE_ERROR
    }
}
