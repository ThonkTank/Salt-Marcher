package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCorridor;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonRoomCluster;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorBinding;
import src.domain.dungeon.model.map.model.DungeonCorridorAnchorRef;
import src.domain.dungeon.model.map.model.DungeonCorridorDoorBinding;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonCorridorEndpointResolver {

    List<CorridorEndpoint> corridorEndpoints(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom,
            Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef
    ) {
        List<CorridorEndpoint> endpoints = new ArrayList<>();
        appendRoomEndpoints(
                endpoints,
                corridor,
                DungeonCorridorDoorBindingGeometry.bindingsByRoom(corridor.bindings().doorBindings()),
                clustersById,
                roomsById,
                roomCellsByRoom);
        appendAnchorEndpoints(endpoints, corridor, anchorsByRef);
        return List.copyOf(endpoints);
    }

    Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorBindingsByRef(List<DungeonCorridor> corridors) {
        Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> result = new LinkedHashMap<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            for (DungeonCorridorAnchorBinding binding : corridor.bindings().anchorBindings()) {
                if (binding != null && binding.topologyRef().present()) {
                    result.put(binding.topologyRef(), binding);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static void appendRoomEndpoints(
            List<CorridorEndpoint> endpoints,
            DungeonCorridor corridor,
            Map<Long, DungeonCorridorDoorBinding> bindingsByRoom,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom
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
            Map<Long, DungeonCorridorDoorBinding> bindingsByRoom,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        DungeonCorridorDoorBinding binding = bindingsByRoom.get(roomId);
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
                DungeonCorridorDoorBindingGeometry.absoluteCorridorCell(binding, cluster.center()),
                DungeonCorridorDoorBindingGeometry.absoluteDoorEdge(binding, cluster.center()),
                binding.topologyRef());
    }

    private static void appendAnchorEndpoints(
            List<CorridorEndpoint> endpoints,
            DungeonCorridor corridor,
            Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef
    ) {
        for (DungeonCorridorAnchorRef anchorRef : corridor.bindings().anchorRefs()) {
            CorridorEndpoint endpoint = anchorEndpoint(anchorRef, anchorsByRef);
            if (endpoint != null) {
                endpoints.add(endpoint);
            }
        }
    }

    private static @Nullable CorridorEndpoint anchorEndpoint(
            @Nullable DungeonCorridorAnchorRef anchorRef,
            Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef
    ) {
        if (anchorRef == null || !anchorRef.present()) {
            return null;
        }
        DungeonCorridorAnchorBinding anchorBinding = anchorsByRef.get(anchorRef.topologyRef());
        if (anchorBinding == null) {
            return null;
        }
        return new CorridorEndpoint(
                CorridorEndpointKind.ANCHOR,
                null,
                anchorBinding.hostCorridorId(),
                anchorBinding.absoluteCell(),
                null,
                anchorBinding.topologyRef());
    }

    private static @Nullable CorridorEndpoint derivedEndpoint(
            DungeonCorridor corridor,
            Long roomId,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom
    ) {
        DungeonRoom room = roomsById.get(roomId);
        if (room == null) {
            return null;
        }
        List<DungeonCell> roomCells = roomCellsByRoom.getOrDefault(roomId, List.of(room.primaryAnchor()));
        Set<DungeonCell> roomCellSet = new LinkedHashSet<>(roomCells);
        DungeonCell anchor = room.primaryAnchor();
        DungeonCell selectedRoomCell = roomCells.stream()
                .min(Comparator
                        .comparingInt((DungeonCell cell) -> manhattan(cell, anchor))
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .orElse(anchor);
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            DungeonCell corridorCell = direction.neighborOf(selectedRoomCell);
            if (!roomCellSet.contains(corridorCell)) {
                return new CorridorEndpoint(
                        CorridorEndpointKind.DOOR,
                        roomId,
                        null,
                        corridorCell,
                        DungeonEdge.sideOf(selectedRoomCell, direction),
                        DungeonTopologyRef.empty());
            }
        }
        DungeonCell fallbackCorridorCell = new DungeonCell(
                selectedRoomCell.q(),
                selectedRoomCell.r() + 1,
                corridor.level());
        return new CorridorEndpoint(
                CorridorEndpointKind.DOOR,
                roomId,
                null,
                fallbackCorridorCell,
                DungeonEdge.sideOf(selectedRoomCell, DungeonEdgeDirection.SOUTH),
                DungeonTopologyRef.empty());
    }

    private static int manhattan(DungeonCell left, DungeonCell right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    record CorridorEndpoint(
            CorridorEndpointKind kind,
            @Nullable Long roomId,
            @Nullable Long hostCorridorId,
            DungeonCell corridorCell,
            @Nullable DungeonEdge edge,
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
