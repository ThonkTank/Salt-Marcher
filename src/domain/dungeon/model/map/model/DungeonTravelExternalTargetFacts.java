package src.domain.dungeon.model.map.model;

public sealed interface DungeonTravelExternalTargetFacts
        permits DungeonTravelExternalTargetFacts.OverworldTile {

    final class OverworldTile implements DungeonTravelExternalTargetFacts {
        private final long mapId;
        private final long tileId;

        public OverworldTile(
                long mapId,
                long tileId
        ) {
            this.mapId = Math.max(0L, mapId);
            this.tileId = Math.max(0L, tileId);
        }

        public long mapId() {
            return mapId;
        }

        public long tileId() {
            return tileId;
        }
    }
}
