package features.world.dungeon.dungeonmap.corridor.model;

public record CorridorSegment(
        Long segmentId,
        Long startNodeId,
        Long endNodeId
) {

    public CorridorSegment {
        if (startNodeId == null || endNodeId == null) {
            throw new IllegalArgumentException("Corridor segment endpoints are required");
        }
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("Corridor segment may not connect a node to itself");
        }
        if (startNodeId > endNodeId) {
            Long swap = startNodeId;
            startNodeId = endNodeId;
            endNodeId = swap;
        }
    }
}
