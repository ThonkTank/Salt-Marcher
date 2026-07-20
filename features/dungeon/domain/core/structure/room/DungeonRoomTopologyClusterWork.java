package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.Selection;

public record DungeonRoomTopologyClusterWork(
        RoomCluster cluster,
        List<RoomRegion> rooms,
        Map<Integer, List<Cell>> cellsByLevel
) {

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

    public RoomCluster rebuiltClusterWithBoundaries(Map<Integer, List<BoundarySegment>> boundariesByLevel) {
        return cluster.rebuiltForTopologyWork(cellsByLevel, boundariesByLevel);
    }

    Optional<Selection> boundaryStretchSelection(
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return RoomClusterWallStretchSelection.resolve(
                cluster.boundaryMap(),
                stretchFloorMap(sourceEdges),
                safeEdges(sourceEdges),
                deltaQ,
                deltaR,
                deltaLevel);
    }

    private RoomClusterFloorMap stretchFloorMap(List<Edge> sourceEdges) {
        List<Edge> safeEdges = safeEdges(sourceEdges);
        if (safeEdges.isEmpty()) {
            return RoomClusterFloorMap.fromCells(List.of());
        }
        return RoomClusterFloorMap.fromCells(cellsAt(safeEdges.getFirst().from().level()));
    }

    public RoomClusterWork partitionWork() {
        return new RoomClusterWork(cluster.geometry(cellsByLevel), rooms);
    }

    public static DungeonRoomTopologyClusterWork fromPartitionWork(
            RoomClusterWork coreWork,
            DungeonRoomTopologyClusterWork previous
    ) {
        List<RoomRegion> nextRooms = new ArrayList<>();
        for (RoomRegion room : coreWork.rooms()) {
            nextRooms.add(room.withNarration(narrationFor(previous, room.roomId())));
        }
        return new DungeonRoomTopologyClusterWork(
                previous == null
                        ? RoomCluster.authored(
                                coreWork.cluster().clusterId(),
                                coreWork.cluster().mapId(),
                                "",
                                List.of())
                        : previous.cluster(),
                nextRooms,
                copiedCellsByLevel(coreWork.cellsByLevel()));
    }

    private static DungeonRoomNarration narrationFor(DungeonRoomTopologyClusterWork previous, long roomId) {
        if (previous == null) {
            return DungeonRoomNarration.empty();
        }
        for (RoomRegion room : previous.rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room.narration();
            }
        }
        return DungeonRoomNarration.empty();
    }

    private static Map<Integer, List<Cell>> copiedCellsByLevel(Map<Integer, List<Cell>> source) {
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

    private static List<Edge> safeEdges(List<Edge> edges) {
        List<Edge> result = new ArrayList<>();
        for (Edge edge : edges == null ? List.<Edge>of() : edges) {
            if (edge == null) {
                return List.of();
            }
            result.add(edge);
        }
        return List.copyOf(result);
    }
}
