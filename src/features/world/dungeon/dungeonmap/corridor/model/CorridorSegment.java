package features.world.dungeon.dungeonmap.corridor.model;

public record CorridorSegment(
        Long memberId,
        int segmentOrdinal,
        Long startNodeId,
        Long endNodeId
) {

    public CorridorSegment {
        if (memberId == null) {
            throw new IllegalArgumentException("Corridor segment member id is required");
        }
        if (segmentOrdinal < 0) {
            throw new IllegalArgumentException("Corridor segment ordinal must be non-negative");
        }
        if (startNodeId == null || endNodeId == null) {
            throw new IllegalArgumentException("Corridor segment endpoints are required");
        }
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("Corridor segment may not connect a node to itself");
        }
    }
}
