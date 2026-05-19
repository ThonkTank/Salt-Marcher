package src.domain.encounter.model.generation.model;


import java.util.Comparator;
import java.util.List;

public record EncounterDraft(
        String title,
        EncounterDifficultyIntent achievedDifficulty,
        EncounterDraftMetrics metrics,
        List<EncounterDraftEntry> entries
) {

    public EncounterDraft {
        entries = entries == null ? List.of() : List.copyOf(entries);
    }

    public static EncounterDraft create(
            EncounterDifficultyIntent achievedDifficulty,
            EncounterDraftMetrics metrics,
            List<EncounterDraftEntry> entries
    ) {
        List<EncounterDraftEntry> sortedEntries = sorted(entries);
        return new EncounterDraft(titleFrom(sortedEntries), achievedDifficulty, metrics, sortedEntries);
    }

    @Override
    public List<EncounterDraftEntry> entries() {
        return List.copyOf(entries);
    }

    public String canonicalKey() {
        return entries.stream()
                .sorted(Comparator.comparingLong(EncounterDraftEntry::creatureId))
                .map(entry -> entry.creatureId() + "x" + entry.quantity())
                .reduce((left, right) -> left + "|" + right)
                .orElse("");
    }

    private static List<EncounterDraftEntry> sorted(List<EncounterDraftEntry> entries) {
        return (entries == null ? List.<EncounterDraftEntry>of() : entries).stream()
                .sorted(Comparator.comparingInt(EncounterDraftEntry::xp).reversed()
                        .thenComparing(EncounterDraftEntry::creatureName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static String titleFrom(List<EncounterDraftEntry> entries) {
        return entries.stream()
                .map(entry -> entry.quantity() + "x " + entry.creatureName())
                .reduce((left, right) -> left + " + " + right)
                .orElse("Encounter");
    }
}
