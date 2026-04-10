package features.loottable.input;

@SuppressWarnings("unused")
public record UpdateWeightInput(Long tableId, Long itemId, Integer weight) {

    public enum Status {
        SUCCESS,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record UpdatedWeightInput(Status status) {
    }
}
