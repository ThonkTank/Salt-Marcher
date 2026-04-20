package src.domain.encounter.generation.value;


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

    @Override
    public List<EncounterDraftEntry> entries() {
        return List.copyOf(entries);
    }
}
