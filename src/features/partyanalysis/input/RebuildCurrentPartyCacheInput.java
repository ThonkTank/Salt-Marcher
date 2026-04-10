package features.partyanalysis.input;

@SuppressWarnings("unused")
public record RebuildCurrentPartyCacheInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record RebuiltCurrentPartyCacheInput(Status status) {
    }
}
