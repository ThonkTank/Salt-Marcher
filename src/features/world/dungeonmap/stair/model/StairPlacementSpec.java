package features.world.dungeonmap.stair.model;

import features.world.dungeonmap.geometry.GridPoint;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Authored stair placement inputs owned by the stair/transition workflows.
 */
public record StairPlacementSpec(
        GridPoint anchorCell,
        int anchorLevelZ,
        StairPathPatternSpec shapeSpec,
        int minLevelZ,
        int maxLevelZ,
        Set<Integer> stopLevels
) {
    public StairPlacementSpec {
        anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
        shapeSpec = shapeSpec == null ? StairPathPatternSpec.defaultSpec() : shapeSpec;
        stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
    }
}
