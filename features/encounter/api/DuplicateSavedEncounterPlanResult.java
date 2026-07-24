package features.encounter.api;

public record DuplicateSavedEncounterPlanResult(Status status, long planId, String message) {
    public DuplicateSavedEncounterPlanResult {
        status = status == null ? Status.STORAGE_FAILURE : status;
        planId = Math.max(0L, planId);
        message = message == null ? "" : message.trim();
    }

    public enum Status { DUPLICATED, NOT_FOUND, INVALID, STORAGE_FAILURE }
}
