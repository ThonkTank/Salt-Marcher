package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.Objects;

public final class DungeonPlacementValidator {

    public sealed interface PlacementResult permits PlacementResult.Valid, PlacementResult.Invalid {

        record Valid(Point2i cell, int level) implements PlacementResult {
            public Valid {
                Objects.requireNonNull(cell, "cell");
            }
        }

        record Invalid(Point2i cell, int level, String reason) implements PlacementResult {
            public Invalid {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(reason, "reason");
            }
        }
    }

    public PlacementResult validateTraversable(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            int level
    ) {
        if (event == null) {
            return null;
        }
        return validateTraversable(layout, event.gridCell(), level);
    }

    public PlacementResult validateTraversable(
            DungeonLayout layout,
            Point2i cell,
            int level
    ) {
        if (layout == null || cell == null) {
            return null;
        }
        if (!layout.isTraversableCell(cell)) {
            return new PlacementResult.Invalid(cell, level, "Zelle ist nicht begehbar.");
        }
        return new PlacementResult.Valid(cell, level);
    }

    public PlacementResult validateTransitionPlacement(
            DungeonLayout layout,
            Point2i cell,
            int level,
            Long ignoredTransitionId
    ) {
        PlacementResult traversable = validateTraversable(layout, cell, level);
        if (!(traversable instanceof PlacementResult.Valid)) {
            return traversable;
        }

        boolean occupied = layout.transitionsAtCell(cell, level).stream()
                .map(DungeonTransition::transitionId)
                .filter(Objects::nonNull)
                .anyMatch(id -> !Objects.equals(id, ignoredTransitionId));
        if (occupied) {
            return new PlacementResult.Invalid(cell, level, "An dieser Zelle existiert bereits ein Übergang.");
        }
        return traversable;
    }
}
