package features.partyanalysis.input;

@SuppressWarnings("unused")
public record InvalidateCurrentPartyCacheInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record InvalidatedCurrentPartyCacheInput(Status status) {
    }
}
