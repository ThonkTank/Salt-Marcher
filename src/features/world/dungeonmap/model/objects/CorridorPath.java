package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Runtime-owned routed connection structure for one corridor.
 *
 * <p>The canonical editable truth lives on corridor bindings. This object only carries the currently resolved
 * routed shape that connectivity planning produced for runtime use and rendering.</p>
 */
public record CorridorPath(
        GridRoute route,
        Set<CubePoint> cells,
        boolean directlyAdjacent,
        boolean routable
) {
    public CorridorPath {
        route = route == null ? GridRoute.empty() : route;
        cells = copyCells(cells);
    }

    public static CorridorPath empty() {
        return new CorridorPath(
                GridRoute.empty(),
                Set.of(),
                false,
                false);
    }

    public static CorridorPath unroutable(GridRoute route) {
        return new CorridorPath(
                route,
                Set.of(),
                false,
                false);
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

    public boolean isMultiLevel() {
        return levels().size() > 1;
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
