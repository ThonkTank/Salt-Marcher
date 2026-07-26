package features.party.api;

import org.jspecify.annotations.Nullable;

public record CharacterDraft(
        String name,
        @Nullable String playerName,
        @Nullable Integer level,
        @Nullable Integer passivePerception,
        @Nullable Integer armorClass
) {

    public CharacterDraft {
        name = name == null ? "" : name;
        playerName = playerName == null || playerName.isBlank() ? null : playerName;
    }
}
