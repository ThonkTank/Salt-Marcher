package features.encountertable.input;

@SuppressWarnings("unused")
public record RemoveCreatureInput(Long tableId, Long creatureId) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record RemovedCreatureInput(Status status) {
    }
}
