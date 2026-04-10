package features.party.input;

@SuppressWarnings("unused")
public record AwardXpToCharacterInput(
        Long id,
        Integer xpAmount
) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record AwardedXpToCharacterInput(Status status) {
    }
}
