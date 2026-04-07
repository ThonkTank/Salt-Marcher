package features.world.dungeonmap.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class GridArea extends GridObject {

    private final Set<GridPoint> cellPoints;

    public static GridArea empty() {
        return new GridArea(Set.of());
    }

    public static GridArea of(Collection<GridPoint> cellPoints) {
        return new GridArea(cellPoints);
    }

    public GridArea(Collection<GridPoint> cellPoints) {
        this.cellPoints = normalizeCellPoints(cellPoints);
    }

    public boolean isEmpty() {
        return cellPoints.isEmpty();
    }

    public Set<GridPoint> cellPoints() {
        return cellPoints;
    }

    public Set<GridPoint> cellCoords() {
        return cellPoints();
    }

    public boolean contains(GridPoint cell) {
        return cell != null && cellPoints.contains(GridPoint.cell(cell));
    }

    public GridPoint centerCell() {
        return cellPoints.isEmpty() ? null : GridPoint.bestCenter(cellPoints);
    }

    public GridPoint centerGridPoint() {
        return centerCell();
    }

    public GridArea intersection(Collection<GridPoint> cells) {
        Set<GridPoint> normalizedCells = normalizeCellPoints(cells);
        if (cellPoints.isEmpty() || normalizedCells.isEmpty()) {
            return empty();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : cellPoints) {
            if (normalizedCells.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? empty() : new GridArea(result);
    }

    public boolean overlaps(Collection<GridPoint> cells) {
        Set<GridPoint> normalizedCells = normalizeCellPoints(cells);
        if (cellPoints.isEmpty() || normalizedCells.isEmpty()) {
            return false;
        }
        for (GridPoint cell : normalizedCells) {
            if (cellPoints.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public Set<GridPoint> cubePoints(int levelZ) {
        if (cellPoints.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : cellPoints) {
            result.add(GridPoint.at(cell, levelZ));
        }
        return Set.copyOf(result);
    }

    public List<GridArea> connectedComponents() {
        if (cellPoints.isEmpty()) {
            return List.of();
        }
        return GridPoint.connectedComponents(cellPoints).stream()
                .map(GridArea::new)
                .toList();
    }

    public GridArea reachableFrom(GridPoint startCell, Collection<GridSegment> barriers) {
        GridPoint resolvedStart = startCell == null ? null : GridPoint.cell(startCell);
        if (resolvedStart == null || !contains(resolvedStart)) {
            return empty();
        }
        LinkedHashSet<GridPoint> remaining = new LinkedHashSet<>(cellPoints);
        LinkedHashSet<GridPoint> visited = new LinkedHashSet<>();
        ArrayDeque<GridPoint> queue = new ArrayDeque<>();
        Set<GridSegment> blockedEdges = GridSegment.boundarySteps(barriers);
        queue.add(resolvedStart);
        remaining.remove(resolvedStart);
        while (!queue.isEmpty()) {
            GridPoint current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (GridPoint step : GridPoint.CARDINAL_STEPS) {
                GridPoint neighbor = current.add(step);
                if (!remaining.contains(neighbor)) {
                    continue;
                }
                GridSegment boundary = GridSegment.boundaryEdge(current, current.directionTo4(neighbor));
                if (blockedEdges.contains(boundary)) {
                    continue;
                }
                remaining.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? empty() : new GridArea(visited);
    }

    @Override
    public GridArea translatedByCells(int dx, int dy, int dz) {
        if (dx == 0 && dy == 0 && dz == 0) {
            return this;
        }
        return new GridArea(cellPoints.stream()
                .map(cell -> cell.translatedByCells(dx, dy, dz))
                .toList());
    }

    public GridArea translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), resolvedDelta.z());
    }

    public GridBoundary boundary() {
        if (cellPoints.isEmpty()) {
            return GridBoundary.empty();
        }
        LinkedHashSet<GridSegment> boundarySegments = new LinkedHashSet<>();
        for (GridPoint cell : cellPoints) {
            for (GridPoint step : GridPoint.CARDINAL_STEPS) {
                GridPoint neighbor = cell.add(step);
                if (!cellPoints.contains(neighbor)) {
                    boundarySegments.add(GridSegment.boundaryEdge(cell, cell.directionTo4(neighbor)));
                }
            }
        }
        return boundarySegments.isEmpty() ? GridBoundary.empty() : GridBoundary.fromBoundarySegments(boundarySegments);
    }

    public GridBoundary boundaryShape() {
        return boundary();
    }

    @Override
    public Set<Integer> levels() {
        if (cellPoints.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridPoint cell : cellPoints) {
            levels.add(cell.z());
        }
        return Set.copyOf(levels);
    }

    @Override
    public GridArea cellFootprint() {
        return this;
    }

    static Set<GridPoint> normalizeCellPoints(Collection<GridPoint> cellPoints) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        if (cellPoints != null) {
            cellPoints.stream()
                    .filter(point -> point != null && point.isCell())
                    .sorted(GridPoint.ORDER)
                    .forEach(result::add);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
