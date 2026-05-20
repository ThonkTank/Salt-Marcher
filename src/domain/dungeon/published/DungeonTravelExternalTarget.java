package src.domain.dungeon.published;

public sealed interface DungeonTravelExternalTarget
        permits DungeonTravelExternalTarget.OverworldTile {

    record OverworldTile(
            long mapId,
        long tileId
    ) implements DungeonTravelExternalTarget {
        public OverworldTile {
            mapId = Math.max(1L, mapId);
            tileId = Math.max(0L, tileId);
        }
    }
}
