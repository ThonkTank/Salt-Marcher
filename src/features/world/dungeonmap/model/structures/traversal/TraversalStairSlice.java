package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;

public record TraversalStairSlice(
        String segmentKey,
        Long stairId,
        StairPlacement placement
) {
    public TraversalStairSlice {
        segmentKey = segmentKey == null ? "" : segmentKey.trim();
        if (segmentKey.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
    }
}
