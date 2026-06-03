package src.domain.dungeon.model.worldspace;


final class DungeonTransitionLabels {

    private DungeonTransitionLabels() {
    }

    static String destinationLabel(DungeonTransitionDestination destination) {
        return destination == null ? "" : destination.coreDestination().label();
    }
}
