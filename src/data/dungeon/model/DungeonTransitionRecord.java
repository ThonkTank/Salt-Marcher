package src.data.dungeon.model;

public record DungeonTransitionRecord(
        long transitionId,
        long mapId,
        String description,
        Integer cellX,
        Integer cellY,
        Integer levelZ,
        String destinationType,
        Long targetOverworldMapId,
        Long targetOverworldTileId,
        Long targetDungeonMapId,
        Long targetTransitionId,
        Long linkedTransitionId
) {

    public DungeonTransitionRecord {
        description = description == null ? "" : description.trim();
        destinationType = destinationType == null || destinationType.isBlank()
                ? "OVERWORLD_TILE"
                : destinationType.trim();
    }
}
