package src.domain.party.model.roster.model;

import org.jspecify.annotations.Nullable;

public record PartyCharacterDraft(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass
) {
    public PartyCharacterDraft(
            @Nullable String name,
            @Nullable String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        this.name = name == null ? "" : name.trim();
        this.playerName = playerName == null ? "" : playerName.trim();
        this.level = level;
        this.passivePerception = passivePerception;
        this.armorClass = armorClass;
    }
}
