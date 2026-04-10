package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RebuildForAnalysisInputChangeInput() {

    public enum Outcome {
        INVALIDATED,
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public record RebuiltForAnalysisInputChangeInput(Outcome outcome) {
    }
}
