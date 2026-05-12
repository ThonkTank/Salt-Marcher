package src.domain.party.model.roster.model;

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

    PartyRoster copy() {
        return new PartyRoster(nextCharacterId, characters);
    }

    public PartyRosterProjection projection() {
        return PartyRosterProjection.from(characters);
    }

    public PartyRoster withCharacters(List<PartyCharacter> nextCharacters) {
        return new PartyRoster(nextCharacterId, nextCharacters);
    }

    public PartyRoster withCreatedCharacter(PartyCharacter character) {
        java.util.ArrayList<PartyCharacter> nextCharacters = new java.util.ArrayList<>(characters);
        nextCharacters.add(character);
        return new PartyRoster(nextCharacterId + 1, nextCharacters);
    }
}
