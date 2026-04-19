package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;

public record EncounterDraft(
        String title,
        EncounterDifficultyBand achievedDifficulty,
        EncounterDraftMetrics metrics,
        List<EncounterDraftEntry> entries
) {
}
