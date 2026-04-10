package features.party.input;

@SuppressWarnings("unused")
public record AddToPartyInput(Long id) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record AddedToPartyInput(Status status) {
    }
}
