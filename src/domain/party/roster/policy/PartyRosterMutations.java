package src.domain.party.roster.policy;

import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;
import src.domain.party.roster.entity.PartyCharacter;

public final class PartyRosterMutations {

    public List<PartyCharacter> replace(List<PartyCharacter> characters, long id, UnaryOperator<PartyCharacter> updater) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            if (nextCharacters.get(index).id() == id) {
                nextCharacters.set(index, updater.apply(nextCharacters.get(index)));
                return nextCharacters;
            }
        }
        return List.of();
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
}
