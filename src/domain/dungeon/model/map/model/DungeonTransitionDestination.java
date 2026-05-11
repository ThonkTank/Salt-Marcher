package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonTransitionDestination
        permits DungeonTransitionDestination.DungeonMapDestination,
        DungeonTransitionDestination.OverworldTileDestination {

    String typeKey();

    final class OverworldTileDestination implements DungeonTransitionDestination {
        private final long mapId;
        private final long tileId;

        public OverworldTileDestination(
                long mapId,
                long tileId
        ) {
            this.mapId = mapId;
            this.tileId = tileId;
        }

        public long mapId() {
            return mapId;
        }

        public long tileId() {
            return tileId;
        }

        @Override
        public String typeKey() {
            return "OVERWORLD_TILE";
        }
    }

    record DungeonMapDestination(
            long mapId,
            @Nullable Long transitionId
    ) implements DungeonTransitionDestination {

        @Override
        public String typeKey() {
            return "DUNGEON_MAP";
        }
    }
}
