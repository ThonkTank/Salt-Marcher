package features.encounter.api;

public record EncounterRuntimeContextSyncResult(
        Status status,
        long acceptedRevision,
        String message
) {

    public EncounterRuntimeContextSyncResult {
        status = status == null ? Status.STORAGE_ERROR : status;
        acceptedRevision = Math.max(0L, acceptedRevision);
        message = message == null ? "" : message;
    }

    public enum Status {
        APPLIED,
        STALE_IGNORED,
        INVALID,
        STORAGE_ERROR
    }
}
