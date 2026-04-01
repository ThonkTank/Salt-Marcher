package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Ordered, non-branching edge path on the doubled dungeon grid.
 */
public record EdgePathShape(List<GridSegment2x> segments) implements GridShape {

    public EdgePathShape {
        segments = normalizeSegments(segments);
        validatePath(segments);
    }

    public EdgePathShape(Collection<GridSegment2x> segments) {
        this(segments == null ? List.of() : new java.util.ArrayList<>(segments));
    }

    @Override
    public GridBounds2x bounds() {
        if (segments.isEmpty()) {
            return GridBounds2x.empty();
        }
        int minX2 = Integer.MAX_VALUE;
        int minY2 = Integer.MAX_VALUE;
        int maxX2 = Integer.MIN_VALUE;
        int maxY2 = Integer.MIN_VALUE;
        for (GridSegment2x segment : segments) {
            minX2 = Math.min(minX2, segment.minX2());
            minY2 = Math.min(minY2, segment.minY2());
            maxX2 = Math.max(maxX2, segment.maxX2());
            maxY2 = Math.max(maxY2, segment.maxY2());
        }
        return new GridBounds2x(minX2, minY2, maxX2, maxY2);
    }

    @Override
    public EdgePathShape translatedByCells(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new EdgePathShape(segments.stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList());
    }

    private static List<GridSegment2x> normalizeSegments(Collection<GridSegment2x> input) {
        LinkedHashSet<GridSegment2x> seen = new LinkedHashSet<>();
        if (input != null) {
            for (GridSegment2x segment : input) {
                if (segment == null) {
                    continue;
                }
                if (!seen.add(segment)) {
                    throw new IllegalArgumentException("EdgePathShape does not allow duplicate segments");
                }
            }
        }
        return seen.isEmpty() ? List.of() : List.copyOf(seen);
    }

    private static void validatePath(List<GridSegment2x> segments) {
        if (segments.size() <= 1) {
            return;
        }
        for (int index = 1; index < segments.size(); index++) {
            GridSegment2x previous = segments.get(index - 1);
            GridSegment2x current = segments.get(index);
            if (!previous.sharesEndpoint(current)) {
                throw new IllegalArgumentException("EdgePathShape requires connected ordered segments");
            }
        }
        Map<GridPoint2x, Integer> degreeByPoint = new LinkedHashMap<>();
        for (GridSegment2x segment : segments) {
            degreeByPoint.merge(segment.start(), 1, Integer::sum);
            degreeByPoint.merge(segment.end(), 1, Integer::sum);
        }
        for (Map.Entry<GridPoint2x, Integer> entry : degreeByPoint.entrySet()) {
            if (entry.getValue() > 2) {
                throw new IllegalArgumentException("EdgePathShape may not branch");
            }
        }
    }
}
