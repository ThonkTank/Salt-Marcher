package features.loottable.input;

@SuppressWarnings("unused")
public record CreateTableInput(String name, String description) {

    public enum Status {
        SUCCESS,
        DUPLICATE_NAME,
        VALIDATION_ERROR,
        STORAGE_ERROR
    }

    public record CreatedTableInput(Status status, long tableId) {
    }
}
