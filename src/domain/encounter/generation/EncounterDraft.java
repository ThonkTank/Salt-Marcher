package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.List;

public record EncounterDraft(
        String title,
        EncounterDifficultyBand achievedDifficulty,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double multiplier,
        int score,
        int targetAdjustedXp,
        List<EncounterDraftEntry> entries
) {
}
