package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.List;

// Rückgabe von CostField.extractPathWithStairs(): reine Corridor-Zellen + getrennte Treppen-Traversals.
record ExtractedPath(
        List<CubePoint> cells,
        List<StairTraversal> stairTraversals
) {
    ExtractedPath {
        cells = cells == null ? List.of() : List.copyOf(cells);
        stairTraversals = stairTraversals == null ? List.of() : List.copyOf(stairTraversals);
    }

    static ExtractedPath empty() {
        return new ExtractedPath(List.of(), List.of());
    }

    List<StairPlacement> stairPlacements() {
        return StairTraversal.toPlacements(stairTraversals);
    }
}
