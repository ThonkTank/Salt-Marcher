package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Canonical tile-shape carrier for projected grid occupancy.
 *
 * <p>Single-level shapes use the default internal level key {@code 0}; multi-level owners such as stairs may
 * populate multiple levels directly.</p>
 */
public class TileShape {

    private final Map<Integer, Set<CellCoord>> cellsByLevel;

    public static TileShape empty() {
        return new TileShape(Map.of());
    }

    public static TileShape fromCubePoints(Collection<CubePoint> cubePoints) {
        if (cubePoints == null || cubePoints.isEmpty()) {
            return empty();
        }
        Map<Integer, LinkedHashSet<CellCoord>> mutable = new LinkedHashMap<>();
        for (CubePoint point : cubePoints) {
            if (point == null) {
                continue;
            }
            mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                    .add(point.projectedCell());
        }
        return new TileShape(immutableCellsByLevel(mutable));
    }

    public TileShape(Collection<CellCoord> cellCoords) {
        this(singleLevelMap(0, cellCoords));
    }

    protected TileShape(TileShape other) {
        this(other == null ? Map.of() : other.cellsByLevelView());
    }

    public TileShape(Map<Integer, ? extends Collection<CellCoord>> cellsByLevel) {
        this.cellsByLevel = normalizeCellsByLevel(cellsByLevel);
    }

    public Set<Integer> levels() {
        return cellsByLevel.keySet();
    }

    public int primaryLevel() {
        return cellsByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public boolean isEmpty() {
        return cellsByLevel.isEmpty() || cellsByLevel.values().stream().allMatch(Set::isEmpty);
    }

    public Set<CellCoord> cellCoords() {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (Set<CellCoord> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Set<CellCoord> cellCoordsAtLevel(int levelZ) {
        return cellsByLevel.getOrDefault(levelZ, Set.of());
    }

    public Set<CubePoint> cubePoints() {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : cellsByLevel.entrySet()) {
            for (CellCoord cell : entry.getValue()) {
                result.add(CubePoint.at(cell, entry.getKey()));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && cellsByLevel.values().stream().anyMatch(cells -> cells.contains(cell));
    }

    public boolean contains(CellCoord cell, int levelZ) {
        return cell != null && cellCoordsAtLevel(levelZ).contains(cell);
    }

    public boolean contains(CubePoint point) {
        return point != null && contains(point.projectedCell(), point.z());
    }

    public CellCoord centerCellCoord() {
        Set<CellCoord> cells = cellCoords();
        return cells.isEmpty() ? null : CellCoord.bestCenter(cells);
    }

    public CellCoord centerCellCoordAtLevel(int levelZ) {
        Set<CellCoord> cells = cellCoordsAtLevel(levelZ);
        return cells.isEmpty() ? null : CellCoord.bestCenter(cells);
    }

    public TileShape translatedByCells(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        Map<Integer, LinkedHashSet<CellCoord>> translated = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : cellsByLevel.entrySet()) {
            LinkedHashSet<CellCoord> levelCells = new LinkedHashSet<>();
            for (CellCoord cell : entry.getValue()) {
                levelCells.add(cell.add(resolvedDelta));
            }
            translated.put(entry.getKey() + levelDelta, levelCells);
        }
        return new TileShape(immutableCellsByLevel(translated));
    }

    protected final Map<Integer, Set<CellCoord>> cellsByLevelView() {
        return cellsByLevel;
    }

    protected static Map<Integer, Set<CellCoord>> normalizeCellsByLevel(
            Map<Integer, ? extends Collection<CellCoord>> cellsByLevel
    ) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    Set<CellCoord> normalized = CellCoord.normalize(entry.getValue());
                    if (!normalized.isEmpty()) {
                        result.put(entry.getKey(), normalized);
                    }
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Collection<CellCoord>> singleLevelMap(int levelZ, Collection<CellCoord> cellCoords) {
        Map<Integer, Collection<CellCoord>> result = new LinkedHashMap<>();
        result.put(levelZ, cellCoords == null ? Set.of() : cellCoords);
        return result;
    }

    private static Map<Integer, Set<CellCoord>> immutableCellsByLevel(Map<Integer, LinkedHashSet<CellCoord>> cellsByLevel) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    Set<CellCoord> normalized = CellCoord.normalize(entry.getValue());
                    if (!normalized.isEmpty()) {
                        result.put(entry.getKey(), normalized);
                    }
                });
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }
}
