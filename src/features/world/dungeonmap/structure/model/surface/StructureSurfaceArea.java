package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for anchor and surface-cell truth on one structure level.
 */
public final class StructureSurfaceArea {

    public record PersistenceSnapshot(
            CellCoord anchorCell,
            Set<CellCoord> cells
    ) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    private final CellCoord anchorCell;
    private final TileShape tileShape;

    public static StructureSurfaceArea empty() {
        return new StructureSurfaceArea(null, TileShape.empty());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(null, Set.of());
    }

    public static StructureSurfaceArea fromCells(
            CellCoord anchorCell,
            Collection<CellCoord> cells
    ) {
        TileShape tileShape = TileShape.of(cells);
        if (tileShape.isEmpty()) {
            return empty();
        }
        return new StructureSurfaceArea(anchorCell, tileShape);
    }

    public static StructureSurfaceArea fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromCells(resolvedSnapshot.anchorCell(), resolvedSnapshot.cells());
    }

    private StructureSurfaceArea(
            CellCoord anchorCell,
            TileShape tileShape
    ) {
        this.tileShape = tileShape == null ? TileShape.empty() : tileShape;
        this.anchorCell = normalizeAnchor(anchorCell, this.tileShape);
    }

    public CellCoord anchorCell() {
        return anchorCell;
    }

    public Set<CellCoord> cellCoords() {
        return tileShape.cellCoords();
    }

    public CellCoord centerCellCoord() {
        Set<CellCoord> cells = cellCoords();
        return cells.isEmpty() ? null : CellCoord.bestCenter(cells);
    }

    public Set<CubePoint> cubePoints(int levelZ) {
        return tileShape.cubePoints(levelZ);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && tileShape.contains(cell);
    }

    public Set<CellCoord> reachableFrom(CellCoord startCell, Collection<GridSegment2x> boundaryEdges) {
        if (startCell == null || !contains(startCell)) {
            return Set.of();
        }
        return tileShape.reachableFrom(startCell, boundaryEdges).cellCoords();
    }

    public StructureSurfaceArea translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureSurfaceArea(
                anchorCell == null ? null : anchorCell.add(resolvedDelta),
                tileShape.translatedByCells(resolvedDelta));
    }

    public StructureSurfaceArea clippedTo(Collection<CellCoord> clippedCells, CellCoord preferredAnchor) {
        TileShape clippedSurface = tileShape.intersection(clippedCells);
        if (clippedSurface.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = clippedSurface.cellCoords();
        return fromCells(
                preferredAnchor != null && normalizedSurfaceCells.contains(preferredAnchor)
                        ? preferredAnchor
                        : CellCoord.bestCenter(normalizedSurfaceCells),
                normalizedSurfaceCells);
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(anchorCell, cellCoords());
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
        if (!(other instanceof StructureSurfaceArea that)) {
            return false;
        }
        return Objects.equals(anchorCell, that.anchorCell)
                && Objects.equals(cellCoords(), that.cellCoords());
    }

    @Override
    public int hashCode() {
        return Objects.hash(anchorCell, cellCoords());
    }

    @Override
    public String toString() {
        return "StructureSurfaceArea[anchorCell=" + anchorCell
                + ", cells=" + cellCoords() + "]";
    }

    private static CellCoord normalizeAnchor(CellCoord anchorCell, TileShape tileShape) {
        if (tileShape == null || tileShape.isEmpty()) {
            return anchorCell;
        }
        if (anchorCell != null && tileShape.contains(anchorCell)) {
            return anchorCell;
        }
        CellCoord centerCell = tileShape.centerCellCoord();
        return centerCell == null ? new CellCoord(0, 0) : centerCell;
    }
}
