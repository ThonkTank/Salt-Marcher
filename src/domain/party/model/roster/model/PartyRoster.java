package src.domain.party.model.roster.model;

import java.util.ArrayList;
import java.util.List;

public final class PartyRoster {

    private final long nextCharacterId;
    private final List<PartyCharacter> characters;

    public PartyRoster(long nextCharacterId, List<PartyCharacter> characters) {
        this.nextCharacterId = Math.max(1L, nextCharacterId);
        this.characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public long nextCharacterId() {
        return nextCharacterId;
    }

    public List<PartyCharacter> characters() {
        return characters;
    }

    public PartyRosterProjection projection() {
        return PartyRosterProjection.from(characters);
    }

    public PartyRosterMutation createCharacter(PartyCharacterDraft draft, PartyMembership membership) {
        if (draft == null || !draft.isValid()) {
            return PartyRosterMutation.invalidInput(this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.add(PartyCharacter.fromDraft(nextCharacterId, draft, membership));
        return PartyRosterMutation.success(new PartyRoster(nextCharacterId + 1, nextCharacters));
    }

    public PartyRosterMutation updateCharacter(long id, PartyCharacterDraft draft) {
        if (draft == null || !draft.isValid()) {
            return PartyRosterMutation.invalidInput(this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            PartyCharacter character = nextCharacters.get(index);
            if (character.id() == id) {
                nextCharacters.set(index, character.withDraft(draft));
                return PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters));
            }
        }
        return PartyRosterMutation.notFound(this);
    }

    public PartyRosterMutation setMembership(long id, PartyMembership membership) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            PartyCharacter character = nextCharacters.get(index);
            if (character.id() == id) {
                nextCharacters.set(index, character.withMembership(membership));
                return PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters));
            }
        }
        return PartyRosterMutation.notFound(this);
    }

    public PartyRosterMutation deleteCharacter(long id) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            if (nextCharacters.get(index).id() == id) {
                nextCharacters.remove(index);
                return PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters));
            }
        }
        return PartyRosterMutation.notFound(this);
    }

    public PartyRosterMutation adjustXp(List<Long> ids, int xpDelta) {
        PartyRosterSelection selection = PartyRosterSelection.from(ids);
        if (selection.isEmpty() || xpDelta == 0) {
            return PartyRosterMutation.invalidInput(this);
        }
        boolean updatedAny = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            if (selection.contains(character)) {
                nextCharacters.add(character.withAdjustedXp(xpDelta));
                updatedAny = true;
            } else {
                nextCharacters.add(character);
            }
        }
        return updatedAny
                ? PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters))
                : PartyRosterMutation.notFound(this);
    }

    public PartyRosterMutation performRest(PartyRestType restType) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            nextCharacters.add(character.membership().isActive() ? character.withRest(restType) : character);
        }
        return PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters));
    }

    public PartyRosterMutation moveCharacters(
            List<Long> ids,
            PartyTravelLocation location,
            boolean attachToPartyToken
    ) {
        if (location == null) {
            return PartyRosterMutation.invalidInput(this);
        }
        PartyRosterSelection selection = PartyRosterSelection.from(ids);
        if (selection.isEmpty()) {
            return PartyRosterMutation.notFound(this);
        }
        boolean updatedAny = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            if (selection.contains(character)) {
                nextCharacters.add(character.withTravel(location, attachToPartyToken));
                updatedAny = true;
            } else {
                nextCharacters.add(character);
            }
        }
        return updatedAny
                ? PartyRosterMutation.success(new PartyRoster(nextCharacterId, nextCharacters))
                : PartyRosterMutation.notFound(this);
    }
}
