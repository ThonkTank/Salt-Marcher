package src.domain.encounter.api;

import java.util.List;

public record GeneratedEncounter(
        String title,
        EncounterDifficultyBand achievedDifficulty,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double xpMultiplier,
        List<String> highlights,
        List<EncounterCreature> creatures
) {

    public GeneratedEncounter {
        highlights = highlights == null ? List.of() : List.copyOf(highlights);
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
    }
}
