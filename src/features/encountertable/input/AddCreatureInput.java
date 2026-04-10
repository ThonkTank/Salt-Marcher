package features.encountertable.input;

@SuppressWarnings("unused")
public record AddCreatureInput(Long tableId, Long creatureId, Integer weight) {

    public enum Status {
        SUCCESS,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record AddedCreatureInput(Status status) {
    }
}
