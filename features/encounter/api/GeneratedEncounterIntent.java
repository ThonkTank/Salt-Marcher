package features.encounter.api;

import java.util.List;

public record GeneratedEncounterIntent(
        int encounterNumber,
        String displayLabel,
        long targetXp,
        GeneratedEncounterDifficulty difficulty,
        List<GeneratedEncounterBlock> blocks
) {
    public GeneratedEncounterIntent {
        if (encounterNumber <= 0 || targetXp <= 0L) {
            throw new IllegalArgumentException("encounter number and target XP must be positive");
        }
        displayLabel = displayLabel == null ? "" : displayLabel.trim();
        if (displayLabel.isEmpty()) {
            throw new IllegalArgumentException("displayLabel must not be blank");
        }
        if (difficulty == null) {
            throw new IllegalArgumentException("difficulty is required");
        }
        blocks = blocks == null ? List.of() : List.copyOf(blocks);
        if (blocks.isEmpty() || blocks.stream().anyMatch(java.util.Objects::isNull)) {
            throw new IllegalArgumentException("blocks must be non-empty");
        }
    }

    @Override
    public List<GeneratedEncounterBlock> blocks() {
        return List.copyOf(blocks);
    }
}
