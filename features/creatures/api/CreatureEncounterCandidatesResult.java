package features.creatures.api;

import java.util.List;

public record CreatureEncounterCandidatesResult(
        CreatureQueryStatus status,
        List<CreatureEncounterCandidate> candidates
) {

    public CreatureEncounterCandidatesResult {
        status = status == null ? CreatureQueryStatus.storageErrorStatus() : status;
        candidates = candidates == null ? List.of() : List.copyOf(candidates);
    }
}
