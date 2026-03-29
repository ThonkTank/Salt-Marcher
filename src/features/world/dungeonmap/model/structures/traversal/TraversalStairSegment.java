package features.world.dungeonmap.model.structures.traversal;

import java.util.Objects;

public record TraversalStairSegment(
        String segmentKey,
        Long stairId
) {
    public TraversalStairSegment {
        segmentKey = normalizeKey(segmentKey);
    }

    private static String normalizeKey(String segmentKey) {
        String normalized = Objects.requireNonNull(segmentKey, "segmentKey").trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
        return normalized;
    }
}
