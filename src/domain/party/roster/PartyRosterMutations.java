package src.domain.party.roster;

import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;

final class PartyRosterMutations {

    List<PartyCharacter> replace(List<PartyCharacter> characters, long id, UnaryOperator<PartyCharacter> updater) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            if (nextCharacters.get(index).id() != id) {
                continue;
            }
            nextCharacters.set(index, updater.apply(nextCharacters.get(index)));
            return nextCharacters;
        }
        return List.of();
    }

    List<PartyCharacter> remove(List<PartyCharacter> characters, long id) {
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        for (int index = 0; index < nextCharacters.size(); index++) {
            if (nextCharacters.get(index).id() != id) {
                continue;
            }
            nextCharacters.remove(index);
            return nextCharacters;
        }
        return List.of();
    }
}
