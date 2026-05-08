package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonCorridorAnchorBinding;
import src.domain.dungeon.map.value.DungeonCorridorAnchorRef;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonCorridorWaypoint;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorReadProjector {

    private static final String DOOR_KIND = "door";

    public Result project(
            List<DungeonCorridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom,
            long primitiveId,
            Map<DungeonBoundaryKey, Long> existingDoorIdsByKey
    ) {
        ResultBuilder result = new ResultBuilder(primitiveId, existingDoorIdsByKey);
        Set<DungeonCell> allRoomCells = allRoomCells(roomCellsByRoom);
        Map<src.domain.dungeon.map.value.DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorsByRef =
                anchorBindingsByRef(corridors);
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor == null || !corridor.isReadable()) {
                continue;
            }
            List<CorridorEndpoint> endpoints = corridorEndpoints(
                    corridor,
                    clustersById,
                    roomsById,
                    roomCellsByRoom,
                    anchorsByRef);
            result.addCorridor(corridor, endpoints, corridorCells(corridor, clustersById, endpoints, allRoomCells));
        }
        return result.toResult();
    }

    private static List<CorridorEndpoint> corridorEndpoints(
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
        for (DirectionStep step : DirectionStep.CARDINAL) {
            DungeonCell corridorCell = step.neighbor(selectedRoomCell);
            if (!roomCellSet.contains(corridorCell)) {
                return new CorridorEndpoint(
                        CorridorEndpointKind.DOOR,
                        roomId,
                        null,
                        corridorCell,
                        DungeonEdge.sideOf(selectedRoomCell, step.direction()),
                        DungeonTopologyRef.empty());
            }
        }
        DungeonCell fallbackCorridorCell = new DungeonCell(selectedRoomCell.q(), selectedRoomCell.r() + 1, corridor.level());
        return new CorridorEndpoint(
                CorridorEndpointKind.DOOR,
                roomId,
                null,
                fallbackCorridorCell,
                DungeonEdge.sideOf(selectedRoomCell, DungeonEdgeDirection.SOUTH),
                DungeonTopologyRef.empty());
    }

    private static List<DungeonCell> corridorCells(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            List<CorridorEndpoint> endpoints,
            Set<DungeonCell> roomCells
    ) {
        List<DungeonCell> backbone = corridor.bindings().waypoints().isEmpty()
                ? endpoints.stream().map(CorridorEndpoint::corridorCell).toList()
                : corridorWaypoints(corridor.bindings().waypoints(), clustersById);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        addRouteCells(cells, backbone, roomCells);
        if (!backbone.isEmpty()) {
            for (CorridorEndpoint endpoint : endpoints) {
                addRouteCells(cells, List.of(endpoint.corridorCell(), nearestCell(endpoint.corridorCell(), backbone)), roomCells);
            }
        }
        if (cells.isEmpty()) {
            for (CorridorEndpoint endpoint : endpoints) {
                if (!roomCells.contains(endpoint.corridorCell())) {
                    cells.add(endpoint.corridorCell());
                }
            }
        }
        return cells.stream()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .toList();
    }

    private static List<DungeonCell> corridorWaypoints(
            List<DungeonCorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCorridorWaypoint waypoint : waypoints) {
            DungeonRoomCluster cluster = clustersById.get(waypoint.clusterId());
            DungeonCell center = cluster == null
                    ? new DungeonCell(0, 0, waypoint.level())
                    : cluster.center();
            result.add(waypoint.absoluteCell(center));
        }
        return List.copyOf(result);
    }

    private static void addRouteCells(Set<DungeonCell> cells, List<DungeonCell> routeNodes, Set<DungeonCell> roomCells) {
        if (routeNodes == null || routeNodes.isEmpty()) {
            return;
        }
        if (routeNodes.size() == 1 && !roomCells.contains(routeNodes.getFirst())) {
            cells.add(routeNodes.getFirst());
            return;
        }
        for (int index = 1; index < routeNodes.size(); index++) {
            for (DungeonCell cell : manhattanPath(routeNodes.get(index - 1), routeNodes.get(index))) {
                if (!roomCells.contains(cell)) {
                    cells.add(cell);
                }
            }
        }
    }

    private static List<DungeonCell> manhattanPath(DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return List.of();
        }
        List<DungeonCell> result = new ArrayList<>();
        int q = start.q();
        int r = start.r();
        int level = start.level();
        result.add(new DungeonCell(q, r, level));
        while (q != end.q()) {
            q += Integer.compare(end.q(), q);
            result.add(new DungeonCell(q, r, level));
        }
        while (r != end.r()) {
            r += Integer.compare(end.r(), r);
            result.add(new DungeonCell(q, r, level));
        }
        if (level != end.level()) {
            result.add(new DungeonCell(end.q(), end.r(), end.level()));
        }
        return List.copyOf(result);
    }

    private static DungeonCell nearestCell(DungeonCell origin, List<DungeonCell> candidates) {
        return candidates.stream()
                .min(Comparator
                        .comparingInt((DungeonCell candidate) -> manhattan(origin, candidate))
                        .thenComparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .orElse(origin);
    }

    private static int manhattan(DungeonCell left, DungeonCell right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private static Set<DungeonCell> allRoomCells(Map<Long, List<DungeonCell>> roomCellsByRoom) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (List<DungeonCell> roomCells : roomCellsByRoom.values()) {
            result.addAll(roomCells);
        }
        return Set.copyOf(result);
    }

    public record Result(
            long nextPrimitiveId,
            List<DungeonAggregate> aggregates,
            List<DungeonPrimitive> primitives,
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonRelationGraph.ContainmentRelation> containment,
            List<DungeonRelationGraph.ConnectionRelation> connections
    ) {
        public Result {
            aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
            primitives = primitives == null ? List.of() : List.copyOf(primitives);
            areas = areas == null ? List.of() : List.copyOf(areas);
            boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
            containment = containment == null ? List.of() : List.copyOf(containment);
            connections = connections == null ? List.of() : List.copyOf(connections);
        }
    }

    private static final class ResultBuilder {

        private final List<DungeonAggregate> aggregates = new ArrayList<>();
        private final List<DungeonPrimitive> primitives = new ArrayList<>();
        private final List<DungeonAreaFacts> areas = new ArrayList<>();
        private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
        private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
        private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
        private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey;
        private final Set<String> seenContainment = new LinkedHashSet<>();
        private final Set<String> seenConnections = new LinkedHashSet<>();
        private long primitiveId;

        private ResultBuilder(long primitiveId, Map<DungeonBoundaryKey, Long> existingDoorIdsByKey) {
            this.primitiveId = primitiveId;
            this.boundaryIdsByKey = new LinkedHashMap<>(
                    existingDoorIdsByKey == null ? Map.of() : existingDoorIdsByKey);
        }

        private void addCorridor(DungeonCorridor corridor, List<CorridorEndpoint> endpoints, List<DungeonCell> cells) {
            DungeonAggregate aggregate = new DungeonAggregate(
                    corridor.corridorId(),
                    DungeonAreaType.CORRIDOR,
                    "Corridor " + corridor.corridorId(),
                    cells);
            aggregates.add(aggregate);
                areas.add(new DungeonAreaFacts(aggregate.kind(), aggregate.id(), aggregate.label(), aggregate.cells()));
            for (CorridorEndpoint endpoint : endpoints) {
                if (endpoint.kind() == CorridorEndpointKind.DOOR) {
                    addDoorEndpoint(corridor, endpoint);
                }
            }
        }

        private void addDoorEndpoint(DungeonCorridor corridor, CorridorEndpoint endpoint) {
            DungeonEdge edge = Objects.requireNonNull(endpoint.edge());
            Long roomId = Objects.requireNonNull(endpoint.roomId());
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            boolean preexisting = boundaryIdsByKey.containsKey(key);
            long doorId = boundaryIdsByKey.getOrDefault(
                    key,
                    endpoint.topologyRef().present() ? endpoint.topologyRef().id() : key.stableId());
            if (!preexisting) {
                DungeonTopologyRef topologyRef = endpoint.topologyRef();
                DungeonPrimitive door = new DungeonPrimitive(doorId, DOOR_KIND, "Corridor Door", edge);
                primitiveId = Math.max(primitiveId, doorId + 1L);
                primitives.add(door);
                boundaries.add(new DungeonBoundaryFacts(
                        door.kind(),
                        door.id(),
                        door.label(),
                        door.edge(),
                        topologyRef.present()
                                ? topologyRef
                                : new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, door.id())));
                boundaryIdsByKey.put(key, doorId);
                addContainment(corridor.corridorId(), door.id(), DOOR_KIND);
                addContainment(roomId, door.id(), DOOR_KIND);
            } else {
                addContainment(corridor.corridorId(), doorId, DOOR_KIND);
            }
            addConnection(corridor.corridorId(), roomId, DOOR_KIND);
        }

        private void addContainment(long containerId, long containedId, String kind) {
            String key = containerId + ":" + containedId + ":" + kind;
            if (seenContainment.add(key)) {
                containment.add(new DungeonRelationGraph.ContainmentRelation(containerId, containedId, kind));
            }
        }

        private void addConnection(long fromId, long toId, String kind) {
            String key = fromId + ":" + toId + ":" + kind;
            if (seenConnections.add(key)) {
                connections.add(new DungeonRelationGraph.ConnectionRelation(fromId, toId, kind));
            }
        }

        private Result toResult() {
            return new Result(primitiveId, aggregates, primitives, areas, boundaries, containment, connections);
        }
    }

    private record CorridorEndpoint(
            CorridorEndpointKind kind,
            @Nullable Long roomId,
            @Nullable Long hostCorridorId,
            DungeonCell corridorCell,
            @Nullable DungeonEdge edge,
            DungeonTopologyRef topologyRef
    ) {
        private CorridorEndpoint {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    private enum CorridorEndpointKind {
        DOOR,
        ANCHOR
    }

    private static Map<DungeonTopologyRef, DungeonCorridorAnchorBinding> anchorBindingsByRef(List<DungeonCorridor> corridors) {
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

    private static final class DirectionStep {
        private final DungeonEdgeDirection direction;

        private static final List<DirectionStep> CARDINAL = List.of(
                new DirectionStep(DungeonEdgeDirection.NORTH),
                new DirectionStep(DungeonEdgeDirection.EAST),
                new DirectionStep(DungeonEdgeDirection.SOUTH),
                new DirectionStep(DungeonEdgeDirection.WEST));

        private DirectionStep(DungeonEdgeDirection direction) {
            this.direction = direction;
        }

        private DungeonEdgeDirection direction() {
            return direction;
        }

        DungeonCell neighbor(DungeonCell cell) {
            return direction.neighborOf(cell);
        }
    }
}
