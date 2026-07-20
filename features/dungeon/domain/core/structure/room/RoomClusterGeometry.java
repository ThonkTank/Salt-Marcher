package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.door.DoorIndex;

public record RoomClusterGeometry(
        long clusterId,
        long mapId,
        Cell center,
        RoomClusterFloorMap floorMap,
        DoorIndex doorIndex
) {
    public RoomClusterGeometry(long clusterId, long mapId, Cell center, RoomClusterFloorMap floorMap) {
        this(clusterId, mapId, center, floorMap, DoorIndex.from(List.of()));
    }

    public RoomClusterGeometry {
        clusterId = Math.max(0L, clusterId);
        mapId = Math.max(0L, mapId);
        center = center == null ? new Cell(0, 0, 0) : center;
        floorMap = floorMap == null ? new RoomClusterFloorMap(Map.of()) : floorMap;
        doorIndex = doorIndex == null ? DoorIndex.from(List.of()) : doorIndex;
    }

    public static RoomClusterGeometry fromCells(long clusterId, long mapId, Set<Cell> cells) {
        List<Cell> sortedCells = RoomClusterCells.sortedCells(cells);
        Cell resolvedCenter = sortedCells.isEmpty() ? new Cell(0, 0, 0) : sortedCells.getFirst();
        return new RoomClusterGeometry(clusterId, mapId, resolvedCenter, RoomClusterFloorMap.fromCells(sortedCells));
    }

    @Override
    public RoomClusterFloorMap floorMap() {
        return new RoomClusterFloorMap(floorMap.cellsByLevel());
    }

    @Override
    public DoorIndex doorIndex() {
        return DoorIndex.from(doorIndex.doors());
    }

    public List<Cell> cellsAt(int level) {
        return floorMap.cellsAt(level);
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return floorMap.cellsByLevel();
    }

}
