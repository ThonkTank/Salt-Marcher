package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;

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
            CellCoord cell,
            int levelZ,
            CardinalDirection headingOverride
    ) implements Target {
        public CellTarget {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    public record DoorTarget(
            int levelZ,
            GridSegment2x anchorSegment2x,
            CellCoord targetCellHint,
            CardinalDirection headingOverride
    ) implements Target {
        public DoorTarget {
            anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
            headingOverride = headingOverride == null ? CardinalDirection.defaultDirection() : headingOverride;
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
