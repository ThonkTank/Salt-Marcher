package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RefreshForAnalysisInputChangeInput() {

    public enum Outcome {
        INVALIDATED,
        REBUILT,
        INVALIDATED_NO_ACTIVE_PARTY,
        STORAGE_ERROR
    }

    public record RefreshedForAnalysisInputChangeInput(Outcome outcome) {
    }
}
