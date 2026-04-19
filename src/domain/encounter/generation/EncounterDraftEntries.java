package src.domain.encounter.generation;

import java.util.Comparator;
import java.util.List;

final class EncounterDraftEntries {

    private EncounterDraftEntries() {
    }

    static List<EncounterDraftEntry> sorted(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .sorted(Comparator.comparingInt(EncounterDraftEntry::xp).reversed()
                        .thenComparing(EncounterDraftEntry::creatureName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
