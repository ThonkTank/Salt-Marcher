package features.dungeon.domain.core.structure.corridor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorHostCellQuery {
    private static final CorridorHostRoomCells ROOM_CELLS = new CorridorHostRoomCells();
    private static final CorridorHostEndpointQuery ENDPOINTS = new CorridorHostEndpointQuery();
    private static final CorridorHostCellDerivation CELLS = new CorridorHostCellDerivation();

    Map<Long, List<Cell>> cellsByCorridor(DungeonMap dungeonMap, List<Corridor> corridors) {
        if (dungeonMap == null) {
            return Map.of();
        }
        Map<Long, RoomCluster> clustersById = ROOM_CELLS.clustersById(dungeonMap);
        Map<Long, RoomRegion> roomsById = ROOM_CELLS.roomsById(dungeonMap);
        Map<Long, List<Cell>> roomCellsByRoom = ROOM_CELLS.roomCellsByRoom(dungeonMap);
        Set<Cell> allRoomCells = ROOM_CELLS.allRoomCells(roomCellsByRoom);
        Map<CorridorNetwork.AnchorKey, features.dungeon.domain.core.component.CorridorAnchor> anchorsByKey =
                ENDPOINTS.anchorsByKey(corridors);
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null && corridor.isReadable()) {
                result.put(
                        corridor.corridorId(),
                        CELLS.corridorCells(
                                corridor,
                                clustersById,
                                ENDPOINTS.endpoints(
                                        corridor,
                                        clustersById,
                                        roomsById,
                                        roomCellsByRoom,
                                        anchorsByKey),
                                allRoomCells));
            }
        }
        return Map.copyOf(result);
    }
}
