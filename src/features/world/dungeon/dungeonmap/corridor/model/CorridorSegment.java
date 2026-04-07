package features.world.dungeon.dungeonmap.corridor.model;

public record CorridorSegment(
        Long segmentId,
        Long startNodeId,
        Long endNodeId
) {

    public CorridorSegment {
        if (segmentId == null) {
            throw new IllegalArgumentException("Corridor segment id is required");
        }
        if (startNodeId == null || endNodeId == null) {
            throw new IllegalArgumentException("Corridor segment endpoints are required");
        }
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("Corridor segment may not connect a node to itself");
        }
    }

    public boolean touches(Long nodeId) {
        return java.util.Objects.equals(startNodeId, nodeId) || java.util.Objects.equals(endNodeId, nodeId);
    }

    public Long otherNodeId(Long nodeId) {
        if (java.util.Objects.equals(startNodeId, nodeId)) {
            return endNodeId;
        }
        if (java.util.Objects.equals(endNodeId, nodeId)) {
            return startNodeId;
        }
        return null;
    }
}
