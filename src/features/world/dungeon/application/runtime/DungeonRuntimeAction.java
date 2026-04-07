package features.world.dungeon.application.runtime;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;

import java.util.Objects;

/**
 * Runtime actions stay flat: the view needs one label, one description, one failure message, and one executable
 * target instead of a parallel hierarchy for doors, stairs, and transitions.
 */
public record DungeonRuntimeAction(
        String label,
        String description,
        String failureMessage,
        Target target
) {
    public DungeonRuntimeAction {
        label = label == null || label.isBlank() ? "Aktion" : label.trim();
        description = description == null ? "" : description.trim();
        failureMessage = failureMessage == null || failureMessage.isBlank()
                ? "Aktion konnte nicht benutzt werden"
                : failureMessage.trim();
        target = Objects.requireNonNull(target, "target");
    }

    public sealed interface Target permits CellTarget, DoorTarget, TransitionTarget {
    }

    public record CellTarget(
            GridPoint cell,
            int levelZ,
            CardinalDirection headingOverride
    ) implements Target {
        public CellTarget {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    public record DoorTarget(
            DoorRef doorRef
    ) implements Target {
        public DoorTarget {
            doorRef = Objects.requireNonNull(doorRef, "doorRef");
        }
    }

    public record TransitionTarget(long transitionId) implements Target {
        public TransitionTarget {
            if (transitionId <= 0) {
                throw new IllegalArgumentException("transitionId muss positiv sein");
            }
        }
    }
}
