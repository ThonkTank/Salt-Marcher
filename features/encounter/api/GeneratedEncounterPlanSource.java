package features.encounter.api;

public record GeneratedEncounterPlanSource(String engineVersion, String generationId) {

    public GeneratedEncounterPlanSource {
        engineVersion = requireText(engineVersion, "engineVersion");
        generationId = requireText(generationId, "generationId");
    }

    private static String requireText(String value, String name) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return normalized;
    }
}
