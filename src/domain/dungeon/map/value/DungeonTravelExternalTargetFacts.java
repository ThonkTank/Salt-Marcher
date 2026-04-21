package src.domain.dungeon.map.value;

public sealed interface DungeonTravelExternalTargetFacts
        permits DungeonTravelExternalTargetFacts.OverworldTile {

    record OverworldTile(
            long mapId,
            long tileId
    ) implements DungeonTravelExternalTargetFacts {
        public OverworldTile {
            mapId = Math.max(0L, mapId);
            tileId = Math.max(0L, tileId);
        }
    }
}
