package src.domain.encountertable.published;

import java.util.List;

public record EncounterTableCandidatesResult(
        EncounterTableReadStatus status,
        List<EncounterTableCandidate> candidates
) {

    public EncounterTableCandidatesResult {
        status = status == null ? EncounterTableReadStatus.STORAGE_ERROR : status;
        candidates = candidates == null ? List.of() : List.copyOf(candidates);
    }
}
