package features.world.dungeonmap.shell.interaction;

import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;

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

    public DungeonSelectionKey primaryKey() {
        return primary() == null ? null : primary().descriptor().subject().selectionKey();
    }

    public boolean isEmpty() {
        return orderedCandidates.isEmpty();
    }

    public List<DungeonHitSubject> orderedSubjects() {
        return orderedCandidates.stream()
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
