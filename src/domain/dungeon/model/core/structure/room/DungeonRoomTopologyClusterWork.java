package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;

public record DungeonRoomTopologyClusterWork(
        DungeonRoomCluster cluster,
        List<DungeonRoom> rooms,
        Map<Integer, List<Cell>> cellsByLevel
) {

    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    public DungeonRoomTopologyClusterWork {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        cellsByLevel = copyCellsByLevel(cellsByLevel);
    }

    public List<Cell> cellsAt(int level) {
        return cellsByLevel.getOrDefault(level, List.of());
    }

    @Override
    public Map<Integer, List<Cell>> cellsByLevel() {
        return copyCellsByLevel(cellsByLevel);
    }

    public List<Cell> allCells() {
        List<Cell> result = new ArrayList<>();
        for (List<Cell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return CellOrdering.sortedCells(result);
    }

    public DungeonRoomCluster rebuiltCluster() {
        return rebuiltClusterWithBoundaries(preservedBoundaries());
    }

    public DungeonRoomCluster rebuiltClusterWithBoundaries(Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel) {
        return new DungeonRoomCluster(
                cluster.clusterId(),
                cluster.mapId(),
                cluster.center(),
                verticesByLevel(),
                boundariesByLevel);
    }

    public RoomClusterWork toCore() {
        List<Room> coreRooms = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null) {
                coreRooms.add(room.toCore());
            }
        }
        return new RoomClusterWork(cluster.toCore(cellsByLevel), coreRooms);
    }

    public static DungeonRoomTopologyClusterWork fromCore(
            RoomClusterWork coreWork,
            DungeonRoomTopologyClusterWork previous
    ) {
        List<DungeonRoom> nextRooms = new ArrayList<>();
        for (Room room : coreWork.rooms()) {
            nextRooms.add(DungeonRoom.fromCore(room, narrationFor(previous, room.roomId())));
        }
        return new DungeonRoomTopologyClusterWork(
                previous == null
                        ? DungeonRoomCluster.fromCore(coreWork.cluster(), Map.of(), Map.of())
                        : previous.cluster(),
                nextRooms,
                fromCoreCellsByLevel(coreWork.cellsByLevel()));
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork previous, long roomId) {
        if (previous == null) {
            return DungeonRoomNarration.empty();
        }
        for (DungeonRoom room : previous.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private Map<Integer, List<DungeonClusterBoundary>> preservedBoundaries() {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        Map<Integer, List<Cell>> oldCellsByLevel = CELL_COVERAGE.cellsByLevel(cluster, rooms);
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : cluster.boundariesByLevel().entrySet()) {
            Set<Cell> oldCells = new LinkedHashSet<>(oldCellsByLevel.getOrDefault(entry.getKey(), List.of()));
            Set<Cell> newCells = new LinkedHashSet<>(cellsByLevel.getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = new ArrayList<>();
            for (DungeonClusterBoundary boundary : entry.getValue()) {
                if (boundary != null && keepBoundary(boundary, oldCells, newCells)) {
                    preserved.add(boundary);
                }
            }
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), preserved);
            }
        }
        return Map.copyOf(result);
    }

    private boolean keepBoundary(
            DungeonClusterBoundary boundary,
            Set<Cell> oldCells,
            Set<Cell> newCells
    ) {
        Cell cell = boundary.absoluteCell(cluster.center());
        if (!newCells.contains(cell)) {
            return false;
        }
        Cell neighbor = boundary.direction().neighborOf(cell);
        if (!newCells.contains(neighbor)) {
            return true;
        }
        return boundary.isDoor() || oldCells.contains(cell) && oldCells.contains(neighbor);
    }

    private Map<Integer, List<Cell>> verticesByLevel() {
        Map<Integer, List<Cell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        CELL_COVERAGE.relativeCellLoops(cluster.center(), entry.getValue()));
            }
        }
        return Map.copyOf(verticesByLevel);
    }

    private static Map<Integer, List<Cell>> fromCoreCellsByLevel(Map<Integer, List<Cell>> source) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            List<Cell> cells = new ArrayList<>();
            for (Cell cell : entry.getValue()) {
                cells.add(cell);
            }
            result.put(entry.getKey(), List.copyOf(cells));
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<Cell>> copyCellsByLevel(Map<Integer, List<Cell>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }
}
