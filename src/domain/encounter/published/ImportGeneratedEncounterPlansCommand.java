package src.domain.encounter.published;

import java.util.List;

public record ImportGeneratedEncounterPlansCommand(
        long generationId,
        long seed,
        List<GeneratedEncounterDraft> encounters
) {
    public ImportGeneratedEncounterPlansCommand {
        if (generationId <= 0) throw new IllegalArgumentException("generationId must be positive");
        if (seed < 0) throw new IllegalArgumentException("seed must not be negative");
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
    }

    @Override
    public List<GeneratedEncounterDraft> encounters() {
        return List.copyOf(encounters);
    }

    public record GeneratedEncounterDraft(
            int encounterNumber,
            String name,
            String compatibilityLine,
            List<GeneratedCreatureBlock> blocks
    ) {
        public GeneratedEncounterDraft {
            if (encounterNumber <= 0) throw new IllegalArgumentException("encounterNumber must be positive");
            name = name == null || name.isBlank() ? "Generated Encounter " + encounterNumber : name.trim();
            compatibilityLine = compatibilityLine == null ? "" : compatibilityLine.trim();
            blocks = blocks == null ? List.of() : List.copyOf(blocks);
        }
    }

    public record GeneratedCreatureBlock(String role, String challengeRating, int unitXp, int quantity) {
        public GeneratedCreatureBlock {
            role = role == null ? "Standard" : role.trim();
            challengeRating = challengeRating == null ? "" : challengeRating.trim();
            if (unitXp <= 0 || quantity <= 0) {
                throw new IllegalArgumentException("Generated creature block needs positive XP and quantity");
            }
        }
    }
}
