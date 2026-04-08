package features.world.dungeon.geometry;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridArea extends GridObject<GridArea> {

    private final Set<GridPoint> cells;

    public static GridArea empty() {
        return new GridArea(Set.of());
    }

    public static GridArea of(Collection<GridPoint> cells) {
        return new GridArea(cells);
    }

    public static GridArea rectangle(GridPoint startCell, GridPoint endCell) {
        if (startCell == null || endCell == null) {
            return empty();
        }
        if (startCell.kind() != GridPoint.Kind.CELL || endCell.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException("GridArea.rectangle requires cell points");
        }
        if (startCell.z() != endCell.z()) {
            throw new IllegalArgumentException("GridArea.rectangle requires both cells on the same level");
        }
        int minX = Math.min(startCell.x2(), endCell.x2()) / 2;
        int maxX = Math.max(startCell.x2(), endCell.x2()) / 2;
        int minY = Math.min(startCell.y2(), endCell.y2()) / 2;
        int maxY = Math.max(startCell.y2(), endCell.y2()) / 2;
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                result.add(GridPoint.cell(x, y, startCell.z()));
            }
        }
        return result.isEmpty() ? empty() : new GridArea(result);
    }

    private GridArea(Collection<GridPoint> cells) {
        this.cells = GridPoint.normalizeCells(cells);
    }

    public boolean isEmpty() {
        return cells.isEmpty();
    }

    public Set<GridPoint> cells() {
        return cells;
    }

    public boolean contains(GridPoint cell) {
        return cell != null && cells.contains(cell);
    }

    public GridArea onLevel(int levelZ) {
        if (cells.isEmpty()) {
            return empty();
        }
        return new GridArea(cells.stream().filter(cell -> cell.z() == levelZ).toList());
    }

    public GridPoint center() {
        if (cells.isEmpty()) {
            return null;
        }
        if (levels().size() > 1) {
            throw new IllegalStateException("GridArea.center requires a single-level area");
        }
        return GridPoint.centerOfCells(cells);
    }

    public GridArea intersection(GridArea other) {
        Set<GridPoint> otherCells = other == null ? Set.of() : other.cells();
        if (cells.isEmpty() || otherCells.isEmpty()) {
            return empty();
        }
        return new GridArea(cells.stream().filter(otherCells::contains).toList());
    }

    public boolean overlaps(GridArea other) {
        Set<GridPoint> otherCells = other == null ? Set.of() : other.cells();
        if (cells.isEmpty() || otherCells.isEmpty()) {
            return false;
        }
        return cells.stream().anyMatch(otherCells::contains);
    }

    public List<GridArea> components() {
        return GridPoint.connectedCellComponents(cells).stream()
                .map(GridArea::new)
                .toList();
    }

    public GridArea reachableFrom(GridPoint startCell, GridBoundary barriers) {
        if (startCell == null || !cells.contains(startCell)) {
            return empty();
        }
        GridBoundary blocked = barriers == null ? GridBoundary.empty() : barriers;
        LinkedHashSet<GridPoint> remaining = new LinkedHashSet<>(cells);
        LinkedHashSet<GridPoint> visited = new LinkedHashSet<>();
        ArrayDeque<GridPoint> queue = new ArrayDeque<>();
        queue.add(startCell);
        remaining.remove(startCell);
        while (!queue.isEmpty()) {
            GridPoint current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (CardinalDirection direction : CardinalDirection.values()) {
                GridPoint neighbor = current.step(direction);
                if (!remaining.contains(neighbor)) {
                    continue;
                }
                if (blocked.contains(GridSegment.boundaryEdge(current, direction))) {
                    continue;
                }
                remaining.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return visited.isEmpty() ? empty() : new GridArea(visited);
    }

    public GridBoundary boundary() {
        if (cells.isEmpty()) {
            return GridBoundary.empty();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (GridPoint cell : cells) {
            for (CardinalDirection direction : CardinalDirection.values()) {
                GridPoint neighbor = cell.step(direction);
                if (!cells.contains(neighbor)) {
                    result.add(GridSegment.boundaryEdge(cell, direction));
                }
            }
        }
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    @Override
    public GridArea translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridArea(cells.stream().map(cell -> cell.translated(resolvedTranslation)).toList());
    }

    @Override
    public Set<Integer> levels() {
        if (cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridPoint cell : cells) {
            levels.add(cell.z());
        }
        return Set.copyOf(levels);
    }

    @Override
    public GridArea cellFootprint() {
        return this;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridArea area)) {
            return false;
        }
        return Objects.equals(cells, area.cells);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cells);
    }

    @Override
    public String toString() {
        return "GridArea[cells=" + cells + "]";
    }
}
