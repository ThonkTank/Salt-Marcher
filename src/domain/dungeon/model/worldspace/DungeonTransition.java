package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.transition.Transition;

public record DungeonTransition(
        long transitionId,
        long mapId,
        String description,
        @Nullable DungeonCell anchor,
        DungeonTransitionDestination destination,
        @Nullable Long linkedTransitionId
) {

    public DungeonTransition {
        Transition coreTransition = coreTransition(
                transitionId,
                mapId,
                description,
                anchor,
                destination,
                linkedTransitionId);
        transitionId = coreTransition.transitionId();
        mapId = coreTransition.mapId();
        description = coreTransition.description();
        anchor = anchorFromCore(coreTransition);
        destination = DungeonTransitionDestination.fromCore(coreTransition.destination());
        linkedTransitionId = coreTransition.linkedTransitionId();
    }

    public String label() {
        return coreTransition().label();
    }

    public boolean isPlaced() {
        return coreTransition().isPlaced();
    }

    public DungeonTransition withDescription(String nextDescription) {
        return fromCore(coreTransition().withDescription(nextDescription));
    }

    public DungeonTransition withDestination(DungeonTransitionDestination nextDestination) {
        Transition nextTransition = coreTransition().withDestination(
                (nextDestination == null
                        ? DungeonTransitionDestination.overworldTileDestination(0L, 0L)
                        : nextDestination).coreDestination());
        return fromCore(nextTransition);
    }

    public DungeonTransition withLinkedTransitionId(@Nullable Long nextLinkedTransitionId) {
        return fromCore(coreTransition().withLinkedTransitionId(nextLinkedTransitionId));
    }

    Transition coreTransition() {
        return coreTransition(transitionId, mapId, description, anchor, destination, linkedTransitionId);
    }

    static DungeonTransition fromCore(Transition transition) {
        return new DungeonTransition(
                transition.transitionId(),
                transition.mapId(),
                transition.description(),
                anchorFromCore(transition),
                DungeonTransitionDestination.fromCore(transition.destination()),
                transition.linkedTransitionId());
    }

    private static Transition coreTransition(
            long transitionId,
            long mapId,
            String description,
            @Nullable DungeonCell anchor,
            DungeonTransitionDestination destination,
            @Nullable Long linkedTransitionId
    ) {
        return new Transition(
                transitionId,
                mapId,
                description,
                anchor == null ? null : anchor.geometry(),
                destination == null
                        ? DungeonTransitionDestination.overworldTileDestination(0L, 0L).coreDestination()
                        : destination.coreDestination(),
                linkedTransitionId);
    }

    private static @Nullable DungeonCell anchorFromCore(Transition transition) {
        return transition.anchor() == null ? null : DungeonCell.fromGeometry(transition.anchor());
    }
}
