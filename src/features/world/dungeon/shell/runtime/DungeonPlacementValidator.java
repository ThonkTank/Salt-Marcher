package features.world.dungeon.shell.runtime;

import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.transition.DungeonTransition;

import java.util.Objects;

final class DungeonPlacementValidator {

    sealed interface PlacementResult permits PlacementResult.Valid, PlacementResult.Invalid {

        record Valid(GridPoint cell, int level) implements PlacementResult {
            public Valid {
                Objects.requireNonNull(cell, "cell");
            }
        }

        record Invalid(GridPoint cell, int level, String reason) implements PlacementResult {
            public Invalid {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(reason, "reason");
            }
        }
    }

    PlacementResult validateTraversable(
            DungeonMap layout,
            DungeonCanvasPointerEvent event,
            int level
    ) {
        if (event == null) {
            return null;
        }
        return validateTraversable(layout, event.gridCell(), level);
    }

    PlacementResult validateTraversable(
            DungeonMap layout,
            GridPoint cell,
            int level
    ) {
        if (layout == null || cell == null) {
            return null;
        }
        if (!layout.isTraversableCell(cell, level)) {
            return new PlacementResult.Invalid(cell, level, "Zelle ist nicht begehbar.");
        }
        return new PlacementResult.Valid(cell, level);
    }

    PlacementResult validateTransitionPlacement(
            DungeonMap layout,
            GridPoint cell,
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
