package features.encounter.domain.plan;

public record GeneratedEncounterOrigin(
        String engineVersion,
        String preparationIdentity,
        String generationRunIdentity,
        String batchFingerprint,
        int batchCardinality,
        int batchOrder,
        int encounterNumber,
        String intentFingerprint,
        String rosterFingerprint
) {
    public GeneratedEncounterOrigin {
        engineVersion = required(engineVersion);
        preparationIdentity = required(preparationIdentity);
        generationRunIdentity = required(generationRunIdentity);
        batchFingerprint = required(batchFingerprint);
        intentFingerprint = required(intentFingerprint);
        rosterFingerprint = required(rosterFingerprint);
        if (batchCardinality <= 0 || batchOrder < 0 || encounterNumber <= 0) {
            throw new IllegalArgumentException("generated origin order and cardinality are invalid");
        }
    }

    private static String required(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("generated origin value must not be blank");
        }
        return normalized;
    }
}
