package features.world.dungeonmap.model.projection;

public record DungeonConceptCanvasEdge(
        Long edgeId,
        Long conceptLevelId,
        String fromNodeKey,
        String toNodeKey
) {
    public DungeonConceptCanvasEdge {
        if (edgeId == null || edgeId <= 0) {
            throw new IllegalArgumentException("edgeId must be positive");
        }
        if (conceptLevelId == null || conceptLevelId <= 0) {
            throw new IllegalArgumentException("conceptLevelId must be positive");
        }
        if (fromNodeKey == null || fromNodeKey.isBlank() || toNodeKey == null || toNodeKey.isBlank()) {
            throw new IllegalArgumentException("edge node keys must not be blank");
        }
    }
}
