package src.domain.encounter.generation.value;

import java.util.Comparator;
import java.util.List;

final class EncounterDraftKey {

    private EncounterDraftKey() {
    }

    static String normalized(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .sorted(Comparator.comparingLong(EncounterDraftEntry::creatureId))
                .map(entry -> entry.creatureId() + "x" + entry.quantity())
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }
}
