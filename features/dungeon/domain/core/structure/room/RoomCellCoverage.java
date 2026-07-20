package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellLoopSequence;
import features.dungeon.domain.core.geometry.CellOrdering;

public final class RoomCellCoverage {

    public static final Cell LOOP_SEPARATOR = CellLoopSequence.LOOP_SEPARATOR;

    public Map<Long, List<Cell>> cellsByRoom(
            RoomCluster cluster,
            List<RoomRegion> rooms
    ) {
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                result.put(room.roomId(), CellOrdering.sortedCells(room.floorCells()));
            }
        }
        return Map.copyOf(result);
    }

    public Map<Integer, List<Cell>> cellsByLevel(
            RoomCluster cluster,
            List<RoomRegion> rooms
    ) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                for (Map.Entry<Integer, List<Cell>> entry : room.cellsByLevel().entrySet()) {
                    result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
                }
            }
        }
        Map<Integer, List<Cell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : result.entrySet()) {
            normalized.put(entry.getKey(), CellOrdering.sortedCells(entry.getValue()));
        }
        return Map.copyOf(normalized);
    }

    public Set<Cell> clusterCells(
            RoomCluster cluster,
            List<RoomRegion> rooms,
            int level
    ) {
        Set<Cell> cells = new LinkedHashSet<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room != null) {
                cells.addAll(room.cellsAt(level));
            }
        }
        if (cells.isEmpty()) {
            cluster.orderedAuthoredBoundaries().stream()
                    .filter(boundary -> boundary.level() == level)
                    .flatMap(boundary -> boundary.edge().touchingCells().stream())
                    .findFirst()
                    .ifPresent(cells::add);
        }
        return Set.copyOf(cells);
    }

    private static Set<Integer> levels(RoomCluster cluster, List<RoomRegion> rooms) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.addAll(cluster.boundaryLevels());
        for (RoomRegion room : rooms) {
            levels.addAll(room.cellsByLevel().keySet());
        }
        return levels;
    }

}
