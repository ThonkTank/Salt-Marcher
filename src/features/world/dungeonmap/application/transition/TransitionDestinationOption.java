package features.world.dungeonmap.application.transition;

import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.util.Objects;

public record TransitionDestinationOption(
        DungeonTransitionDestination destination,
        String label
) {
    public TransitionDestinationOption {
        destination = Objects.requireNonNull(destination, "destination");
        label = label == null || label.isBlank() ? defaultLabel(destination) : label.trim();
    }

    private static String defaultLabel(DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return "Overworld-Feld " + overworld.tileId();
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return dungeon.transitionId() == null
                    ? "Dungeon " + dungeon.mapId()
                    : "Dungeon " + dungeon.mapId() + " · Übergang " + dungeon.transitionId();
        }
        return "Übergangsziel";
    }
}
