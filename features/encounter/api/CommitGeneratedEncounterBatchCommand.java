package features.encounter.api;

public record CommitGeneratedEncounterBatchCommand(PreparedEncounterBatch batch) {
    public CommitGeneratedEncounterBatchCommand {
        if (batch == null) {
            throw new IllegalArgumentException("batch is required");
        }
    }
}
