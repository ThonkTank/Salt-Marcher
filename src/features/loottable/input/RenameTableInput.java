package features.loottable.input;

@SuppressWarnings("unused")
public record RenameTableInput(Long tableId, String name) {

    public enum Status {
        SUCCESS,
        DUPLICATE_NAME,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record RenamedTableInput(Status status) {
    }
}
