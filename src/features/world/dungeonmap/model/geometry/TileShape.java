package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Canonical 2D tile-shape carrier for projected grid occupancy on one level.
 */
public class TileShape {

    private final Set<CellCoord> cellCoords;

    public static TileShape empty() {
        return new TileShape(Set.of());
    }

    public TileShape(Collection<CellCoord> cellCoords) {
        this.cellCoords = normalizeCellCoords(cellCoords);
    }

    protected TileShape(TileShape other) {
        this(other == null ? Set.of() : other.cellCoords());
    }

    public boolean isEmpty() {
        return cellCoords.isEmpty();
    }

    public Set<CellCoord> cellCoords() {
        return cellCoords;
    }

    public boolean contains(CellCoord cell) {
        return cell != null && cellCoords.contains(cell);
    }

    public CellCoord centerCellCoord() {
        return cellCoords.isEmpty() ? null : CellCoord.bestCenter(cellCoords);
    }

    public TileShape translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new TileShape(cellCoords.stream()
                .map(cell -> cell.add(resolvedDelta))
                .toList());
    }

    public EdgeShape boundaryShape() {
        if (cellCoords.isEmpty()) {
            return EdgeShape.empty();
        }
        LinkedHashSet<GridSegment2x> boundarySegments = new LinkedHashSet<>();
        for (CellCoord cell : cellCoords) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!cellCoords.contains(neighbor)) {
                    boundarySegments.add(GridSegment2x.boundaryEdge(cell, cell.directionTo4(neighbor)));
                }
            }
        }
        return boundarySegments.isEmpty() ? EdgeShape.empty() : EdgeShape.fromBoundarySegments(boundarySegments);
    }

    protected static Set<CellCoord> normalizeCellCoords(Collection<CellCoord> cellCoords) {
        return CellCoord.normalize(cellCoords);
    }
}
