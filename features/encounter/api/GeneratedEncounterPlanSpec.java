package features.encounter.api;

import java.util.List;

public record GeneratedEncounterPlanSpec(
        int encounterNumber,
        String displayLabel,
        List<GeneratedEncounterPlanSlotSpec> slots
) {

    public GeneratedEncounterPlanSpec {
        if (encounterNumber <= 0) {
            throw new IllegalArgumentException("encounterNumber must be positive");
        }
        displayLabel = normalizeLabel(displayLabel, encounterNumber);
        slots = slots == null ? List.of() : List.copyOf(slots);
    }

    @Override
    public List<GeneratedEncounterPlanSlotSpec> slots() {
        return List.copyOf(slots);
    }

    private static String normalizeLabel(String value, int encounterNumber) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? "Generated encounter " + encounterNumber : normalized;
    }
}
