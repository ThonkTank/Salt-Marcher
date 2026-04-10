package features.party.input;

@SuppressWarnings("unused")
public record DeleteCharacterInput(Long id) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record DeletedCharacterInput(Status status) {
    }
}
