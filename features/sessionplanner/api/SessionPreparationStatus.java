package features.sessionplanner.api;

public enum SessionPreparationStatus {
    IDLE,
    CONFIRMING_REPLACEMENT,
    GENERATING,
    RESOLVING_ENCOUNTERS,
    SAVING,
    READY,
    INVALID,
    FAILED,
    CANCELLED
}
