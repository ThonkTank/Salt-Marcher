package features.creatures.api;

import java.util.List;

public record CreatureFactsSnapshotResult(Status status, List<CreatureEncounterCandidate> creatures) {

    public enum Status { SUCCESS, INVALID_REQUEST, STORAGE_FAILURE }

    public CreatureFactsSnapshotResult {
        if (status == null) {
            throw new IllegalArgumentException("status is required");
        }
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        if (status != Status.SUCCESS && !creatures.isEmpty()) {
            throw new IllegalArgumentException("failed query must not expose creature facts");
        }
    }

    @Override
    public List<CreatureEncounterCandidate> creatures() {
        return List.copyOf(creatures);
    }

    public static CreatureFactsSnapshotResult success(List<CreatureEncounterCandidate> creatures) {
        return new CreatureFactsSnapshotResult(Status.SUCCESS, creatures);
    }

    public static CreatureFactsSnapshotResult invalidRequest() {
        return new CreatureFactsSnapshotResult(Status.INVALID_REQUEST, List.of());
    }

    public static CreatureFactsSnapshotResult storageFailure() {
        return new CreatureFactsSnapshotResult(Status.STORAGE_FAILURE, List.of());
    }
}
