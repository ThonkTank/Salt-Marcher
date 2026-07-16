package features.sessionplanner.api;

public enum SessionGenerationPreviewStatus {
    IDLE,
    GENERATING,
    READY,
    STALE,
    APPLYING,
    APPLIED,
    ERROR
}
