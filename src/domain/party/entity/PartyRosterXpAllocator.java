package src.domain.party.entity;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class PartyRosterXpAllocator {

    Result apply(List<PartyCharacter> characters, List<Long> ids, int xpPerCharacter) {
        Set<Long> requestedIds = sanitizeRequestedIds(ids, xpPerCharacter);
        if (requestedIds.isEmpty()) {
            return new Result(List.of(), false, false);
        }
        boolean updatedAny = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            if (requestedIds.contains(character.id())) {
                nextCharacters.add(character.awardXp(xpPerCharacter));
                updatedAny = true;
            } else {
                nextCharacters.add(character);
            }
        }
        return new Result(nextCharacters, updatedAny, true);
    }

    private Set<Long> sanitizeRequestedIds(List<Long> ids, int xpPerCharacter) {
        if (ids == null || ids.isEmpty() || xpPerCharacter <= 0) {
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

    record Result(
            List<PartyCharacter> characters,
            boolean updatedAny,
            boolean validRequest
    ) {
    }
}
