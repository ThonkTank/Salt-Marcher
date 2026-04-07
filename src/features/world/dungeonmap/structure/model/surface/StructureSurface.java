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
 * Canonical level-local owner for anchor, surface, and floor capabilities attached to one structure level.
 */
public final class StructureSurface {

    public record PersistenceSnapshot(
            CellCoord anchorCell,
            Set<CellCoord> surfaceCells,
            Set<CellCoord> floorCells
    ) {
        public PersistenceSnapshot {
            surfaceCells = surfaceCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(surfaceCells));
            floorCells = floorCells == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(floorCells));
        }
    }

    private final CellCoord anchorCell;
    private final TileShape surfaceShape;
    private final TileShape floorShape;

    public static StructureSurface empty() {
        return new StructureSurface(null, TileShape.empty(), TileShape.empty());
    }

    public static PersistenceSnapshot emptySnapshot() {
        return new PersistenceSnapshot(null, Set.of(), Set.of());
    }

    public static StructureSurface fromCells(
            CellCoord anchorCell,
            Collection<CellCoord> surfaceCells,
            Collection<CellCoord> floorCells
    ) {
        TileShape surface = TileShape.of(surfaceCells);
        if (surface.isEmpty()) {
            return empty();
        }
        return new StructureSurface(anchorCell, surface, surface.intersection(floorCells));
    }

    public static StructureSurface fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        PersistenceSnapshot resolvedSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        return fromCells(resolvedSnapshot.anchorCell(), resolvedSnapshot.surfaceCells(), resolvedSnapshot.floorCells());
    }

    private StructureSurface(
            CellCoord anchorCell,
            TileShape surfaceShape,
            TileShape floorShape
    ) {
        this.surfaceShape = surfaceShape == null ? TileShape.empty() : surfaceShape;
        this.floorShape = floorShape == null ? TileShape.empty() : floorShape;
        this.anchorCell = normalizeAnchor(anchorCell, this.surfaceShape);
    }

    public CellCoord anchorCell() {
        return anchorCell;
    }

    public TileShape surfaceShape() {
        return surfaceShape;
    }

    public TileShape floorShape() {
        return floorShape;
    }

    public Set<CellCoord> cellCoords() {
        return surfaceShape.cellCoords();
    }

    public Set<CellCoord> floorCells() {
        return floorShape.cellCoords();
    }

    public PersistenceSnapshot persistenceSnapshot() {
        return new PersistenceSnapshot(anchorCell, cellCoords(), floorCells());
    }

    public CellCoord centerCellCoord() {
        if (!floorShape.isEmpty()) {
            return floorShape.centerCellCoord();
        }
        return surfaceCenterCellCoord();
    }

    public CellCoord surfaceCenterCellCoord() {
        Set<CellCoord> cells = cellCoords();
        return cells.isEmpty() ? null : CellCoord.bestCenter(cells);
    }

    public Set<CubePoint> cubePoints(int levelZ) {
        return surfaceShape.cubePoints(levelZ);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && surfaceShape.contains(cell);
    }

    public boolean hasFloorCell(CellCoord cell) {
        return cell != null && floorCells().contains(cell);
    }

    public Set<CellCoord> reachableFrom(CellCoord startCell, Collection<GridSegment2x> boundaryEdges) {
        if (startCell == null || !contains(startCell)) {
            return Set.of();
        }
        return surfaceShape.reachableFrom(startCell, boundaryEdges).cellCoords();
    }

    public StructureSurface withFloorCells(Collection<CellCoord> floorCells) {
        return fromCells(anchorCell, cellCoords(), floorCells);
    }

    public StructureSurface translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new StructureSurface(
                anchorCell == null ? null : anchorCell.add(resolvedDelta),
                surfaceShape.translatedByCells(resolvedDelta),
                floorShape.translatedByCells(resolvedDelta));
    }

    public StructureSurface clippedTo(Collection<CellCoord> clippedSurfaceCells, CellCoord preferredAnchor) {
        TileShape clippedSurface = surfaceShape.intersection(clippedSurfaceCells);
        if (clippedSurface.isEmpty()) {
            return empty();
        }
        Set<CellCoord> normalizedSurfaceCells = clippedSurface.cellCoords();
        return fromCells(
                preferredAnchor != null && normalizedSurfaceCells.contains(preferredAnchor)
                        ? preferredAnchor
                        : CellCoord.bestCenter(normalizedSurfaceCells),
                normalizedSurfaceCells,
                intersectCells(floorCells(), normalizedSurfaceCells));
    }

    public boolean isEmpty() {
        return surfaceShape.isEmpty() && floorShape.isEmpty();
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StructureSurface that)) {
            return false;
        }
        return Objects.equals(anchorCell, that.anchorCell)
                && Objects.equals(cellCoords(), that.cellCoords())
                && Objects.equals(floorCells(), that.floorCells());
    }

    @Override
    public int hashCode() {
        return Objects.hash(anchorCell, cellCoords(), floorCells());
    }

    @Override
    public String toString() {
        return "StructureSurface[anchorCell=" + anchorCell
                + ", surfaceCells=" + cellCoords()
                + ", floorCells=" + floorCells() + "]";
    }

    private static Set<CellCoord> intersectCells(Collection<CellCoord> left, Collection<CellCoord> right) {
        if (left == null || right == null) {
            return Set.of();
        }
        Set<CellCoord> rightSet = right instanceof Set<CellCoord> set ? set : new LinkedHashSet<>(right);
        if (rightSet.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : left) {
            if (rightSet.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CellCoord normalizeAnchor(CellCoord anchorCell, TileShape surfaceShape) {
        if (surfaceShape == null || surfaceShape.isEmpty()) {
            return anchorCell;
        }
        if (anchorCell != null && surfaceShape.contains(anchorCell)) {
            return anchorCell;
        }
        CellCoord centerCell = surfaceShape.centerCellCoord();
        return centerCell == null ? new CellCoord(0, 0) : centerCell;
    }
}
