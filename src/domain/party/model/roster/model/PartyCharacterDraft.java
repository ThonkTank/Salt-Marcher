package src.domain.party.model.roster.model;

public record PartyCharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
    public PartyCharacterDraft {
        name = name == null ? "" : name.trim();
        playerName = playerName == null ? "" : playerName.trim();
    }
}
