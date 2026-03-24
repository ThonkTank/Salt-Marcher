package features.world.dungeonmap.application.transition;

public record DungeonTransitionEditRequest(
        String description,
        DestinationType destinationType,
        Long targetDungeonMapId,
        Long targetTransitionId,
        Long targetOverworldMapId,
        Long targetOverworldTileId,
        boolean bidirectional
) {

    public enum DestinationType {
        OVERWORLD_TILE,
        DUNGEON_MAP
    }
}
