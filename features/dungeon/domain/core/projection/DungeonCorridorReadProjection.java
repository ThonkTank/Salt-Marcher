package features.dungeon.domain.core.projection;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorNetwork;
import features.dungeon.domain.core.structure.room.DungeonRoom;
import features.dungeon.domain.core.structure.room.DungeonRoomCluster;

/**
 * Projection boundary for corridor, room, and cluster read facts supplied by
 * core structure owners.
 */
public final class DungeonCorridorReadProjection {

    private static final DungeonCorridorEndpointResolver ENDPOINT_RESOLVER = new DungeonCorridorEndpointResolver();
    private static final DungeonCorridorCellProjection CELL_PROJECTOR = new DungeonCorridorCellProjection();

    public DungeonCorridorProjection project(
            List<Corridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            long boundaryIdCursor,
            Map<DungeonBoundaryKey, Long> existingDoorIdsByKey
    ) {
        DungeonCorridorProjectionAssembler result =
                new DungeonCorridorProjectionAssembler(boundaryIdCursor, existingDoorIdsByKey);
        Set<Cell> allRoomCells = allRoomCells(roomCellsByRoom);
        Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey =
                ENDPOINT_RESOLVER.anchorsByKey(corridors);
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor == null || !corridor.isReadable()) {
                continue;
            }
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints = ENDPOINT_RESOLVER.corridorEndpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByKey);
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
