package src.data.dungeon.model;

import org.jspecify.annotations.Nullable;

public record DungeonTransitionRecord(
        long transitionId,
        long mapId,
        String description,
        @Nullable Integer cellX,
        @Nullable Integer cellY,
        @Nullable Integer levelZ,
        String destinationType,
        @Nullable Long targetOverworldMapId,
        @Nullable Long targetOverworldTileId,
        @Nullable Long targetDungeonMapId,
        @Nullable Long targetTransitionId,
        @Nullable Long linkedTransitionId
) {

    public DungeonTransitionRecord {
        description = description == null ? "" : description.trim();
        destinationType = destinationType == null || destinationType.isBlank()
                ? "OVERWORLD_TILE"
                : destinationType.trim();
    }
}
