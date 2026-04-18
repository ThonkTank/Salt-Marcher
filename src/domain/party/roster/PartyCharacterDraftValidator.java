package src.domain.party.roster;

import src.domain.party.api.CharacterDraft;

final class PartyCharacterDraftValidator {

    boolean isValid(CharacterDraft draft) {
        return draft != null
                && draft.name() != null
                && !draft.name().trim().isEmpty()
                && draft.level() >= 1
                && draft.level() <= 20
                && draft.passivePerception() >= 1
                && draft.passivePerception() <= 99
                && draft.armorClass() >= 1
                && draft.armorClass() <= 99;
    }
}
