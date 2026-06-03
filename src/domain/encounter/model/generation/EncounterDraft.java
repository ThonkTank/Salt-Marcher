package src.domain.encounter.model.generation;


import java.util.ArrayList;
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
        List<EncounterDraftEntry> sortedEntries = new ArrayList<>(entries);
        sortedEntries.sort(new Comparator<EncounterDraftEntry>() {
            @Override
            public int compare(EncounterDraftEntry left, EncounterDraftEntry right) {
                return Long.compare(left.creatureId(), right.creatureId());
            }
        });
        StringBuilder key = new StringBuilder();
        for (EncounterDraftEntry entry : sortedEntries) {
            if (!key.isEmpty()) {
                key.append('|');
            }
            key.append(entry.creatureId()).append('x').append(entry.quantity());
        }
        return key.toString();
    }

    private static List<EncounterDraftEntry> sorted(List<EncounterDraftEntry> entries) {
        List<EncounterDraftEntry> sortedEntries = new ArrayList<>(entries == null ? List.of() : entries);
        sortedEntries.sort(new Comparator<EncounterDraftEntry>() {
            @Override
            public int compare(EncounterDraftEntry left, EncounterDraftEntry right) {
                int xpComparison = Integer.compare(right.xp(), left.xp());
                if (xpComparison != 0) {
                    return xpComparison;
                }
                return String.CASE_INSENSITIVE_ORDER.compare(left.creatureName(), right.creatureName());
            }
        });
        return List.copyOf(sortedEntries);
    }

    private static String titleFrom(List<EncounterDraftEntry> entries) {
        if (entries.isEmpty()) {
            return "Encounter";
        }
        StringBuilder title = new StringBuilder();
        for (EncounterDraftEntry entry : entries) {
            if (!title.isEmpty()) {
                title.append(" + ");
            }
            title.append(entry.quantity()).append("x ").append(entry.creatureName());
        }
        return title.toString();
    }
}
