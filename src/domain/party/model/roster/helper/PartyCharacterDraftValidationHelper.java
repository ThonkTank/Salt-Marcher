package src.domain.party.model.roster.helper;

import src.domain.party.model.roster.model.PartyCharacterDraft;

public final class PartyCharacterDraftValidationHelper {

    public boolean isValid(PartyCharacterDraft draft) {
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
