package features.world.dungeonmap.model.geometry;

import java.util.Collection;
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
}
