package features.dungeon.domain.core.projection;

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
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorNetwork;
import features.dungeon.domain.core.component.CorridorDoorBinding;
import features.dungeon.domain.core.structure.corridor.CorridorDoorBindingGeometry;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

/**
 * Projection boundary for corridor endpoint read facts. This resolver derives
 * read facts only and must not own corridor mutation policy.
 */
final class DungeonCorridorEndpointResolver {

    List<CorridorEndpoint> corridorEndpoints(
            Corridor corridor,
            Map<Long, RoomCluster> clustersById,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        List<CorridorEndpoint> endpoints = new ArrayList<>();
        appendRoomEndpoints(
                endpoints,
                corridor,
                CorridorDoorBindingGeometry.bindingsByRoom(corridor.bindings().doorBindings()),
                clustersById,
                roomsById,
                roomCellsByRoom);
        appendAnchorEndpoints(endpoints, corridor, anchorsByKey);
        return List.copyOf(endpoints);
    }

    Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey(List<Corridor> corridors) {
        Map<CorridorNetwork.AnchorKey, CorridorAnchor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            for (CorridorAnchor anchor : corridor.bindings().anchorBindings()) {
                if (anchor != null) {
                    result.put(CorridorNetwork.AnchorKey.from(anchor), anchor);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static void appendRoomEndpoints(
            List<CorridorEndpoint> endpoints,
            Corridor corridor,
            Map<Long, CorridorDoorBinding> bindingsByRoom,
            Map<Long, RoomCluster> clustersById,
            Map<Long, RoomRegion> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom
    ) {
        for (Long roomId : corridor.roomIds()) {
            CorridorEndpoint endpoint = boundEndpoint(roomId, bindingsByRoom, clustersById);
            if (endpoint == null) {
                endpoint = derivedEndpoint(corridor, roomId, roomsById, roomCellsByRoom);
            }
            if (endpoint != null) {
                endpoints.add(endpoint);
            }
        }
    }

    private static @Nullable CorridorEndpoint boundEndpoint(
            Long roomId,
            Map<Long, CorridorDoorBinding> bindingsByRoom,
            Map<Long, RoomCluster> clustersById
    ) {
        CorridorDoorBinding binding = bindingsByRoom.get(roomId);
        if (binding == null) {
            return null;
        }
        RoomCluster cluster = clustersById.get(binding.clusterId());
        if (cluster == null) {
            return null;
        }
        return new CorridorEndpoint(
                CorridorEndpointKind.DOOR,
                roomId,
                null,
                CorridorDoorBindingGeometry.absoluteCorridorCell(binding, cluster.center()),
                CorridorDoorBindingGeometry.absoluteDoorEdge(binding, cluster.center()),
                binding.topologyRef());
    }

    private static void appendAnchorEndpoints(
            List<CorridorEndpoint> endpoints,
            Corridor corridor,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        for (CorridorAnchorRef anchorRef : corridor.bindings().anchorRefs()) {
            CorridorEndpoint endpoint = anchorEndpoint(anchorRef, anchorsByKey);
            if (endpoint != null) {
                endpoints.add(endpoint);
            }
        }
    }

    private static @Nullable CorridorEndpoint anchorEndpoint(
            @Nullable CorridorAnchorRef anchorRef,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        if (anchorRef == null || !anchorRef.present()) {
            return null;
        }
        CorridorAnchor anchor = anchorsByKey.get(CorridorNetwork.AnchorKey.from(anchorRef));
        if (anchor == null) {
            return null;
        }
        return new CorridorEndpoint(
                CorridorEndpointKind.ANCHOR,
                null,
                anchor.hostCorridorId(),
                anchor.position(),
                null,
                DungeonTopologyRef.corridorAnchor(anchor.anchorId()));
    }

    private static @Nullable CorridorEndpoint derivedEndpoint(
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
        Cell anchor = room.primaryAnchor();
        Cell selectedRoomCell = nearestRoomCell(roomCells, anchor);
        for (Direction direction : Direction.values()) {
            Cell corridorCell = direction.neighborOf(selectedRoomCell);
            if (!roomCellSet.contains(corridorCell)) {
                return new CorridorEndpoint(
                        CorridorEndpointKind.DOOR,
                        roomId,
                        null,
                        corridorCell,
                        Edge.sideOf(selectedRoomCell, direction),
                        DungeonTopologyRef.empty());
            }
        }
        Cell fallbackCorridorCell = new Cell(
                selectedRoomCell.q(),
                selectedRoomCell.r() + 1,
                corridor.level());
        return new CorridorEndpoint(
                CorridorEndpointKind.DOOR,
                roomId,
                null,
                fallbackCorridorCell,
                Edge.sideOf(selectedRoomCell, Direction.SOUTH),
                DungeonTopologyRef.empty());
    }

    private static int manhattan(Cell left, Cell right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private static Cell nearestRoomCell(List<Cell> roomCells, Cell anchor) {
        Cell result = anchor;
        for (Cell cell : roomCells == null ? List.<Cell>of() : roomCells) {
            if (cell != null && betterRoomCell(cell, result, anchor)) {
                result = cell;
            }
        }
        return result;
    }

    private static boolean betterRoomCell(Cell candidate, Cell current, Cell anchor) {
        int distanceComparison = Integer.compare(manhattan(candidate, anchor), manhattan(current, anchor));
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        int rowComparison = Integer.compare(candidate.r(), current.r());
        if (rowComparison != 0) {
            return rowComparison < 0;
        }
        return candidate.q() < current.q();
    }

    record CorridorEndpoint(
            CorridorEndpointKind kind,
            @Nullable Long roomId,
            @Nullable Long hostCorridorId,
            Cell corridorCell,
            @Nullable Edge edge,
            DungeonTopologyRef topologyRef
    ) {
        CorridorEndpoint {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }

        boolean isDoor() {
            return kind == CorridorEndpointKind.DOOR;
        }
    }

    enum CorridorEndpointKind {
        DOOR,
        ANCHOR
    }
}
