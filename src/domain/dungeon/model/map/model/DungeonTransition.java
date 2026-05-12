package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

public final class DungeonTransition {

    private final long transitionId;
    private final long mapId;
    private final String description;
    private final @Nullable DungeonCell anchor;
    private final DungeonTransitionDestination destination;
    private final @Nullable Long linkedTransitionId;

    public DungeonTransition(
            long transitionId,
            long mapId,
            String description,
            @Nullable DungeonCell anchor,
            DungeonTransitionDestination destination,
            @Nullable Long linkedTransitionId
    ) {
        this.transitionId = transitionId;
        this.mapId = mapId;
        this.description = description == null ? "" : description.trim();
        this.anchor = anchor;
        this.destination = destination == null
                ? DungeonTransitionDestination.overworldTileDestination(0L, 0L)
                : destination;
        this.linkedTransitionId = linkedTransitionId == null || linkedTransitionId <= 0L ? null : linkedTransitionId;
    }

    public long transitionId() {
        return transitionId;
    }

    public long mapId() {
        return mapId;
    }

    public String description() {
        return description;
    }

    public @Nullable DungeonCell anchor() {
        return anchor;
    }

    public DungeonTransitionDestination destination() {
        return destination;
    }

    public @Nullable Long linkedTransitionId() {
        return linkedTransitionId;
    }

    public String label() {
        return "Übergang " + transitionId;
    }

    public boolean isPlaced() {
        return anchor != null;
    }
}
