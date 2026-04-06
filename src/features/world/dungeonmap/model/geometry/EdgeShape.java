package features.world.dungeonmap.model.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical 2D edge-shape carrier for boundary/opening geometry on the doubled grid.
 */
public class EdgeShape {

    private final List<GridSegment2x> segments2x;

    public static EdgeShape empty() {
        return new EdgeShape(List.of());
    }

    public static EdgeShape fromBoundarySegments(Collection<GridSegment2x> segments2x) {
        return new EdgeShape(normalizeBoundarySegments(segments2x));
    }

    public EdgeShape(Collection<GridSegment2x> segments2x) {
        this.segments2x = normalizeSegments(segments2x);
    }

    protected EdgeShape(EdgeShape other) {
        this(other == null ? List.of() : other.segments2x());
    }

    public boolean isEmpty() {
        return segments2x.isEmpty();
    }

    public List<GridSegment2x> segments2x() {
        return segments2x;
    }

    public Set<GridSegment2x> segmentSet2x() {
        return segments2x.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments2x));
    }

    public boolean contains(GridSegment2x segment2x) {
        return segment2x != null && segments2x.contains(segment2x);
    }

    public GridSegment2x firstSegment2x() {
        return segments2x.stream().findFirst().orElse(null);
    }

    public Set<GridSegment2x> boundaryStepSet2x() {
        return GridSegment2x.boundarySteps(segments2x);
    }

    public EdgeShape boundaryStepsShape() {
        Set<GridSegment2x> boundarySteps = boundaryStepSet2x();
        return boundarySteps.isEmpty() ? empty() : EdgeShape.fromBoundarySegments(boundarySteps);
    }

    public EdgeShape intersection(Collection<GridSegment2x> segments) {
        Set<GridSegment2x> ownBoundarySteps = boundaryStepSet2x();
        Set<GridSegment2x> candidateSteps = GridSegment2x.boundarySteps(segments);
        if (ownBoundarySteps.isEmpty() || candidateSteps.isEmpty()) {
            return empty();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment : ownBoundarySteps) {
            if (candidateSteps.contains(segment)) {
                result.add(segment);
            }
        }
        return result.isEmpty() ? empty() : EdgeShape.fromBoundarySegments(result);
    }

    public EdgeShape without(Collection<GridSegment2x> segments) {
        Set<GridSegment2x> ownBoundarySteps = boundaryStepSet2x();
        Set<GridSegment2x> candidateSteps = GridSegment2x.boundarySteps(segments);
        if (ownBoundarySteps.isEmpty()) {
            return empty();
        }
        if (candidateSteps.isEmpty()) {
            return boundaryStepsShape();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment : ownBoundarySteps) {
            if (!candidateSteps.contains(segment)) {
                result.add(segment);
            }
        }
        return result.isEmpty() ? empty() : EdgeShape.fromBoundarySegments(result);
    }

    public List<EdgeShape> connectedComponents() {
        Set<GridSegment2x> boundarySteps = boundaryStepSet2x();
        if (boundarySteps.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment2x> remaining = new LinkedHashSet<>(boundarySteps.stream()
                .sorted(GridSegment2x.ORDER)
                .toList());
        ArrayList<EdgeShape> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            GridSegment2x seed = remaining.iterator().next();
            ArrayDeque<GridSegment2x> queue = new ArrayDeque<>();
            LinkedHashSet<GridSegment2x> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                GridSegment2x current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                ArrayList<GridSegment2x> attached = new ArrayList<>();
                for (GridSegment2x candidate : remaining) {
                    if (current.sharesEndpoint(candidate)) {
                        attached.add(candidate);
                    }
                }
                attached.sort(GridSegment2x.ORDER);
                for (GridSegment2x candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(EdgeShape.fromBoundarySegments(component));
        }
        result.sort(Comparator.comparing(EdgeShape::firstSegment2x, GridSegment2x.ORDER));
        return List.copyOf(result);
    }

    public TileShape surfaceShape() {
        Set<GridSegment2x> boundaryEdges = boundaryStepSet2x();
        if (boundaryEdges.isEmpty()) {
            return TileShape.empty();
        }
        CellBounds bounds = cellBounds(boundaryEdges);
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (int y = bounds.minY(); y <= bounds.maxY(); y++) {
            for (int x = bounds.minX(); x <= bounds.maxX(); x++) {
                CellCoord candidate = new CellCoord(x, y);
                if (isInsideEvenOdd(candidate, boundaryEdges)) {
                    result.add(candidate);
                }
            }
        }
        return result.isEmpty() ? TileShape.empty() : new TileShape(result);
    }

    public EdgeShape translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new EdgeShape(segments2x.stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList());
    }

    protected static List<GridSegment2x> normalizeSegments(Collection<GridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        segments.stream()
                .filter(segment -> segment != null)
                .sorted(GridSegment2x.ORDER)
                .forEach(result::add);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    protected static List<GridSegment2x> normalizeBoundarySegments(Collection<GridSegment2x> segments) {
        List<GridSegment2x> normalized = normalizeSegments(GridSegment2x.boundarySteps(segments));
        for (GridSegment2x segment : normalized) {
            if (!segment.isBoundaryEdge()) {
                throw new IllegalArgumentException("Boundary segments must be boundary edges");
            }
        }
        return normalized;
    }

    private static boolean isInsideEvenOdd(CellCoord cell, Set<GridSegment2x> boundaryEdges) {
        int centerX2 = cell.x() * 2;
        int centerY2 = cell.y() * 2;
        long crossings = boundaryEdges.stream()
                .filter(GridSegment2x::isVertical)
                .filter(segment -> segment.start().y2() < centerY2 && segment.end().y2() > centerY2)
                .filter(segment -> segment.start().x2() > centerX2)
                .count();
        return (crossings & 1L) == 1L;
    }

    private static CellBounds cellBounds(Set<GridSegment2x> boundaryEdges) {
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (GridSegment2x segment : boundaryEdges) {
            for (CellCoord cell : segment.touchingCells()) {
                minX = Math.min(minX, cell.x());
                maxX = Math.max(maxX, cell.x());
                minY = Math.min(minY, cell.y());
                maxY = Math.max(maxY, cell.y());
            }
        }
        if (minX == Integer.MAX_VALUE) {
            return new CellBounds(0, 0, -1, -1);
        }
        return new CellBounds(minX, minY, maxX, maxY);
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY) {
    }
}
