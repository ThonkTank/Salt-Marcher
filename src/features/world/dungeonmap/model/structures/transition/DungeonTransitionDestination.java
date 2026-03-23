package features.world.dungeonmap.model.structures.transition;

public sealed interface DungeonTransitionDestination
        permits DungeonTransitionDestination.DungeonMapDestination, DungeonTransitionDestination.OverworldTileDestination {

    String typeKey();

    record OverworldTileDestination(
            long mapId,
            long tileId
    ) implements DungeonTransitionDestination {

        @Override
        public String typeKey() {
            return "OVERWORLD_TILE";
        }
    }

    record DungeonMapDestination(
            long mapId,
            Long transitionId
    ) implements DungeonTransitionDestination {

        @Override
        public String typeKey() {
            return "DUNGEON_MAP";
        }
    }
}
