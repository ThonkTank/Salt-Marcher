package features.encounter.api;

import java.util.List;

public record GeneratedEncounterPlanSummaryBatchResult(
        GeneratedEncounterBatchStatus status,
        String message,
        List<GeneratedEncounterPlanSummaryEntry> entries
) {
    public GeneratedEncounterPlanSummaryBatchResult {
        if (status == null) {
            throw new IllegalArgumentException("status is required");
        }
        message = message == null ? "" : message;
        entries = entries == null ? List.of() : List.copyOf(entries);
        if (status != GeneratedEncounterBatchStatus.SUCCESS && !entries.isEmpty()) {
            throw new IllegalArgumentException("failed summary read must not expose entries");
        }
    }

    @Override
    public List<GeneratedEncounterPlanSummaryEntry> entries() {
        return List.copyOf(entries);
    }

    public static GeneratedEncounterPlanSummaryBatchResult success(
            List<GeneratedEncounterPlanSummaryEntry> entries
    ) {
        return new GeneratedEncounterPlanSummaryBatchResult(
                GeneratedEncounterBatchStatus.SUCCESS, "", entries);
    }

    public static GeneratedEncounterPlanSummaryBatchResult failure(
            GeneratedEncounterBatchStatus status, String message
    ) {
        return new GeneratedEncounterPlanSummaryBatchResult(status, message, List.of());
    }
}
