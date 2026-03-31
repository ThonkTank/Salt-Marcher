package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Floor;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public record CorridorPath(Set<CubePoint> cells) {
    public CorridorPath {
        cells = copyCells(cells);
    }

    public static CorridorPath empty() {
        return new CorridorPath(Set.of());
    }

    public static CorridorPath fromCells(Collection<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return empty();
        }
        return new CorridorPath(new LinkedHashSet<>(cells));
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
        Set<Point2i> projectedCells = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null) {
                projectedCells.add(cell.projectedCell());
            }
        }
        return new Floor(TileShape.fromAbsoluteCells(projectedCells));
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
