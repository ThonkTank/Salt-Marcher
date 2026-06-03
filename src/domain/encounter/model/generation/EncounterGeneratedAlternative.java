package src.domain.encounter.model.generation;

import java.util.List;

public record EncounterGeneratedAlternative(
        String title,
        EncounterDifficultyIntent achievedDifficulty,
        int adjustedXp,
        List<GeneratedEncounterCreatureData> creatures
) {

    public EncounterGeneratedAlternative {
        title = title == null ? "" : title;
        achievedDifficulty = achievedDifficulty == null
                ? EncounterDifficultyIntent.defaultIntent()
                : achievedDifficulty;
        adjustedXp = Math.max(0, adjustedXp);
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
