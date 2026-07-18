package features.encounter.api;

import java.util.List;

public record GeneratedEncounterPlanSummary(
        long planId,
        String label,
        List<PreparedEncounterCreature> roster,
        int creatureCount,
        long baseXp,
        long adjustedXp,
        GeneratedEncounterDifficulty difficulty,
        String displaySummary
) {
    public GeneratedEncounterPlanSummary {
        if (planId < 0L || creatureCount <= 0 || baseXp <= 0L || adjustedXp <= 0L || difficulty == null) {
            throw new IllegalArgumentException("summary values are invalid");
        }
        label = label == null ? "" : label.trim();
        roster = roster == null ? List.of() : List.copyOf(roster);
        displaySummary = displaySummary == null ? "" : displaySummary.trim();
        if (label.isEmpty() || roster.isEmpty() || displaySummary.isEmpty()) {
            throw new IllegalArgumentException("summary text and roster must be present");
        }
    }

    @Override
    public List<PreparedEncounterCreature> roster() {
        return List.copyOf(roster);
    }
}
