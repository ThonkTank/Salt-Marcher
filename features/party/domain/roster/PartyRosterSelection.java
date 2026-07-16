package features.party.domain.roster;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

record PartyRosterSelection(Set<Long> ids) {

    PartyRosterSelection {
        ids = ids == null ? Set.of() : Set.copyOf(ids);
    }

    static PartyRosterSelection from(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new PartyRosterSelection(Set.of());
        }
        Set<Long> requestedIds = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                requestedIds.add(id);
            }
        }
        return new PartyRosterSelection(requestedIds);
    }

    boolean isEmpty() {
        return ids.isEmpty();
    }

    boolean contains(PartyCharacter character) {
        return character != null && ids.contains(character.id());
    }
}
