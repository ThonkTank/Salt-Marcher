package features.encounter.adapter.sqlite.model;

public record GeneratedEncounterOriginRecord(
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
}
