package src.domain.dungeon.model.map.model;


import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonCorridorReadProjection {

    private static final DungeonCorridorEndpointResolver ENDPOINT_RESOLVER = new DungeonCorridorEndpointResolver();
    private static final DungeonCorridorCellProjection CELL_PROJECTOR = new DungeonCorridorCellProjection();

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
            if (corridor == null || !corridor.isReadable()) {
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
