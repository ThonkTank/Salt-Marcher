package features.party.api;

import org.jspecify.annotations.Nullable;

public record UpdateCharacterCommand(long id, CharacterDraft draft) {

    public @Nullable String updateDraftName() {
        return draft == null ? null : draft.name();
    }

    public @Nullable String updateDraftPlayerName() {
        return draft == null ? null : draft.playerName();
    }

    public int updateDraftLevel() {
        return draft == null ? 0 : draft.level();
    }

    public int updateDraftPassivePerception() {
        return draft == null ? 0 : draft.passivePerception();
    }

    public int updateDraftArmorClass() {
        return draft == null ? 0 : draft.armorClass();
    }
}
