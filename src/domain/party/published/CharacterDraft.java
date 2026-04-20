package src.domain.party.published;

public record CharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
}
