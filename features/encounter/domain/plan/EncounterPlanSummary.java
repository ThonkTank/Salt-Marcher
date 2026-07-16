package features.encounter.domain.plan;

public record EncounterPlanSummary(long id, String name, String generatedLabel, int creatureCount) {

    public EncounterPlanSummary {
        if (id <= 0) {
            throw new IllegalArgumentException("id must be positive");
        }
        name = normalizeName(name);
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatureCount = Math.max(0, creatureCount);
    }

    private static String normalizeName(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isBlank() ? "Encounter" : normalized;
    }
}
