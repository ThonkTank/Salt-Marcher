package features.party.input;

@SuppressWarnings("unused")
public record PerformLongRestInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PerformedLongRestInput(Status status) {
    }
}
