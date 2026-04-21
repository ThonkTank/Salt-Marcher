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
import java.util.Set;

public final class DungeonCorridorReadProjector {

    private static final String DOOR_KIND = "door";

    public Result project(
            List<DungeonCorridor> corridors,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom,
            long primitiveId
    ) {
        ResultBuilder result = new ResultBuilder(primitiveId);
        Set<DungeonCell> allRoomCells = allRoomCells(roomCellsByRoom);
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor == null || !corridor.isReadable()) {
                continue;
            }
            List<CorridorEndpoint> endpoints = corridorEndpoints(corridor, clustersById, roomsById, roomCellsByRoom);
            result.addCorridor(corridor, endpoints, corridorCells(corridor, clustersById, endpoints, allRoomCells));
        }
        return result.toResult();
    }

    private static List<CorridorEndpoint> corridorEndpoints(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, List<DungeonCell>> roomCellsByRoom
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
                            roomId,
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
        DungeonCell roomCell = absoluteRoomCell(binding, clusterCenter);
        return new DungeonEdge(roomCell, binding.direction().neighborOf(roomCell));
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
                        roomId,
                        corridorCell,
                        new DungeonEdge(selectedRoomCell, corridorCell),
                        DungeonTopologyRef.empty());
            }
        }
        DungeonCell fallbackCorridorCell = new DungeonCell(selectedRoomCell.q(), selectedRoomCell.r() + 1, corridor.level());
        return new CorridorEndpoint(
                roomId,
                fallbackCorridorCell,
                new DungeonEdge(selectedRoomCell, fallbackCorridorCell),
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
        private final Set<DungeonBoundaryKey> seenBoundaries = new LinkedHashSet<>();
        private long primitiveId;

        private ResultBuilder(long primitiveId) {
            this.primitiveId = primitiveId;
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
                addEndpoint(corridor, endpoint);
            }
        }

        private void addEndpoint(DungeonCorridor corridor, CorridorEndpoint endpoint) {
            DungeonBoundaryKey key = DungeonBoundaryKey.from(endpoint.edge());
            if (seenBoundaries.add(key)) {
                DungeonTopologyRef topologyRef = endpoint.topologyRef();
                long doorId = topologyRef.present() ? topologyRef.id() : key.stableId();
                DungeonPrimitive door = new DungeonPrimitive(doorId, DOOR_KIND, "Corridor Door", endpoint.edge());
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
                containment.add(new DungeonRelationGraph.ContainmentRelation(corridor.corridorId(), door.id(), DOOR_KIND));
                containment.add(new DungeonRelationGraph.ContainmentRelation(endpoint.roomId(), door.id(), DOOR_KIND));
            }
            connections.add(new DungeonRelationGraph.ConnectionRelation(corridor.corridorId(), endpoint.roomId(), DOOR_KIND));
        }

        private Result toResult() {
            return new Result(primitiveId, aggregates, primitives, areas, boundaries, containment, connections);
        }
    }

    private record CorridorEndpoint(
            Long roomId,
            DungeonCell corridorCell,
            DungeonEdge edge,
            DungeonTopologyRef topologyRef
    ) {
        private CorridorEndpoint {
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    private record DirectionStep(DungeonEdgeDirection direction) {

        private static final List<DirectionStep> CARDINAL = List.of(
                new DirectionStep(DungeonEdgeDirection.NORTH),
                new DirectionStep(DungeonEdgeDirection.EAST),
                new DirectionStep(DungeonEdgeDirection.SOUTH),
                new DirectionStep(DungeonEdgeDirection.WEST));

        DungeonCell neighbor(DungeonCell cell) {
            return direction.neighborOf(cell);
        }
    }
}
