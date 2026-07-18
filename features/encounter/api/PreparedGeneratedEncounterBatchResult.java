package features.encounter.api;

import java.util.Optional;

public record PreparedGeneratedEncounterBatchResult(
        GeneratedEncounterBatchStatus status,
        String message,
        Optional<PreparedEncounterBatch> batch
) {
    public PreparedGeneratedEncounterBatchResult {
        if (status == null) {
            throw new IllegalArgumentException("status is required");
        }
        message = message == null ? "" : message;
        batch = batch == null ? Optional.empty() : batch;
        if ((status == GeneratedEncounterBatchStatus.SUCCESS) != batch.isPresent()) {
            throw new IllegalArgumentException("only success may expose a prepared batch");
        }
    }

    public static PreparedGeneratedEncounterBatchResult success(PreparedEncounterBatch batch) {
        return new PreparedGeneratedEncounterBatchResult(
                GeneratedEncounterBatchStatus.SUCCESS, "", Optional.of(batch));
    }

    public static PreparedGeneratedEncounterBatchResult failure(
            GeneratedEncounterBatchStatus status, String message
    ) {
        return new PreparedGeneratedEncounterBatchResult(status, message, Optional.empty());
    }
}
