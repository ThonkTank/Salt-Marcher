package features.world.dungeonmap.model.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
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

    public static TileShape of(Collection<CellCoord> cellCoords) {
        return new TileShape(cellCoords);
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

    public TileShape intersection(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalizeCellCoords(cells);
        if (cellCoords.isEmpty() || normalizedCells.isEmpty()) {
            return empty();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : cellCoords) {
            if (normalizedCells.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? empty() : new TileShape(result);
    }

    public boolean overlaps(Collection<CellCoord> cells) {
        Set<CellCoord> normalizedCells = normalizeCellCoords(cells);
        if (cellCoords.isEmpty() || normalizedCells.isEmpty()) {
            return false;
        }
        for (CellCoord cell : normalizedCells) {
            if (cellCoords.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public Set<CubePoint> cubePoints(int levelZ) {
        if (cellCoords.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (CellCoord cell : cellCoords) {
            result.add(CubePoint.at(cell, levelZ));
        }
        return Set.copyOf(result);
    }

    public List<TileShape> connectedComponents() {
        if (cellCoords.isEmpty()) {
            return List.of();
        }
        return CellCoord.connectedComponents(cellCoords).stream()
                .map(TileShape::new)
                .toList();
    }

    public TileShape reachableFrom(CellCoord startCell, Collection<GridSegment2x> barriers) {
        if (startCell == null || !contains(startCell)) {
            return empty();
        }
        LinkedHashSet<CellCoord> remaining = new LinkedHashSet<>(cellCoords);
        LinkedHashSet<CellCoord> visited = new LinkedHashSet<>();
        ArrayDeque<CellCoord> queue = new ArrayDeque<>();
        Set<GridSegment2x> blockedEdges = GridSegment2x.boundarySteps(barriers);
        queue.add(startCell);
        remaining.remove(startCell);
        while (!queue.isEmpty()) {
            CellCoord current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = current.add(step);
                if (!remaining.contains(neighbor)) {
                    continue;
                }
                GridSegment2x boundary = GridSegment2x.boundaryEdge(current, current.directionTo4(neighbor));
                if (blockedEdges.contains(boundary)) {
                    continue;
                }
                remaining.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? empty() : new TileShape(visited);
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
