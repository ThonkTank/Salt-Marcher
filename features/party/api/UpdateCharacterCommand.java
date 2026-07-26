package features.party.api;

import org.jspecify.annotations.Nullable;

public record UpdateCharacterCommand(long id, CharacterDraft draft) {

    public @Nullable String updateDraftName() {
        return draft == null ? null : draft.name();
    }

    public @Nullable String updateDraftPlayerName() {
        return draft == null ? null : draft.playerName();
    }

    public @Nullable Integer updateDraftLevel() {
        return draft == null ? null : draft.level();
    }

    public @Nullable Integer updateDraftPassivePerception() {
        return draft == null ? null : draft.passivePerception();
    }

    public @Nullable Integer updateDraftArmorClass() {
        return draft == null ? null : draft.armorClass();
    }
}
