package src.domain.party.model.roster.helper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.party.model.roster.model.PartyCharacter;
import src.domain.party.model.roster.model.PartyCharacterCombatProfile;
import src.domain.party.model.roster.model.PartyCharacterDraft;
import src.domain.party.model.roster.model.PartyCharacterIdentity;
import src.domain.party.model.roster.model.PartyMembership;
import src.domain.party.model.roster.model.PartyTravelLocation;

public final class PartyRosterMutationHelper {

    public List<PartyCharacter> updateDraft(List<PartyCharacter> characters, long id, PartyCharacterDraft draft) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            PartyCharacter character = nextCharacters.get(index);
            if (character.id() == id) {
                nextCharacters.set(index, updatedCharacter(character, draft));
                return nextCharacters;
            }
        }
        return List.of();
    }

    public List<PartyCharacter> updateMembership(List<PartyCharacter> characters, long id, PartyMembership membership) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            PartyCharacter character = nextCharacters.get(index);
            if (character.id() == id) {
                nextCharacters.set(index, new PartyCharacter(
                        character.id(),
                        character.identity(),
                        character.progress(),
                        character.combat(),
                        membership,
                        character.travel()));
                return nextCharacters;
            }
        }
        return List.of();
    }

    public List<PartyCharacter> moveCharacters(
            List<PartyCharacter> characters,
            List<Long> ids,
            PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        Set<Long> requestedIds = new LinkedHashSet<>(ids == null ? List.of() : ids);
        if (requestedIds.isEmpty()) {
            return List.of();
        }
        boolean updated = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            PartyCharacter character = nextCharacters.get(index);
            if (requestedIds.contains(character.id())) {
                nextCharacters.set(index, new PartyCharacter(
                        character.id(),
                        character.identity(),
                        character.progress(),
                        character.combat(),
                        character.membership(),
                        new src.domain.party.model.roster.model.PartyCharacterTravelState(location, attachToPartyToken)));
                updated = true;
            }
        }
        return updated ? nextCharacters : List.of();
    }

    public List<PartyCharacter> remove(List<PartyCharacter> characters, long id) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            if (nextCharacters.get(index).id() == id) {
                nextCharacters.remove(index);
                return nextCharacters;
            }
        }
        return List.of();
    }

    private static PartyCharacter updatedCharacter(PartyCharacter character, PartyCharacterDraft draft) {
        return new PartyCharacter(
                character.id(),
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                character.progress().withLevel(draft.level()),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                character.membership(),
                character.travel());
    }
}
