package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

public record DungeonTransition(
        long transitionId,
        long mapId,
        String description,
        @Nullable DungeonCell anchor,
        DungeonTransitionDestination destination,
        @Nullable Long linkedTransitionId
) {

    public DungeonTransition {
        description = description == null ? "" : description.trim();
        destination = destination == null
                ? DungeonTransitionDestination.overworldTileDestination(0L, 0L)
                : destination;
        linkedTransitionId = normalizedLinkedTransitionId(linkedTransitionId);
    }

    public String label() {
        return "Übergang " + transitionId;
    }

    public boolean isPlaced() {
        return anchor != null;
    }

    public DungeonTransition withDescription(String nextDescription) {
        return new DungeonTransition(
                transitionId,
                mapId,
                nextDescription,
                anchor,
                destination,
                linkedTransitionId);
    }

    public DungeonTransition withDestination(DungeonTransitionDestination nextDestination) {
        return new DungeonTransition(
                transitionId,
                mapId,
                description,
                anchor,
                nextDestination,
                linkedTransitionId);
    }

    public DungeonTransition withLinkedTransitionId(@Nullable Long nextLinkedTransitionId) {
        return new DungeonTransition(
                transitionId,
                mapId,
                description,
                anchor,
                destination,
                nextLinkedTransitionId);
    }

    private static @Nullable Long normalizedLinkedTransitionId(@Nullable Long transitionId) {
        return transitionId == null || transitionId <= 0L ? null : transitionId;
    }
}
