package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonTopologyRef;

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
        Map<Long, DungeonCorridorDoorBinding> bindingsByRoom = new LinkedHashMap<>();
        for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
            bindingsByRoom.putIfAbsent(binding.roomId(), binding);
        }
        List<CorridorEndpoint> endpoints = new ArrayList<>();
        for (Long roomId : corridor.roomIds()) {
            DungeonCorridorDoorBinding binding = bindingsByRoom.get(roomId);
            if (binding != null) {
                DungeonRoomCluster cluster = clustersById.get(binding.clusterId());
                if (cluster != null) {
                    endpoints.add(new CorridorEndpoint(
                            CorridorEndpointKind.DOOR,
                            roomId,
                            null,
                            absoluteCorridorCell(binding, cluster.center()),
                            absoluteDoorEdge(binding, cluster.center()),
                            binding.topologyRef()));
                    continue;
                }
            }
            CorridorEndpoint derived = derivedEndpoint(corridor, roomId, roomsById, roomCellsByRoom);
            if (derived != null) {
                endpoints.add(derived);
            }
        }
        for (DungeonCorridorAnchorRef anchorRef : corridor.bindings().anchorRefs()) {
            if (anchorRef == null || !anchorRef.present()) {
                continue;
            }
            DungeonCorridorAnchorBinding anchorBinding = anchorsByRef.get(anchorRef.topologyRef());
            if (anchorBinding == null) {
                continue;
            }
            endpoints.add(new CorridorEndpoint(
                    CorridorEndpointKind.ANCHOR,
                    null,
                    anchorBinding.hostCorridorId(),
                    anchorBinding.absoluteCell(),
                    null,
                    anchorBinding.topologyRef()));
        }
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

    private static DungeonCell absoluteRoomCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        DungeonCell relativeCell = binding.relativeCell();
        DungeonCell center = clusterCenter == null ? new DungeonCell(0, 0, relativeCell.level()) : clusterCenter;
        return new DungeonCell(
                center.q() + relativeCell.q(),
                center.r() + relativeCell.r(),
                center.level());
    }

    private static DungeonCell absoluteCorridorCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return binding.direction().neighborOf(absoluteRoomCell(binding, clusterCenter));
    }

    private static DungeonEdge absoluteDoorEdge(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
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
    }

    enum CorridorEndpointKind {
        DOOR,
        ANCHOR
    }
}
