package src.domain.dungeon.model.core.projection;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.DungeonCorridor;
import src.domain.dungeon.model.worldspace.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.worldspace.DungeonRoom;
import src.domain.dungeon.model.worldspace.DungeonRoomCluster;

/**
 * Transitional projection boundary: remove the worldspace inputs once
 * corridor, room, and cluster read facts are supplied directly by core
 * structure owners.
 */
public final class DungeonCorridorReadProjection {

    private static final DungeonCorridorEndpointResolver ENDPOINT_RESOLVER = new DungeonCorridorEndpointResolver();
    private static final DungeonCorridorCellProjection CELL_PROJECTOR = new DungeonCorridorCellProjection();

    public DungeonCorridorProjection project(
            List<DungeonCorridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            long boundaryIdCursor,
            Map<DungeonBoundaryKey, Long> existingDoorIdsByKey
    ) {
        DungeonCorridorProjectionAssembler result =
                new DungeonCorridorProjectionAssembler(boundaryIdCursor, existingDoorIdsByKey);
        Set<Cell> allRoomCells = allRoomCells(roomCellsByRoom);
        Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef =
                ENDPOINT_RESOLVER.anchorBindingsByRef(corridors);
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor == null || !corridor.isReadable()) {
                continue;
            }
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints = ENDPOINT_RESOLVER.corridorEndpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByRef);
            result.addCorridor(
                    corridor,
                    endpoints,
                    CELL_PROJECTOR.corridorCells(corridor, clustersById, endpoints, allRoomCells));
        }
        return result.toProjection();
    }

    private static Set<Cell> allRoomCells(Map<Long, List<Cell>> roomCellsByRoom) {
        Set<Cell> result = new LinkedHashSet<>();
        for (List<Cell> roomCells : roomCellsByRoom == null ? List.<List<Cell>>of() : roomCellsByRoom.values()) {
            result.addAll(roomCells);
        }
        return Set.copyOf(result);
    }
}
