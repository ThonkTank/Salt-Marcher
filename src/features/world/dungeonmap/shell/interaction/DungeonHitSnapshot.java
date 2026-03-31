package features.world.dungeonmap.shell.interaction;

import java.util.List;
import java.util.Objects;

public record DungeonHitSnapshot(
        DungeonHitProbe probe,
        List<DungeonHitCandidate> candidates
) {

    public DungeonHitSnapshot {
        probe = Objects.requireNonNull(probe, "probe");
        candidates = candidates == null ? List.of() : List.copyOf(candidates);
        if (candidates.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Hit snapshot candidates must not contain null");
        }
    }
}
