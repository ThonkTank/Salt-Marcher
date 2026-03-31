package features.world.dungeonmap.shell.interaction;

import java.util.List;
import java.util.Objects;

public record DungeonSelection(
        DungeonHitSnapshot snapshot,
        List<DungeonHitCandidate> orderedCandidates
) {

    public DungeonSelection {
        snapshot = Objects.requireNonNull(snapshot, "snapshot");
        orderedCandidates = orderedCandidates == null ? List.of() : List.copyOf(orderedCandidates);
        if (orderedCandidates.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Selection candidates must not contain null");
        }
        if (!snapshot.candidates().containsAll(orderedCandidates)) {
            throw new IllegalArgumentException("Selection candidates must originate from the snapshot");
        }
    }

    public DungeonHitCandidate primary() {
        return orderedCandidates.isEmpty() ? null : orderedCandidates.getFirst();
    }

    public boolean isEmpty() {
        return orderedCandidates.isEmpty();
    }
}
