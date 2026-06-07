package src.domain.dungeon.model.core.structure.corridor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

final class CorridorHostCellQuery {
    private static final CorridorHostRoomCells ROOM_CELLS = new CorridorHostRoomCells();
    private static final CorridorHostEndpointQuery ENDPOINTS = new CorridorHostEndpointQuery();
    private static final CorridorHostCellDerivation CELLS = new CorridorHostCellDerivation();

    Map<Long, List<Cell>> cellsByCorridor(DungeonMap dungeonMap, List<Corridor> corridors) {
        if (dungeonMap == null) {
            return Map.of();
        }
        Map<Long, DungeonRoomCluster> clustersById = ROOM_CELLS.clustersById(dungeonMap);
        Map<Long, DungeonRoom> roomsById = ROOM_CELLS.roomsById(dungeonMap);
        Map<Long, List<Cell>> roomCellsByRoom = ROOM_CELLS.roomCellsByRoom(dungeonMap);
        Set<Cell> allRoomCells = ROOM_CELLS.allRoomCells(roomCellsByRoom);
        Map<DungeonTopologyRef, CorridorAnchorBinding> anchorsByRef = ENDPOINTS.anchorBindingsByRef(corridors);
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
                                        anchorsByRef),
                                allRoomCells));
            }
        }
        return Map.copyOf(result);
    }
}
