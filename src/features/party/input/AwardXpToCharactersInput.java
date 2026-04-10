package features.party.input;

import java.util.List;

@SuppressWarnings("unused")
public record AwardXpToCharactersInput(
        List<Long> ids,
        Integer xpPerCharacter
) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record AwardedXpToCharactersInput(Status status) {
    }
}
