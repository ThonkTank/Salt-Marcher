package src.domain.party.roster.value;

public record PartyCharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
}
