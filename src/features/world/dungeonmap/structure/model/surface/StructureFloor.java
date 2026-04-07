package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for floor-cell truth constrained to one surface area.
 */
public final class StructureFloor extends StructureSurfaceObject {

    public record PersistenceSnapshot(Set<CellCoord> cells) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    public static StructureFloor empty() {
        return new StructureFloor(TileShape.empty());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(Set.of());
    }

    public static StructureFloor fromCells(
            Collection<CellCoord> cells,
            StructureSurfaceArea surfaceArea
    ) {
        StructureSurfaceArea resolvedSurfaceArea = surfaceArea == null ? StructureSurfaceArea.empty() : surfaceArea;
        if (resolvedSurfaceArea.isEmpty()) {
            return empty();
        }
        return new StructureFloor(resolvedSurfaceArea.tileShape().intersection(cells));
    }

    public static StructureFloor fromPersistenceSnapshot(
            PersistenceSnapshot snapshot,
            StructureSurfaceArea surfaceArea
    ) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromCells(resolvedSnapshot.cells(), surfaceArea);
    }

    private StructureFloor(TileShape tileShape) {
        super(tileShape);
    }

    public StructureFloor withCells(
            Collection<CellCoord> cells,
            StructureSurfaceArea surfaceArea
    ) {
        return fromCells(cells, surfaceArea);
    }

    public StructureFloor translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureFloor(translatedTileShape(resolvedDelta));
    }

    public StructureFloor clippedTo(StructureSurfaceArea surfaceArea) {
        return fromCells(cellCoords(), surfaceArea);
    }

    public PersistenceSnapshot persistenceSnapshot() {
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
