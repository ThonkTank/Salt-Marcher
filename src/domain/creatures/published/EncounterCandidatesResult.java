package src.domain.creatures.published;

import java.util.List;

public record EncounterCandidatesResult(
        CreatureQueryStatus status,
        List<EncounterCandidate> candidates
) {
    public EncounterCandidatesResult {
        candidates = candidates == null ? List.of() : List.copyOf(candidates);
    }
}
