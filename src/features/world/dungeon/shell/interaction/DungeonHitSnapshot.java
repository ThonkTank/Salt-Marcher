package features.world.dungeon.shell.interaction;

import features.world.dungeon.model.interaction.DungeonSelectionRef;

import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

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

    public boolean isEmpty() {
        return candidates.isEmpty();
    }

    public List<DungeonSelectionRef> orderedRefs() {
        return candidates.stream()
                .map(candidate -> candidate.descriptor().ref())
                .filter(Objects::nonNull)
                .toList();
    }

    public DungeonSelectionRef firstRefMatching(Predicate<DungeonSelectionRef> predicate) {
        if (predicate == null) {
            return null;
        }
        for (DungeonSelectionRef ref : orderedRefs()) {
            if (predicate.test(ref)) {
                return ref;
            }
        }
        return null;
    }
}
