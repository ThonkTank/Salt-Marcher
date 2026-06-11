package src.domain.dungeon.model.core.structure.corridor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

final class CorridorReplacementRouteValidation {
    private static final CorridorHostRoomCells ROOM_CELLS = new CorridorHostRoomCells();
    private static final CorridorHostEndpointQuery ENDPOINTS = new CorridorHostEndpointQuery();
    private static final CorridorHostBackboneCells BACKBONE_CELLS = new CorridorHostBackboneCells();

    boolean hasValidReplacementRoute(
            DungeonMap dungeonMap,
            Corridor corridor,
            List<Corridor> candidateCorridors
    ) {
        if (dungeonMap == null || corridor == null || corridor.endpointCount() < 2) {
            return false;
        }
        Map<Long, DungeonRoomCluster> clustersById = ROOM_CELLS.clustersById(dungeonMap);
        Map<Long, List<Cell>> roomCellsByRoom = ROOM_CELLS.roomCellsByRoom(dungeonMap);
        List<CorridorHostEndpoint> endpoints = ENDPOINTS.endpoints(
                corridor,
                clustersById,
                ROOM_CELLS.roomsById(dungeonMap),
                roomCellsByRoom,
                ENDPOINTS.anchorBindingsByRef(candidateCorridors));
        List<Cell> backbone = corridor.stateBindings().waypoints().isEmpty()
                ? BACKBONE_CELLS.endpointBackbone(endpoints)
                : BACKBONE_CELLS.authoredBackbone(corridor.stateBindings().waypoints(), clustersById, endpoints);
        return hasUnblockedBackbone(backbone, ROOM_CELLS.allRoomCells(roomCellsByRoom));
    }

    private static boolean hasUnblockedBackbone(List<Cell> backbone, Set<Cell> roomCells) {
        if (backbone == null || backbone.size() < 2) {
            return false;
        }
        for (int index = 1; index < backbone.size(); index++) {
            CorridorRoute segment = CorridorRoute.between(backbone.get(index - 1), backbone.get(index));
            if (!segment.present() || segment.blockedBy(roomCells)) {
                return false;
            }
        }
        return true;
    }
}
