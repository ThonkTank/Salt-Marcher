package features.world.dungeonmap.application.transition;

import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

import java.util.Objects;

public record TransitionDestinationOption(
        DungeonTransitionDestination destination,
        String label
) {
    public TransitionDestinationOption {
        destination = Objects.requireNonNull(destination, "destination");
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("label darf nicht leer sein");
        }
        label = label.trim();
    }
}
