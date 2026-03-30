package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Floor;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record CorridorPath(
        GridRoute route,
        Set<CubePoint> cells
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        cells = copyCells(cells);
    }

    public static CorridorPath empty() {
        return new CorridorPath(GridRoute.empty(), Set.of());
    }

    public static CorridorPath fromPoints(int levelZ, Collection<? extends GridAnchor> points) {
        GridRoute route = points == null ? GridRoute.empty() : new GridRoute(points);
        return new CorridorPath(route, cellsForRoute(route, levelZ));
    }

    public Map<Integer, Floor> floorsByLevel() {
        if (cells.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint cell : cells) {
            if (cell == null) {
                continue;
            }
            cellsByLevel.computeIfAbsent(cell.z(), ignored -> new LinkedHashSet<>())
                    .add(cell.projectedCell());
        }
        Map<Integer, Floor> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Point2i>> entry : cellsByLevel.entrySet()) {
            result.put(entry.getKey(), new Floor(TileShape.fromAbsoluteCells(entry.getValue())));
        }
        return Map.copyOf(result);
    }

    public Floor floor() {
        Set<Point2i> cells = new LinkedHashSet<>();
        for (CubePoint cell : this.cells) {
            if (cell != null) {
                cells.add(cell.projectedCell());
            }
        }
        return new Floor(TileShape.fromAbsoluteCells(cells));
    }

    public Floor floorAtLevel(int levelZ) {
        Set<Point2i> projectedCells = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null && cell.z() == levelZ) {
                projectedCells.add(cell.projectedCell());
            }
        }
        return new Floor(TileShape.fromAbsoluteCells(projectedCells));
    }

    public Set<Integer> levels() {
        if (cells.isEmpty()) {
            return Set.of();
        }
        Set<Integer> result = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null) {
                result.add(cell.z());
            }
        }
        return Collections.unmodifiableSet(result);
    }

    private static Set<CubePoint> cellsForRoute(GridRoute route, int levelZ) {
        if (route == null || route.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (GridRoute.Segment segment : route.segments()) {
            Point2i start = segment.startGridPoint2();
            Point2i end = segment.endGridPoint2();
            if (start.x() == end.x()) {
                addVerticalCells(result, start.x(), start.y(), end.y(), levelZ);
                continue;
            }
            if (start.y() == end.y()) {
                addHorizontalCells(result, start.y(), start.x(), end.x(), levelZ);
            }
        }
        return result.isEmpty() ? Set.of() : Collections.unmodifiableSet(result);
    }

    private static void addVerticalCells(Set<CubePoint> result, int x2, int startY2, int endY2, int levelZ) {
        if ((x2 & 1) == 0) {
            return;
        }
        int minY2 = Math.min(startY2, endY2);
        int maxY2 = Math.max(startY2, endY2);
        for (int y2 = firstOddAtOrAbove(minY2); y2 <= maxY2; y2 += 2) {
            result.add(new CubePoint((x2 - 1) / 2, (y2 - 1) / 2, levelZ));
        }
    }

    private static void addHorizontalCells(Set<CubePoint> result, int y2, int startX2, int endX2, int levelZ) {
        if ((y2 & 1) == 0) {
            return;
        }
        int minX2 = Math.min(startX2, endX2);
        int maxX2 = Math.max(startX2, endX2);
        for (int x2 = firstOddAtOrAbove(minX2); x2 <= maxX2; x2 += 2) {
            result.add(new CubePoint((x2 - 1) / 2, (y2 - 1) / 2, levelZ));
        }
    }

    private static int firstOddAtOrAbove(int value) {
        return (value & 1) == 1 ? value : value + 1;
    }

    private static Set<CubePoint> copyCells(Set<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        Set<CubePoint> result = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        if (result.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(result);
    }
}
