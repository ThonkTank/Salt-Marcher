package features.encounter.api;

import java.util.List;

public record PreparedEncounterBatch(
        GeneratedEncounterSource source,
        String batchFingerprint,
        List<PreparedEncounterRoster> rosters
) {
    public PreparedEncounterBatch {
        if (source == null) {
            throw new IllegalArgumentException("source is required");
        }
        batchFingerprint = batchFingerprint == null ? "" : batchFingerprint.trim();
        rosters = rosters == null ? List.of() : List.copyOf(rosters);
        if (batchFingerprint.isEmpty() || rosters.isEmpty()) {
            throw new IllegalArgumentException("batch fingerprint and rosters are required");
        }
    }

    @Override
    public List<PreparedEncounterRoster> rosters() {
        return List.copyOf(rosters);
    }
}
