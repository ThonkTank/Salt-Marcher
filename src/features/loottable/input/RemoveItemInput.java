package features.loottable.input;

@SuppressWarnings("unused")
public record RemoveItemInput(Long tableId, Long itemId) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record RemovedItemInput(Status status) {
    }
}
