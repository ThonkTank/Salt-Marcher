package features.world.dungeonmap.shell.interaction;

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

    public List<DungeonHitSubject> orderedSubjects() {
        return candidates.stream()
                .map(candidate -> candidate.descriptor().subject())
                .filter(Objects::nonNull)
                .toList();
    }

    public DungeonHitSubject firstSubjectMatching(Predicate<DungeonHitSubject> predicate) {
        if (predicate == null) {
            return null;
        }
        for (DungeonHitSubject subject : orderedSubjects()) {
            if (predicate.test(subject)) {
                return subject;
            }
        }
        return null;
    }
}
