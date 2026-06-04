package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.Room;
import src.domain.dungeon.model.core.structure.room.RoomClusterWork;

public record DungeonRoomTopologyClusterWork(
        DungeonRoomCluster cluster,
        List<DungeonRoom> rooms,
        Map<Integer, List<DungeonCell>> cellsByLevel
) {

    public DungeonRoomTopologyClusterWork {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        cellsByLevel = copyCellsByLevel(cellsByLevel);
    }

    public List<DungeonCell> cellsAt(int level) {
        return cellsByLevel.getOrDefault(level, List.of());
    }

    @Override
    public Map<Integer, List<DungeonCell>> cellsByLevel() {
        return copyCellsByLevel(cellsByLevel);
    }

    public List<DungeonCell> allCells() {
        List<DungeonCell> result = new ArrayList<>();
        for (List<DungeonCell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return DungeonCell.sortedByGeometry(result);
    }

    RoomClusterWork toCore() {
        List<Room> coreRooms = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            if (room != null) {
                coreRooms.add(room.toCore());
            }
        }
        return new RoomClusterWork(cluster.toCore(cellsByLevel), coreRooms);
    }

    static DungeonRoomTopologyClusterWork fromCore(
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

    private static Map<Integer, List<DungeonCell>> fromCoreCellsByLevel(Map<Integer, List<Cell>> source) {
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            List<DungeonCell> cells = new ArrayList<>();
            for (Cell cell : entry.getValue()) {
                cells.add(DungeonCell.fromGeometry(cell));
            }
            result.put(entry.getKey(), List.copyOf(cells));
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, List<DungeonCell>> copyCellsByLevel(Map<Integer, List<DungeonCell>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }
}
