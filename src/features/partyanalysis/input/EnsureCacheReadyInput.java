package features.partyanalysis.input;

@SuppressWarnings("unused")
public record EnsureCacheReadyInput() {

    public enum CacheReadiness {
        READY,
        NOT_READY,
        STORAGE_ERROR
    }

    public record EnsuredCacheReadyInput(CacheReadiness readiness) {
    }
}
