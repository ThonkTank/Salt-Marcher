package features.encountertable.input;

@SuppressWarnings("unused")
public record UpdateWeightInput(Long tableId, Long creatureId, Integer weight) {

    public enum Status {
        SUCCESS,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record UpdatedWeightInput(Status status) {
    }
}
