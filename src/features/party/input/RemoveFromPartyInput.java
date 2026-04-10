package features.party.input;

@SuppressWarnings("unused")
public record RemoveFromPartyInput(Long id) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record RemovedFromPartyInput(Status status) {
    }
}
