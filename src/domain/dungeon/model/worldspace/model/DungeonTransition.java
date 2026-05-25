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

    private static @Nullable Long normalizedLinkedTransitionId(@Nullable Long transitionId) {
        return transitionId == null || transitionId <= 0L ? null : transitionId;
    }
}
