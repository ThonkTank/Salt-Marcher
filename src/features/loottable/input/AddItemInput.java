package features.loottable.input;

@SuppressWarnings("unused")
public record AddItemInput(Long tableId, Long itemId, Integer weight) {

    public enum Status {
        SUCCESS,
        DUPLICATE_ENTRY,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record AddedItemInput(Status status) {
    }
}
