package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

record StairTraversal(
        CubePoint entryCell,
        CubePoint exitCell,
        StairPlacement placement
) {
    boolean touches(Set<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return false;
        }
        return cells.contains(entryCell) || cells.contains(exitCell);
    }

    CubePoint oppositeEndpoint(CubePoint cell) {
        if (cell == null) {
            return null;
        }
        if (cell.equals(entryCell)) {
            return exitCell;
        }
        if (cell.equals(exitCell)) {
            return entryCell;
        }
        return null;
    }

    static List<StairPlacement> toPlacements(Collection<StairTraversal> traversals) {
        if (traversals == null || traversals.isEmpty()) {
            return List.of();
        }
        List<StairPlacement> placements = new ArrayList<>();
        for (StairTraversal traversal : traversals) {
            if (traversal != null && traversal.placement() != null) {
                placements.add(traversal.placement());
            }
        }
        return StairPlacement.canonicalize(placements);
    }
}
