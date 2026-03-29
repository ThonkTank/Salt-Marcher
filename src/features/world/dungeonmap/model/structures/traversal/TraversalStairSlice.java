package features.world.dungeonmap.model.structures.traversal;

public record TraversalStairSlice(
        String segmentKey,
        Long stairId,
        TraversalStairPlacement placement
) {
    public TraversalStairSlice {
        segmentKey = segmentKey == null ? "" : segmentKey.trim();
        if (segmentKey.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
    }
}
