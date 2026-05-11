package src.domain.encounter.published;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;

public record GeneratedEncounter(
        String title,
        EncounterDifficultyIntent achievedDifficulty,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double xpMultiplier,
        List<String> highlights,
        List<EncounterCreature> creatures
) {

    public GeneratedEncounter {
        achievedDifficulty = achievedDifficulty == null ? EncounterDifficultyIntent.defaultIntent() : achievedDifficulty;
        highlights = highlights == null ? List.of() : List.copyOf(highlights);
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
