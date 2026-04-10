package features.encountertable.input;

@SuppressWarnings("unused")
public record DeleteTableInput(Long tableId) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record DeletedTableInput(Status status) {
    }
}
