package features.party.input;

@SuppressWarnings("unused")
public record CreateCharacterAndAddToPartyInput(
        String name,
        String playerName,
        Integer level,
        Integer passivePerception,
        Integer armorClass
) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record CreatedCharacterAndAddedToPartyInput(Status status) {
    }
}
