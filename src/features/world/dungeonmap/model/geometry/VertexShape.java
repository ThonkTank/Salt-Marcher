package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Set of explicit vertex positions on the doubled dungeon grid.
 */
public record VertexShape(Set<GridPoint2x> points) implements GridShape {

    public VertexShape {
        points = normalizePoints(points);
    }

    public VertexShape(Collection<GridPoint2x> points) {
        this(points == null ? Set.of() : new LinkedHashSet<>(points));
    }

    public boolean contains(GridPoint2x point) {
        return point != null && points.contains(point);
    }

    @Override
    public GridBounds2x bounds() {
        if (points.isEmpty()) {
            return GridBounds2x.empty();
        }
        int minX2 = points.stream().mapToInt(GridPoint2x::x2).min().orElse(0);
        int minY2 = points.stream().mapToInt(GridPoint2x::y2).min().orElse(0);
        int maxX2 = points.stream().mapToInt(GridPoint2x::x2).max().orElse(0);
        int maxY2 = points.stream().mapToInt(GridPoint2x::y2).max().orElse(0);
        return new GridBounds2x(minX2, minY2, maxX2, maxY2);
    }

    @Override
    public VertexShape translatedByCells(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        LinkedHashSet<GridPoint2x> translated = new LinkedHashSet<>();
        for (GridPoint2x point : points) {
            translated.add(point.translatedByCells(resolvedDelta));
        }
        return new VertexShape(translated);
    }

    private static Set<GridPoint2x> normalizePoints(Collection<GridPoint2x> input) {
        LinkedHashSet<GridPoint2x> result = new LinkedHashSet<>();
        if (input != null) {
            for (GridPoint2x point : input) {
                if (point == null) {
                    continue;
                }
                if (!point.isVertex()) {
                    throw new IllegalArgumentException("VertexShape only accepts doubled-grid vertex points");
                }
                result.add(point);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
