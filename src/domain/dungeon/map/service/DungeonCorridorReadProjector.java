package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonCorridorReadProjector {

    private static final DungeonCorridorEndpointResolver ENDPOINT_RESOLVER = new DungeonCorridorEndpointResolver();
    private static final DungeonCorridorCellProjector CELL_PROJECTOR = new DungeonCorridorCellProjector();

    public DungeonCorridorProjection project(
            List<DungeonCorridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom,
            long primitiveId,
            Map<DungeonBoundaryKey, Long> existingDoorIdsByKey
    ) {
        DungeonCorridorProjectionAssembler result =
                new DungeonCorridorProjectionAssembler(primitiveId, existingDoorIdsByKey);
        Set<DungeonCell> allRoomCells = allRoomCells(roomCellsByRoom);
        Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef =
                ENDPOINT_RESOLVER.anchorBindingsByRef(corridors);
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor == null || !DungeonCorridorOps.isReadable(corridor)) {
                continue;
            }
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints = ENDPOINT_RESOLVER.corridorEndpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByRef);
            result.addCorridor(corridor, endpoints, CELL_PROJECTOR.corridorCells(corridor, clustersById, endpoints, allRoomCells));
        }
        return result.toProjection();
    }

    private static Set<DungeonCell> allRoomCells(Map<Long, List<DungeonCell>> roomCellsByRoom) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (List<DungeonCell> roomCells : roomCellsByRoom.values()) {
            result.addAll(roomCells);
        }
        return Set.copyOf(result);
    }
}
