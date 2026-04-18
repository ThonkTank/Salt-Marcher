package src.domain.party.api;

public record CharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
}
