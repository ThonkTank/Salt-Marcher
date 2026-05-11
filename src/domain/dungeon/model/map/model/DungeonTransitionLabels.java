package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonTransitionDestination;

final class DungeonTransitionLabels {

    private DungeonTransitionLabels() {
    }

    static String destinationLabel(DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return "Overworld-Feld " + overworld.tileId();
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return dungeon.transitionId() == null
                    ? "Dungeon " + dungeon.mapId()
                    : "Dungeon " + dungeon.mapId() + " / Übergang " + dungeon.transitionId();
        }
        return "";
    }
}
