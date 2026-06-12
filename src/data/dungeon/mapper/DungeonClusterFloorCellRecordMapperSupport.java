package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.data.dungeon.model.DungeonRoomClusterFloorCellRecord;
import src.data.dungeon.model.DungeonRoomClusterRecord;
import src.data.dungeon.model.DungeonRoomClusterVertexRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellLoopRasterizer;
import src.domain.dungeon.model.core.geometry.CellLoopSequence;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterFloorMap;

final class DungeonClusterFloorCellRecordMapperSupport {

    private DungeonClusterFloorCellRecordMapperSupport() {
    }

    static Map<Integer, List<Cell>> compatibleRelativeLoopsByLevel(DungeonRoomClusterRecord record) {
        if (!floorCellsByLevel(record.floorCells()).isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> floorCellsByLevel = legacyVerticesAsFloorCellsByLevel(record);
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        Cell center = new Cell(record.centerX(), record.centerY(), record.levelZ());
        for (Map.Entry<Integer, List<Cell>> entry : floorCellsByLevel.entrySet()) {
            result.put(entry.getKey(), CellLoopSequence.relativeCellLoopVertices(center, entry.getValue()));
        }
        return DungeonNestedListMaps.immutableCopy(result);
    }

    static RoomClusterFloorMap floorMap(DungeonRoomClusterRecord record) {
        return new RoomClusterFloorMap(floorCellsByLevel(record));
    }

    static List<DungeonRoomClusterFloorCellRecord> toFloorCellRecords(
            long clusterId,
            DungeonRoomCluster cluster
    ) {
        List<DungeonRoomClusterFloorCellRecord> result = new ArrayList<>();
        for (Map.Entry<Integer, List<Cell>> entry : floorCellsByLevel(cluster).entrySet()) {
            for (Cell cell : entry.getValue()) {
                result.add(new DungeonRoomClusterFloorCellRecord(
                        clusterId,
                        entry.getKey(),
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
        Map<Integer, List<Cell>> floorCellsByLevel = floorCellsByLevel(record.floorCells());
        return floorCellsByLevel.isEmpty() ? legacyVerticesAsFloorCellsByLevel(record) : floorCellsByLevel;
    }

    private static Map<Integer, List<Cell>> legacyVerticesAsFloorCellsByLevel(DungeonRoomClusterRecord record) {
        Map<Integer, List<Cell>> verticesByLevel = verticesByLevel(record.vertices());
        if (verticesByLevel.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        Cell center = new Cell(record.centerX(), record.centerY(), record.levelZ());
        for (Map.Entry<Integer, List<Cell>> entry : verticesByLevel.entrySet()) {
            result.put(entry.getKey(), legacyFloorCells(record.clusterId(), center, entry));
        }
        return immutableSortedCellMap(result);
    }

    private static List<Cell> legacyFloorCells(
            long clusterId,
            Cell center,
            Map.Entry<Integer, List<Cell>> entry
    ) {
        try {
            return new ArrayList<>(CellLoopRasterizer.cellsFromRelativeVertices(
                    center,
                    entry.getKey(),
                    CellLoopSequence.splitBySeparator(entry.getValue())));
        } catch (ArithmeticException | IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Invalid legacy room-cluster vertex rows for cluster " + clusterId
                            + " on level " + entry.getKey(),
                    exception);
        }
    }

    private static Map<Integer, List<Cell>> verticesByLevel(List<DungeonRoomClusterVertexRecord> records) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonRoomClusterVertexRecord record
                : records == null ? List.<DungeonRoomClusterVertexRecord>of() : records) {
            result.computeIfAbsent(record.levelZ(), ignored -> new ArrayList<>())
                    .add(new Cell(record.relativeX(), record.relativeY(), record.levelZ()));
        }
        return DungeonNestedListMaps.immutableCopy(result);
    }

    private static Map<Integer, List<Cell>> floorCellsByLevel(DungeonRoomCluster cluster) {
        return new RoomClusterFloorMap(cluster.cellsByLevel()).cellsByLevel();
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
