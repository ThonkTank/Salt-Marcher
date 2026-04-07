package features.world.dungeonmap.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class GridBoundary extends GridObject {

    private final List<GridSegment> segments;

    public static GridBoundary empty() {
        return new GridBoundary(List.of());
    }

    public static GridBoundary fromBoundarySegments(Collection<GridSegment> segments) {
        return new GridBoundary(normalizeBoundarySegments(segments));
    }

    public GridBoundary(Collection<GridSegment> segments) {
        this.segments = normalizeSegments(segments);
    }

    public boolean isEmpty() {
        return segments.isEmpty();
    }

    public List<GridSegment> segments() {
        return segments;
    }

    public List<GridSegment> segments2x() {
        return segments();
    }

    public Set<GridSegment> segmentSet() {
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public Set<GridSegment> segmentSet2x() {
        return segmentSet();
    }

    public boolean contains(GridSegment segment) {
        return segment != null && segments.contains(segment);
    }

    public GridSegment firstSegment() {
        return segments.stream().findFirst().orElse(null);
    }

    public GridSegment firstSegment2x() {
        return firstSegment();
    }

    public Set<GridSegment> boundaryStepSet() {
        return GridSegment.boundarySteps(segments);
    }

    public Set<GridSegment> boundaryStepSet2x() {
        return boundaryStepSet();
    }

    public GridBoundary boundaryStepsShape() {
        Set<GridSegment> boundarySteps = boundaryStepSet();
        return boundarySteps.isEmpty() ? empty() : GridBoundary.fromBoundarySegments(boundarySteps);
    }

    public GridBoundary intersection(Collection<GridSegment> candidateSegments) {
        Set<GridSegment> ownBoundarySteps = boundaryStepSet();
        Set<GridSegment> normalizedCandidates = GridSegment.boundarySteps(candidateSegments);
        if (ownBoundarySteps.isEmpty() || normalizedCandidates.isEmpty()) {
            return empty();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (GridSegment segment : ownBoundarySteps) {
            if (normalizedCandidates.contains(segment)) {
                result.add(segment);
            }
        }
        return result.isEmpty() ? empty() : GridBoundary.fromBoundarySegments(result);
    }

    public GridBoundary without(Collection<GridSegment> candidateSegments) {
        Set<GridSegment> ownBoundarySteps = boundaryStepSet();
        Set<GridSegment> normalizedCandidates = GridSegment.boundarySteps(candidateSegments);
        if (ownBoundarySteps.isEmpty()) {
            return empty();
        }
        if (normalizedCandidates.isEmpty()) {
            return boundaryStepsShape();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (GridSegment segment : ownBoundarySteps) {
            if (!normalizedCandidates.contains(segment)) {
                result.add(segment);
            }
        }
        return result.isEmpty() ? empty() : GridBoundary.fromBoundarySegments(result);
    }

    public List<GridBoundary> connectedComponents() {
        Set<GridSegment> boundarySteps = boundaryStepSet();
        if (boundarySteps.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment> remaining = new LinkedHashSet<>(boundarySteps.stream()
                .sorted(GridSegment.ORDER)
                .toList());
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
                    if (current.sharesEndpoint(candidate)) {
                        attached.add(candidate);
                    }
                }
                attached.sort(GridSegment.ORDER);
                for (GridSegment candidate : attached) {
                    remaining.remove(candidate);
                    queue.addLast(candidate);
                }
            }
            result.add(GridBoundary.fromBoundarySegments(component));
        }
        result.sort(Comparator.comparing(GridBoundary::firstSegment, GridSegment.ORDER));
        return List.copyOf(result);
    }

    public GridArea surface() {
        Set<GridSegment> boundaryEdges = boundaryStepSet();
        if (boundaryEdges.isEmpty()) {
            return GridArea.empty();
        }
        CellBounds bounds = cellBounds(boundaryEdges);
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (int y = bounds.minY(); y <= bounds.maxY(); y++) {
            for (int x = bounds.minX(); x <= bounds.maxX(); x++) {
                GridPoint candidate = new GridPoint(x, y, bounds.levelZ());
                if (isInsideEvenOdd(candidate, boundaryEdges)) {
                    result.add(candidate);
                }
            }
        }
        return result.isEmpty() ? GridArea.empty() : new GridArea(result);
    }

    public GridArea surfaceShape() {
        return surface();
    }

    @Override
    public GridBoundary translatedByCells(int dx, int dy, int dz) {
        if (dx == 0 && dy == 0 && dz == 0) {
            return this;
        }
        return new GridBoundary(segments.stream()
                .map(segment -> segment.translatedByCells(dx, dy, dz))
                .toList());
    }

    public GridBoundary translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), resolvedDelta.z());
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

    static List<GridSegment> normalizeSegments(Collection<GridSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        segments.stream()
                .filter(segment -> segment != null)
                .sorted(GridSegment.ORDER)
                .forEach(result::add);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    static List<GridSegment> normalizeBoundarySegments(Collection<GridSegment> segments) {
        List<GridSegment> normalized = normalizeSegments(GridSegment.boundarySteps(segments));
        for (GridSegment segment : normalized) {
            if (!segment.isBoundaryEdge()) {
                throw new IllegalArgumentException("Boundary segments must be boundary edges");
            }
        }
        return normalized;
    }

    private static boolean isInsideEvenOdd(GridPoint cell, Set<GridSegment> boundaryEdges) {
        int centerX2 = cell.x2();
        int centerY2 = cell.y2();
        long crossings = boundaryEdges.stream()
                .filter(GridSegment::isVertical)
                .filter(segment -> segment.start().y2() < centerY2 && segment.end().y2() > centerY2)
                .filter(segment -> segment.start().x2() > centerX2)
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
            for (GridPoint cell : segment.touchingCells()) {
                minX = Math.min(minX, cell.x());
                maxX = Math.max(maxX, cell.x());
                minY = Math.min(minY, cell.y());
                maxY = Math.max(maxY, cell.y());
            }
        }
        if (minX == Integer.MAX_VALUE) {
            return new CellBounds(0, 0, -1, -1, levelZ);
        }
        return new CellBounds(minX, minY, maxX, maxY, levelZ);
    }

    private record CellBounds(int minX, int minY, int maxX, int maxY, int levelZ) {
    }
}
