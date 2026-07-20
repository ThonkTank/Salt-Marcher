package features.encounter.api;

import java.util.List;

public record CommittedGeneratedEncounterBatchResult(
        GeneratedEncounterBatchStatus status,
        String message,
        List<CommittedGeneratedEncounterMapping> mappings
) {
    public CommittedGeneratedEncounterBatchResult {
        if (status == null) {
            throw new IllegalArgumentException("status is required");
        }
        message = message == null ? "" : message;
        mappings = mappings == null ? List.of() : List.copyOf(mappings);
        if ((status == GeneratedEncounterBatchStatus.SUCCESS) != !mappings.isEmpty()) {
            throw new IllegalArgumentException("only success may expose mappings");
        }
    }

    @Override
    public List<CommittedGeneratedEncounterMapping> mappings() {
        return List.copyOf(mappings);
    }

    public static CommittedGeneratedEncounterBatchResult success(
            List<CommittedGeneratedEncounterMapping> mappings
    ) {
        return new CommittedGeneratedEncounterBatchResult(
                GeneratedEncounterBatchStatus.SUCCESS, "", mappings);
    }

    public static CommittedGeneratedEncounterBatchResult failure(
            GeneratedEncounterBatchStatus status, String message
    ) {
        return new CommittedGeneratedEncounterBatchResult(status, message, List.of());
    }
}
