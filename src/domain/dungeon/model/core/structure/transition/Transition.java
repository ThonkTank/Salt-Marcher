package src.domain.dungeon.model.core.structure.transition;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;

public record Transition(
        long transitionId,
        long mapId,
        String description,
        @Nullable Cell anchor,
        TransitionDestination destination,
        @Nullable Long linkedTransitionId
) {
    private static final String TRANSITION_LABEL = "Übergang ";

    public Transition {
        transitionId = Math.max(0L, transitionId);
        mapId = Math.max(0L, mapId);
        description = description == null ? "" : description.trim();
        destination = destination == null ? TransitionDestination.overworldTile(0L, 0L) : destination;
        linkedTransitionId = normalizedLinkedTransitionId(linkedTransitionId);
    }

    public String label() {
        return TRANSITION_LABEL + transitionId;
    }

    public boolean isPlaced() {
        return anchor != null;
    }

    public boolean hasLinkedTransition() {
        return linkedTransitionId != null;
    }

    public boolean referencesTransition(long candidateTransitionId) {
        return matchesId(linkedTransitionId, candidateTransitionId)
                || destination.referencesTransition(candidateTransitionId);
    }

    public Transition withDescription(String nextDescription) {
        return new Transition(transitionId, mapId, nextDescription, anchor, destination, linkedTransitionId);
    }

    public Transition withDestination(TransitionDestination nextDestination) {
        return new Transition(transitionId, mapId, description, anchor, nextDestination, linkedTransitionId);
    }

    public Transition withLinkedTransitionId(@Nullable Long nextLinkedTransitionId) {
        return new Transition(transitionId, mapId, description, anchor, destination, nextLinkedTransitionId);
    }

    private static @Nullable Long normalizedLinkedTransitionId(@Nullable Long transitionId) {
        return transitionId == null || transitionId <= 0L ? null : transitionId;
    }

    private static boolean matchesId(@Nullable Long id, long transitionId) {
        return id != null && id == transitionId;
    }
}
