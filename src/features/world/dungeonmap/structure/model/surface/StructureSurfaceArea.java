package features.world.dungeonmap.structure.model.surface;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridArea;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical owner for anchor and surface-cell truth on one structure level.
 */
public final class StructureSurfaceArea extends StructureSurfaceObject {

    record PersistenceSnapshot(
            GridPoint anchorCell,
            Set<GridPoint> cells
    ) {
        public PersistenceSnapshot {
            cells = cells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(cells));
        }
    }

    private final GridPoint anchorCell;

    static StructureSurfaceArea empty() {
        return new StructureSurfaceArea(null, GridArea.empty());
    }

    static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(null, Set.of());
    }

    static StructureSurfaceArea fromCells(
            GridPoint anchorCell,
            Collection<GridPoint> cells
    ) {
        GridArea tileShape = GridArea.of(cells);
        if (tileShape.isEmpty()) {
            return empty();
        }
        return new StructureSurfaceArea(anchorCell, tileShape);
    }

    static StructureSurfaceArea fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromCells(resolvedSnapshot.anchorCell(), resolvedSnapshot.cells());
    }

    private StructureSurfaceArea(
            GridPoint anchorCell,
            GridArea tileShape
    ) {
        super(tileShape);
        this.anchorCell = normalizeAnchor(anchorCell, tileShape());
    }

    public GridPoint anchorCell() {
        return anchorCell;
    }

    public Set<GridPoint> cubePoints(int levelZ) {
        return tileShape().cubePoints(levelZ);
    }

    public Set<GridPoint> reachableFrom(GridPoint startCell, Collection<GridSegment> boundaryEdges) {
        if (startCell == null || !contains(startCell)) {
            return Set.of();
        }
        return tileShape().reachableFrom(startCell, boundaryEdges).cellCoords();
    }

    StructureSurfaceArea translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = resolvedDelta(delta);
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureSurfaceArea(
                anchorCell == null ? null : anchorCell.add(resolvedDelta),
                translatedGridArea(resolvedDelta));
    }

    StructureSurfaceArea clippedTo(Collection<GridPoint> clippedCells, GridPoint preferredAnchor) {
        GridArea clippedSurface = intersectedGridArea(clippedCells);
        if (clippedSurface.isEmpty()) {
            return empty();
        }
        Set<GridPoint> normalizedSurfaceCells = clippedSurface.cellCoords();
        return fromCells(
                preferredAnchor != null && normalizedSurfaceCells.contains(preferredAnchor)
                        ? preferredAnchor
                        : GridPoint.bestCenter(normalizedSurfaceCells),
                normalizedSurfaceCells);
    }

    PersistenceSnapshot persistenceSnapshot() {
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

    private static GridPoint normalizeAnchor(GridPoint anchorCell, GridArea tileShape) {
        if (tileShape == null || tileShape.isEmpty()) {
            return anchorCell;
        }
        if (anchorCell != null && tileShape.contains(anchorCell)) {
            return anchorCell;
        }
        GridPoint centerCell = tileShape.centerGridPoint();
        return centerCell == null ? new GridPoint(0, 0) : centerCell;
    }
}
