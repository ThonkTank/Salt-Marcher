package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridArea;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for floor-cell truth constrained to one surface area.
 */
public final class StructureFloor extends StructureSurfaceObject {

    record PersistenceSnapshot(Set<GridPoint> cells) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    static StructureFloor empty() {
        return new StructureFloor(GridArea.empty());
    }

    static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(Set.of());
    }

    static StructureFloor fromCells(
            Collection<GridPoint> cells,
            StructureSurfaceArea surfaceArea
    ) {
        StructureSurfaceArea resolvedSurfaceArea = surfaceArea == null ? StructureSurfaceArea.empty() : surfaceArea;
        if (resolvedSurfaceArea.isEmpty()) {
            return empty();
        }
        return new StructureFloor(resolvedSurfaceArea.tileShape().intersection(cells));
    }

    private StructureFloor(GridArea tileShape) {
        super(tileShape);
    }

    StructureFloor translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureFloor(translatedGridArea(resolvedDelta));
    }

    StructureFloor clippedTo(StructureSurfaceArea surfaceArea) {
        return fromCells(cellCoords(), surfaceArea);
    }

    PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(cellCoords());
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureFloor that)) {
            return false;
        }
        return Objects.equals(cellCoords(), that.cellCoords());
    }

    @Override
    public int hashCode() {
        return Objects.hash(cellCoords());
    }

    @Override
    public String toString() {
        return "StructureFloor[cells=" + cellCoords() + "]";
    }
}
