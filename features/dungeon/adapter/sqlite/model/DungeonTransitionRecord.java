package features.dungeon.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record DungeonTransitionRecord(
        long transitionId,
        long mapId,
        String description,
        @Nullable Integer cellX,
        @Nullable Integer cellY,
        @Nullable Integer levelZ,
        String anchorType,
        @Nullable String anchorEdgeDirection,
        String destinationType,
        @Nullable Long targetOverworldMapId,
        @Nullable Long targetOverworldTileId,
        @Nullable Long targetDungeonMapId,
        @Nullable Long targetTransitionId,
        @Nullable Long linkedTransitionId
) {

    public DungeonTransitionRecord {
        description = description == null ? "" : description.trim();
        anchorType = anchorType == null ? "" : anchorType.trim();
        anchorEdgeDirection = normalizedAnchorEdgeDirection(anchorEdgeDirection);
        destinationType = destinationType == null ? "" : destinationType.trim();
    }

    private static @Nullable String normalizedAnchorEdgeDirection(@Nullable String anchorEdgeDirection) {
        return anchorEdgeDirection == null || anchorEdgeDirection.isBlank()
                ? null
                : anchorEdgeDirection.trim();
    }
}
