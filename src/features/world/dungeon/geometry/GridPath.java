package features.world.dungeon.geometry;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridPath extends GridObject {

    private final List<GridPoint> points;

    public static GridPath empty() {
        return new GridPath(List.of());
    }

    public static GridPath of(List<GridPoint> points) {
        return new GridPath(points);
    }

    private GridPath(List<GridPoint> points) {
        this.points = normalizePoints(points);
    }

    public boolean isEmpty() {
        return points.isEmpty();
    }

    public List<GridPoint> points() {
        return points;
    }

    public boolean contains(GridPoint point) {
        return point != null && points.contains(point);
    }

    @Override
    public GridPath translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridPath(points.stream().map(point -> point.translated(resolvedTranslation)).toList());
    }

    @Override
    public Set<Integer> levels() {
        if (points.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridPoint point : points) {
            levels.add(point.z());
        }
        return Set.copyOf(levels);
    }

    @Override
    public GridArea cellFootprint() {
        LinkedHashSet<GridPoint> cells = new LinkedHashSet<>();
        for (GridPoint point : points) {
            cells.addAll(point.cellFootprint().cells());
        }
        return cells.isEmpty() ? GridArea.empty() : GridArea.of(cells);
    }

    private static List<GridPoint> normalizePoints(List<GridPoint> points) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        for (GridPoint point : points) {
            if (point != null) {
                result.add(point);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridPath path)) {
            return false;
        }
        return Objects.equals(points, path.points);
    }

    @Override
    public int hashCode() {
        return Objects.hash(points);
    }

    @Override
    public String toString() {
        return "GridPath[points=" + points + "]";
    }
}
