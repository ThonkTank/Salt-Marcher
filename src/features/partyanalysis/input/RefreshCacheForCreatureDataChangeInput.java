package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RefreshCacheForCreatureDataChangeInput() {

    public enum Outcome {
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public record RefreshedCacheForCreatureDataChangeInput(Outcome outcome) {
    }
}
