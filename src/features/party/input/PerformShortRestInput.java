package features.party.input;

@SuppressWarnings("unused")
public record PerformShortRestInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PerformedShortRestInput(Status status) {
    }
}
