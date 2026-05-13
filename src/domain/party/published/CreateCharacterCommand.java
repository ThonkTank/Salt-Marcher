package src.domain.party.published;

import org.jspecify.annotations.Nullable;

public record CreateCharacterCommand(CharacterDraft draft, MembershipState membership) {

    public @Nullable String createDraftName() {
        return draft == null ? null : draft.name();
    }

    public @Nullable String createDraftPlayerName() {
        return draft == null ? null : draft.playerName();
    }

    public int createDraftLevel() {
        return draft == null ? 0 : draft.level();
    }

    public int createDraftPassivePerception() {
        return draft == null ? 0 : draft.passivePerception();
    }

    public int createDraftArmorClass() {
        return draft == null ? 0 : draft.armorClass();
    }

    public String membershipName() {
        return membership == null ? "RESERVE" : membership.name();
    }
}
