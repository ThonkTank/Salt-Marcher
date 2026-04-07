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
public final class StructureFloor {

    public record PersistenceSnapshot(Set<CellCoord> cells) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    private final TileShape tileShape;

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
        this.tileShape = tileShape == null ? TileShape.empty() : tileShape;
    }

    public Set<CellCoord> cellCoords() {
        return tileShape.cellCoords();
    }

    public boolean contains(CellCoord cell) {
        return cell != null && tileShape.contains(cell);
    }

    public CellCoord centerCellCoord() {
        return tileShape.isEmpty() ? null : tileShape.centerCellCoord();
    }

    public StructureFloor withCells(
            Collection<CellCoord> cells,
            StructureSurfaceArea surfaceArea
    ) {
        return fromCells(cells, surfaceArea);
    }

    public StructureFloor translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureFloor(tileShape.translatedByCells(resolvedDelta));
    }

    public StructureFloor clippedTo(StructureSurfaceArea surfaceArea) {
        return fromCells(cellCoords(), surfaceArea);
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(cellCoords());
    }

    public boolean isEmpty() {
        return tileShape.isEmpty();
    }

    TileShape tileShape() {
        return tileShape;
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
