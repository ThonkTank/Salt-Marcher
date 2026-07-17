package features.dungeon.adapter.sqlite.mapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterFloorCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomClusterFloorMap;
import features.dungeon.domain.core.structure.room.RoomRegion;

final class DungeonClusterFloorCellRecordMapperSupport {

    private DungeonClusterFloorCellRecordMapperSupport() {
    }

    static RoomClusterFloorMap floorMap(DungeonRoomClusterRecord record) {
        return new RoomClusterFloorMap(floorCellsByLevel(record));
    }

    static List<DungeonRoomClusterFloorCellRecord> toFloorCellRecords(
            long clusterId,
            List<RoomRegion> rooms
    ) {
        List<DungeonRoomClusterFloorCellRecord> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms) {
            if (room == null || room.clusterId() != clusterId) {
                continue;
            }
            for (Cell cell : room.floorCells()) {
                result.add(new DungeonRoomClusterFloorCellRecord(
                        clusterId,
                        cell.level(),
                        cell.q(),
                        cell.r()));
            }
        }
        result.sort(Comparator
                .comparingLong(DungeonRoomClusterFloorCellRecord::clusterId)
                .thenComparingInt(DungeonRoomClusterFloorCellRecord::levelZ)
                .thenComparingInt(DungeonRoomClusterFloorCellRecord::cellY)
                .thenComparingInt(DungeonRoomClusterFloorCellRecord::cellX));
        return List.copyOf(result);
    }

    private static Map<Integer, List<Cell>> floorCellsByLevel(List<DungeonRoomClusterFloorCellRecord> records) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonRoomClusterFloorCellRecord record
                : records == null ? List.<DungeonRoomClusterFloorCellRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new Cell(record.cellX(), record.cellY(), record.levelZ()));
        }
        return immutableSortedCellMap(result);
    }

    private static Map<Integer, List<Cell>> floorCellsByLevel(DungeonRoomClusterRecord record) {
        return floorCellsByLevel(record.floorCells());
    }

    private static Map<Integer, List<Cell>> immutableSortedCellMap(Map<Integer, List<Cell>> source) {
        if (source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        List<Integer> levels = new ArrayList<>(source.keySet());
        Collections.sort(levels);
        for (Integer level : levels) {
            Set<Cell> uniqueCells = new LinkedHashSet<>(source.getOrDefault(level, List.of()));
            List<Cell> sortedCells = new ArrayList<>(uniqueCells);
            sortedCells.sort(CellOrdering::compareCells);
            result.put(level, List.copyOf(sortedCells));
        }
        return Map.copyOf(result);
    }

}
