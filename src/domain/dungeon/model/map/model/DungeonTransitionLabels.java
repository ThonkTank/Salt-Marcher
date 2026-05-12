package src.domain.dungeon.model.map.model;


final class DungeonTransitionLabels {

    private DungeonTransitionLabels() {
    }

    static String destinationLabel(DungeonTransitionDestination destination) {
        if (destination != null && destination.isOverworldTileDestination()) {
            return "Overworld-Feld " + destination.tileId();
        }
        if (destination != null && destination.isDungeonMapDestination()) {
            return destination.transitionId() == null
                    ? "Dungeon " + destination.mapId()
                    : "Dungeon " + destination.mapId() + " / Übergang " + destination.transitionId();
        }
        return "";
    }
}
