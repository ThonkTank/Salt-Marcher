package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.stair.DungeonStair;

public record TraversalStairSlice(
        String segmentKey,
        Long stairId,
        DungeonStair stair
) {
    public TraversalStairSlice {
        segmentKey = segmentKey == null ? "" : segmentKey.trim();
        if (segmentKey.isEmpty()) {
            throw new IllegalArgumentException("segmentKey must not be blank");
        }
    }
}
