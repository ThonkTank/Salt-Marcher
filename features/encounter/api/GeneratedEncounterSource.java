package features.encounter.api;

public record GeneratedEncounterSource(
        String engineVersion,
        String preparationIdentity,
        String generationRunIdentity
) {
    public GeneratedEncounterSource {
        engineVersion = required(engineVersion, "engineVersion");
        preparationIdentity = required(preparationIdentity, "preparationIdentity");
        generationRunIdentity = required(generationRunIdentity, "generationRunIdentity");
    }

    private static String required(String value, String name) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return normalized;
    }
}
