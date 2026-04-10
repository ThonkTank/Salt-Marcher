package features.party.input;

@SuppressWarnings("unused")
public record UpdateCharacterInput(
        Long id,
        String name,
        String playerName,
        Integer level,
        Integer passivePerception,
        Integer armorClass
) {

    public enum Status {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record UpdatedCharacterInput(Status status) {
    }
}
