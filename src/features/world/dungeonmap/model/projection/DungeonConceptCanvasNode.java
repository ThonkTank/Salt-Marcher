package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConceptNodeType;

public record DungeonConceptCanvasNode(
        String nodeKey,
        Long mapId,
        Long conceptLevelId,
        DungeonConceptNodeType nodeType,
        String name,
        String iconText,
        DungeonConceptTransitionDirection transitionDirection,
        Integer transitionVariantIndex,
        Integer transitionVariantCount,
        Integer externalNodeIndex,
        Long connectionId,
        Long roomId,
        Long targetLevelId,
        double x,
        double y
) {
    public DungeonConceptCanvasNode {
        if (nodeKey == null || nodeKey.isBlank()) {
            throw new IllegalArgumentException("nodeKey must not be blank");
        }
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (conceptLevelId == null || conceptLevelId <= 0) {
            throw new IllegalArgumentException("conceptLevelId must be positive");
        }
        if (nodeType == null) {
            throw new IllegalArgumentException("nodeType must not be null");
        }
    }

    public String displayName() {
        return name == null || name.isBlank() ? nodeType.label() : name;
    }

    public DungeonConceptCanvasNode withPosition(double updatedX, double updatedY) {
        return new DungeonConceptCanvasNode(
                nodeKey,
                mapId,
                conceptLevelId,
                nodeType,
                name,
                iconText,
                transitionDirection,
                transitionVariantIndex,
                transitionVariantCount,
                externalNodeIndex,
                connectionId,
                roomId,
                targetLevelId,
                updatedX,
                updatedY);
    }
}
