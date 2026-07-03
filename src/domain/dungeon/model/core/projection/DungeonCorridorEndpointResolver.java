package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.CorridorAnchor;
import src.domain.dungeon.model.core.component.CorridorAnchorRef;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingState;
import src.domain.dungeon.model.core.structure.corridor.CorridorDoorBindingGeometry;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

/**
 * Projection boundary for corridor endpoint read facts. This resolver derives
 * read facts only and must not own corridor mutation policy.
 */
final class DungeonCorridorEndpointResolver {

    List<CorridorEndpoint> corridorEndpoints(
            Corridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom,
            Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey
    ) {
        List<CorridorEndpoint> endpoints = new ArrayList<>();
        appendRoomEndpoints(
                endpoints,
                corridor,
                CorridorDoorBindingGeometry.bindingsByRoom(corridor.stateBindings().doorBindings()),
                clustersById,
                roomsById,
                roomCellsByRoom);
        appendAnchorEndpoints(endpoints, corridor, anchorsByKey);
        return List.copyOf(endpoints);
    }

    Map<CorridorNetwork.AnchorKey, CorridorAnchor> anchorsByKey(List<Corridor> corridors) {
        Map<CorridorNetwork.AnchorKey, CorridorAnchor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            for (CorridorAnchor anchor : corridor.stateBindings().anchorBindings()) {
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
            Map<Long, CorridorDoorBindingState> bindingsByRoom,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
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
            Map<Long, CorridorDoorBindingState> bindingsByRoom,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        CorridorDoorBindingState binding = bindingsByRoom.get(roomId);
        if (binding == null) {
            return null;
        }
        DungeonRoomCluster cluster = clustersById.get(binding.clusterId());
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
        for (CorridorAnchorRef anchorRef : corridor.stateBindings().anchorRefs()) {
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
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<Cell>> roomCellsByRoom
    ) {
        DungeonRoom room = roomsById.get(roomId);
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
