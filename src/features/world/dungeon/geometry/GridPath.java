package features.world.dungeon.geometry;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class GridPath extends GridObject<GridPath> {

    private final List<GridPoint> points;

    public static GridPath empty() {
        return new GridPath(List.of());
    }

    public static GridPath of(List<GridPoint> points) {
        return new GridPath(points);
    }

    public static GridPath concat(GridPath... paths) {
        if (paths == null || paths.length == 0) {
            return empty();
        }
        ArrayList<GridPoint> result = new ArrayList<>();
        for (GridPath path : paths) {
            if (path == null || path.isEmpty()) {
                continue;
            }
            for (GridPoint point : path.points()) {
                if (point == null) {
                    continue;
                }
                if (!result.isEmpty() && Objects.equals(result.get(result.size() - 1), point)) {
                    continue;
                }
                result.add(point);
            }
        }
        return result.isEmpty() ? empty() : new GridPath(result);
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
            if (point == null) {
                continue;
            }
            appendCanonicalStepPath(result, point);
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendCanonicalStepPath(List<GridPoint> result, GridPoint nextPoint) {
        if (result.isEmpty()) {
            result.add(nextPoint);
            return;
        }
        GridPoint previous = result.get(result.size() - 1);
        if (Objects.equals(previous, nextPoint)) {
            return;
        }
        if (previous.z() != nextPoint.z()) {
            appendLevelTransition(result, previous, nextPoint);
            return;
        }
        appendSameLevelRun(result, previous, nextPoint);
    }

    private static void appendSameLevelRun(List<GridPoint> result, GridPoint start, GridPoint end) {
        int dx2 = end.x2() - start.x2();
        int dy2 = end.y2() - start.y2();
        if (dx2 != 0 && dy2 != 0) {
            throw new IllegalArgumentException("GridPath same-level steps must stay axis-aligned");
        }
        int stepX2 = Integer.compare(dx2, 0);
        int stepY2 = Integer.compare(dy2, 0);
        GridPoint current = start;
        while (!current.equals(end)) {
            current = GridPoint.lattice(current.x2() + stepX2, current.y2() + stepY2, current.z());
            result.add(current);
        }
    }

    private static void appendLevelTransition(List<GridPoint> result, GridPoint start, GridPoint end) {
        int dz = end.z() - start.z();
        if (Math.abs(dz) != 1) {
            throw new IllegalArgumentException("GridPath level transitions must move exactly one level");
        }
        int dx2 = end.x2() - start.x2();
        int dy2 = end.y2() - start.y2();
        if (dx2 != 0 && dy2 != 0) {
            throw new IllegalArgumentException("GridPath level transitions must stay axis-aligned");
        }
        int planarDistance2 = Math.abs(dx2) + Math.abs(dy2);
        if (planarDistance2 > 2) {
            throw new IllegalArgumentException("GridPath level transitions may move at most one cell per level");
        }
        result.add(end);
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
