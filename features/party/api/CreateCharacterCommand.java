package features.party.api;

import org.jspecify.annotations.Nullable;

public record CreateCharacterCommand(CharacterDraft draft) {

    public @Nullable String createDraftName() {
        return draft == null ? null : draft.name();
    }

    public @Nullable String createDraftPlayerName() {
        return draft == null ? null : draft.playerName();
    }

    public @Nullable Integer createDraftLevel() {
        return draft == null ? null : draft.level();
    }

    public @Nullable Integer createDraftPassivePerception() {
        return draft == null ? null : draft.passivePerception();
    }

    public @Nullable Integer createDraftArmorClass() {
        return draft == null ? null : draft.armorClass();
    }
}
