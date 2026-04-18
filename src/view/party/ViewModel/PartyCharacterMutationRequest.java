package src.view.party.ViewModel;

import src.domain.party.api.CharacterDraft;

public record PartyCharacterMutationRequest(
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass,
        boolean activeMembership
) {

    CharacterDraft toDomainDraft() {
        return new CharacterDraft(name, playerName, level, passivePerception, armorClass);
    }
}
