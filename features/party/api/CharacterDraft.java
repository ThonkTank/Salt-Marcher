package features.party.api;

public record CharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {

    public CharacterDraft {
        name = name == null ? "" : name;
        playerName = playerName == null ? "" : playerName;
        level = Math.max(0, level);
        passivePerception = Math.max(0, passivePerception);
        armorClass = Math.max(0, armorClass);
    }
}
