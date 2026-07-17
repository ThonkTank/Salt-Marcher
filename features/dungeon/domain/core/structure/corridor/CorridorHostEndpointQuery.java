package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorHostEndpointQuery {
    private static final long NO_ROOM_ID = 0L;
    private static final long NO_HOST_CORRIDOR_ID = 0L;
    private static final CorridorHostRoomCellSelection ROOM_CELL_SELECTION =
            new CorridorHostRoomCellSelection();

    List<CorridorHostEndpoint> endpoints(
            Corridor corridor,
            Map<Long, RoomCluster> clustersById,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        List<CorridorHostEndpoint> result = new ArrayList<>();
        appendRoomEndpoints(result, corridor, clustersById, roomsById, roomCellsByRoom);
        appendAnchorEndpoints(result, corridor, anchorsByKey);
        return List.copyOf(result);
    }

    Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey(List<Corridor> corridors) {
        Map<CorridorNetwork.AnchorKey, CorridorAnchor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
                    if (anchor != null) {
                        result.put(CorridorNetwork.AnchorKey.from(anchor), anchor);
                    }
                }
            }
        }
        return Map.copyOf(result);
    }

    private static void appendRoomEndpoints(
            List<CorridorHostEndpoint> result,
            Corridor corridor,
            Map<Long, RoomCluster> clustersById,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom
    ) {
        Map<Long, CorridorDoorBindingState> bindingsByRoom =
                CorridorDoorBindingGeometry.bindingsByRoom(corridor.stateBindings().doorBindings());
        for (Long roomId : corridor.roomIds()) {
            CorridorHostEndpoint endpoint = boundEndpoint(roomId, bindingsByRoom, clustersById);
            if (endpoint == null) {
                endpoint = derivedEndpoint(corridor, roomId, roomsById, roomCellsByRoom);
            }
            if (endpoint != null) {
                result.add(endpoint);
            }
        }
    }

    private static @Nullable CorridorHostEndpoint boundEndpoint(
            Long roomId,
            Map<Long, CorridorDoorBindingState> bindingsByRoom,
            Map<Long, RoomCluster> clustersById
    ) {
        CorridorDoorBindingState binding = bindingsByRoom.get(roomId);
        if (binding == null) {
            return null;
        }
        RoomCluster cluster = clustersById.get(binding.clusterId());
        if (cluster == null) {
            return null;
        }
        return new CorridorHostEndpoint(
                true,
                binding.roomId(),
                NO_HOST_CORRIDOR_ID,
                CorridorDoorBindingGeometry.absoluteCorridorCell(binding, cluster.center()));
    }

    private static @Nullable CorridorHostEndpoint derivedEndpoint(
            Corridor corridor,
            Long roomId,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom
    ) {
        RoomRegion room = roomsById.get(roomId);
        if (room == null) {
            return null;
        }
        List<Cell> roomCells = roomCellsByRoom.getOrDefault(roomId, List.of(room.primaryAnchor()));
        Set<Cell> roomCellSet = new LinkedHashSet<>(roomCells);
        Cell selectedRoomCell = ROOM_CELL_SELECTION.nearestRoomCell(roomCells, room.primaryAnchor());
        for (Direction direction : Direction.values()) {
            Cell corridorCell = direction.neighborOf(selectedRoomCell);
            if (!roomCellSet.contains(corridorCell)) {
                return new CorridorHostEndpoint(true, roomId, NO_HOST_CORRIDOR_ID, corridorCell);
            }
        }
        return new CorridorHostEndpoint(
                true,
                roomId,
                NO_HOST_CORRIDOR_ID,
                new Cell(selectedRoomCell.q(), selectedRoomCell.r() + 1, corridor.level()));
    }

    private static void appendAnchorEndpoints(
            List<CorridorHostEndpoint> result,
            Corridor corridor,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        for (CorridorAnchorRef anchorRef : corridor.stateBindings().anchorRefs()) {
            CorridorHostEndpoint endpoint = anchorEndpoint(anchorRef, anchorsByKey);
            if (endpoint != null) {
                result.add(endpoint);
            }
        }
    }

    private static @Nullable CorridorHostEndpoint anchorEndpoint(
            @Nullable CorridorAnchorRef anchorRef,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        if (anchorRef == null || !anchorRef.present()) {
            return null;
        }
        CorridorAnchor anchor = anchorsByKey.get(CorridorNetwork.AnchorKey.from(anchorRef));
        return anchor == null
                ? null
                : new CorridorHostEndpoint(false, NO_ROOM_ID, anchor.hostCorridorId(), anchor.position());
    }

}
