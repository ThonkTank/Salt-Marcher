package features.world.dungeonmap.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridBoundary extends GridObject {

    private final Set<GridSegment> segments;

    public static GridBoundary empty() {
        return new GridBoundary(Set.of());
    }

    public static GridBoundary of(Collection<GridSegment> segments) {
        return new GridBoundary(normalizeBoundarySegments(segments));
    }

    private GridBoundary(Set<GridSegment> segments) {
        this.segments = segments == null || segments.isEmpty() ? Set.of() : Set.copyOf(segments);
    }

    public boolean isEmpty() {
        return segments.isEmpty();
    }

    public Set<GridSegment> segments() {
        return segments;
    }

    public boolean contains(GridSegment segment) {
        return segment != null && segments.contains(segment);
    }

    public GridBoundary intersection(GridBoundary other) {
        Set<GridSegment> otherSegments = other == null ? Set.of() : other.segments();
        if (segments.isEmpty() || otherSegments.isEmpty()) {
            return empty();
        }
        return GridBoundary.of(segments.stream().filter(otherSegments::contains).toList());
    }

    public GridBoundary without(GridBoundary other) {
        Set<GridSegment> otherSegments = other == null ? Set.of() : other.segments();
        if (segments.isEmpty()) {
            return empty();
        }
        if (otherSegments.isEmpty()) {
            return this;
        }
        return GridBoundary.of(segments.stream().filter(segment -> !otherSegments.contains(segment)).toList());
    }

    public List<GridBoundary> components() {
        if (segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment> remaining = new LinkedHashSet<>(segments);
        ArrayList<GridBoundary> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            GridSegment seed = remaining.iterator().next();
            ArrayDeque<GridSegment> queue = new ArrayDeque<>();
            LinkedHashSet<GridSegment> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                GridSegment current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                ArrayList<GridSegment> attached = new ArrayList<>();
                for (GridSegment candidate : remaining) {
                    if (current.sharedEndpoint(candidate).isPresent()) {
                        attached.add(candidate);
                    }
                }
                attached.sort(GridSegment.ORDER);
                for (GridSegment candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(GridBoundary.of(component));
        }
        result.sort(Comparator.comparing(GridBoundary::firstSegmentOrNull, GridSegment.ORDER));
        return List.copyOf(result);
    }

    public GridArea surface() {
        if (segments.isEmpty()) {
            return GridArea.empty();
        }
        CellBounds bounds = cellBounds(segments);
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (int y = bounds.minY(); y <= bounds.maxY(); y++) {
            for (int x = bounds.minX(); x <= bounds.maxX(); x++) {
                GridPoint candidate = GridPoint.cell(x, y, bounds.levelZ());
                if (isInsideEvenOdd(candidate)) {
                    cells.add(candidate);
                }
            }
        }
        return cells.isEmpty() ? GridArea.empty() : GridArea.of(cells);
    }

    @Override
    public GridBoundary translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return GridBoundary.of(segments.stream().map(segment -> segment.translated(resolvedTranslation)).toList());
    }

    @Override
    public Set<Integer> levels() {
        if (segments.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridSegment segment : segments) {
            levels.add(segment.start().z());
        }
        return Set.copyOf(levels);
    }

    @Override
    public GridArea cellFootprint() {
        return surface();
    }

    GridSegment firstSegmentOrNull() {
        return segments.stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
    }

    static Set<GridSegment> normalizeBoundarySegments(Collection<GridSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        Integer levelZ = null;
        for (GridSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            for (GridSegment step : segment.stepSegments()) {
                if (!step.isBoundaryStep()) {
                    throw new IllegalArgumentException("Boundary segments must be boundary-step segments");
                }
                if (levelZ == null) {
                    levelZ = step.start().z();
                } else if (levelZ != step.start().z()) {
                    throw new IllegalArgumentException("Boundary segments must lie on one level");
                }
                result.add(step);
            }
        }
        return result.isEmpty()
                ? Set.of()
                : result.stream().sorted(GridSegment.ORDER).collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    private boolean isInsideEvenOdd(GridPoint cell) {
        long crossings = segments.stream()
                .filter(segment -> segment.orientation() == GridSegment.Orientation.VERTICAL)
                .filter(segment -> segment.start().y2() < cell.y2() && segment.end().y2() > cell.y2())
                .filter(segment -> segment.start().x2() > cell.x2())
                .count();
        return (crossings & 1L) == 1L;
    }

    private static CellBounds cellBounds(Set<GridSegment> boundaryEdges) {
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        int levelZ = 0;
        for (GridSegment segment : boundaryEdges) {
            levelZ = segment.start().z();
            for (GridPoint cell : segment.touchingCells().cells()) {
                minX = Math.min(minX, cell.cellX());
                maxX = Math.max(maxX, cell.cellX());
                minY = Math.min(minY, cell.cellY());
                maxY = Math.max(maxY, cell.cellY());
            }
        }
        if (minX == Integer.MAX_VALUE) {
            return new CellBounds(0, 0, -1, -1, levelZ);
        }
        return new CellBounds(minX, minY, maxX, maxY, levelZ);
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY, int levelZ) {
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridBoundary boundary)) {
            return false;
        }
        return Objects.equals(segments, boundary.segments);
    }

    @Override
    public int hashCode() {
        return Objects.hash(segments);
    }

    @Override
    public String toString() {
        return "GridBoundary[segments=" + segments + "]";
    }
}
