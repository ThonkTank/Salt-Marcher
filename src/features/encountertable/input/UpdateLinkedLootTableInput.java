package features.encountertable.input;

@SuppressWarnings("unused")
public record UpdateLinkedLootTableInput(Long tableId, Long lootTableId) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record UpdatedLinkedLootTableInput(Status status) {
    }
}
