package src.domain.party.model.roster.helper;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.party.model.roster.model.PartyCharacter;

public final class PartyRosterXpAllocationHelper {

    public Result apply(List<PartyCharacter> characters, List<Long> ids, int xpDelta) {
        Set<Long> requestedIds = sanitizeRequestedIds(ids, xpDelta);
        if (requestedIds.isEmpty()) {
            return new Result(List.of(), false, false);
        }
        boolean updatedAny = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            if (requestedIds.contains(character.id())) {
                nextCharacters.add(new PartyCharacter(
                        character.id(),
                        character.identity(),
                        character.progress().adjustXp(xpDelta),
                        character.combat(),
                        character.membership(),
                        character.travel()));
                updatedAny = true;
            } else {
                nextCharacters.add(character);
            }
        }
        return new Result(nextCharacters, updatedAny, true);
    }

    private Set<Long> sanitizeRequestedIds(List<Long> ids, int xpDelta) {
        if (ids == null || ids.isEmpty() || xpDelta == 0) {
            return Set.of();
        }
        Set<Long> requestedIds = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                requestedIds.add(id);
            }
        }
        return requestedIds;
    }

    public record Result(
            List<PartyCharacter> characters,
            boolean updatedAny,
            boolean validRequest
    ) {
        public Result {
            characters = characters == null ? List.of() : List.copyOf(characters);
        }

        @Override
        public List<PartyCharacter> characters() {
            return characters == null ? List.of() : List.copyOf(characters);
        }
    }
}
