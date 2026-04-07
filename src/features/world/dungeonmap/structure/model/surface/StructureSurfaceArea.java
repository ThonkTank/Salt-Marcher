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
public final class StructureSurfaceArea extends StructureSurfaceObject {

    public record PersistenceSnapshot(
            CellCoord anchorCell,
            Set<CellCoord> cells
    ) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    private final CellCoord anchorCell;
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
        super(tileShape);
        this.anchorCell = normalizeAnchor(anchorCell, tileShape());
    }

    public CellCoord anchorCell() {
        return anchorCell;
    }

    public Set<CubePoint> cubePoints(int levelZ) {
        return tileShape().cubePoints(levelZ);
    }

    public Set<CellCoord> reachableFrom(CellCoord startCell, Collection<GridSegment2x> boundaryEdges) {
        if (startCell == null || !contains(startCell)) {
            return Set.of();
        }
        return tileShape().reachableFrom(startCell, boundaryEdges).cellCoords();
    }

    public StructureSurfaceArea translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureSurfaceArea(
                anchorCell == null ? null : anchorCell.add(resolvedDelta),
                translatedTileShape(resolvedDelta));
    }

    public StructureSurfaceArea clippedTo(Collection<CellCoord> clippedCells, CellCoord preferredAnchor) {
        TileShape clippedSurface = intersectedTileShape(clippedCells);
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
