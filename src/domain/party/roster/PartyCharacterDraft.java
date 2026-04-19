package src.domain.party.roster;

public record PartyCharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
}
