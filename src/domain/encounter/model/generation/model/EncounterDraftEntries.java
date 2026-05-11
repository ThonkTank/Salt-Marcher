package src.domain.encounter.model.generation.model;

import java.util.Comparator;
import java.util.List;

public final class EncounterDraftEntries {

    private EncounterDraftEntries() {
    }

    public static List<EncounterDraftEntry> sorted(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .sorted(Comparator.comparingInt(EncounterDraftEntry::xp).reversed()
                        .thenComparing(EncounterDraftEntry::creatureName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
