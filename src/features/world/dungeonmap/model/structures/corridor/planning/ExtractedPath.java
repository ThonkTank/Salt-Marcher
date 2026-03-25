package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.List;

// Rückgabe von CostField.extractPathWithStairs(): Pfad-Zellen + platzierte Treppen.
record ExtractedPath(
        List<CubePoint> cells,
        List<StairPlacement> stairPlacements
) {
    ExtractedPath {
        cells = cells == null ? List.of() : List.copyOf(cells);
        stairPlacements = stairPlacements == null ? List.of() : List.copyOf(stairPlacements);
    }

    static ExtractedPath empty() {
        return new ExtractedPath(List.of(), List.of());
    }
}
