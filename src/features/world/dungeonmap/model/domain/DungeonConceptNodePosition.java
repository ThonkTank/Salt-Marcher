package features.world.dungeonmap.model.domain;

public record DungeonConceptNodePosition(
        Long conceptPositionId,
        Long mapId,
        Long conceptLevelId,
        String nodeKey,
        DungeonConceptNodeType nodeType,
        Integer entranceIndex,
        Long connectionId,
        double x,
        double y
) {
    public DungeonConceptNodePosition {
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (conceptLevelId == null || conceptLevelId <= 0) {
            throw new IllegalArgumentException("conceptLevelId must be positive");
        }
        if (nodeKey == null || nodeKey.isBlank()) {
            throw new IllegalArgumentException("nodeKey must not be blank");
        }
        if (nodeType == null) {
            throw new IllegalArgumentException("nodeType must not be null");
        }
    }
}
