package features.encounter.api;

import java.util.Optional;

public record GeneratedEncounterPlanSummaryEntry(
        long requestedPlanId,
        Status status,
        Optional<GeneratedEncounterPlanSummary> summary
) {
    public enum Status { FOUND, MISSING, UNRESOLVABLE }

    public GeneratedEncounterPlanSummaryEntry {
        if (requestedPlanId <= 0L || status == null) {
            throw new IllegalArgumentException("summary entry identity and status are required");
        }
        summary = summary == null ? Optional.empty() : summary;
        if ((status == Status.FOUND) != summary.isPresent()) {
            throw new IllegalArgumentException("only a found entry may expose a summary");
        }
    }
}
