package src.domain.party.published;

public record UpdateCharacterCommand(long id, CharacterDraft draft) {

    public String updateDraftName() {
        return draft == null ? null : draft.name();
    }

    public String updateDraftPlayerName() {
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
