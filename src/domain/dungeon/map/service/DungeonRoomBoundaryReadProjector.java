package src.domain.dungeon.map.service;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomBoundaryReadProjector {

    private final DungeonRoomCellProjector roomCellProjector = new DungeonRoomCellProjector();

    Projection project(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonRoom> authoredRooms = dungeonMap.rooms().rooms();
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(authoredRooms);
        Map<Long, DungeonRoom> roomsById = roomsById(authoredRooms);
        Map<Long, DungeonRoomCluster> clustersById = clustersById(topology.roomClusters());
        ProjectionState state = new ProjectionState();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<DungeonCell>> roomCells = roomCellProjector.cellsByRoom(cluster, clusterRooms);
            state.recordRoomCells(roomCells);
            state.addRoomAggregates(cluster.clusterId(), clusterRooms, roomCells);
            state.addAuthoredBoundaries(cluster, roomCells);
            state.addPerimeterBoundaries(cluster, clusterRooms, roomCells);
        }
        return state.toProjection(roomsById, clustersById);
    }

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoomCluster> clustersById(List<DungeonRoomCluster> clusters) {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : clusters == null ? List.<DungeonRoomCluster>of() : clusters) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }

    record Projection(
            List<DungeonAggregate> aggregates,
            List<DungeonPrimitive> primitives,
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonRelationGraph.ContainmentRelation> containment,
            List<DungeonRelationGraph.ConnectionRelation> connections,
            Map<Long, List<DungeonCell>> allRoomCells,
            Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
            Map<Long, DungeonRoom> roomsById,
            Map<Long, DungeonRoomCluster> clustersById,
            long nextPrimitiveId
    ) {
        Projection {
            aggregates = List.copyOf(aggregates);
            primitives = List.copyOf(primitives);
            areas = List.copyOf(areas);
            boundaries = List.copyOf(boundaries);
            containment = List.copyOf(containment);
            connections = List.copyOf(connections);
            allRoomCells = Map.copyOf(allRoomCells);
            boundaryIdsByKey = Map.copyOf(boundaryIdsByKey);
            roomsById = Map.copyOf(roomsById);
            clustersById = Map.copyOf(clustersById);
        }
    }

    private static final class ProjectionState {
        private static final String DOOR_KIND = "door";

        private final List<DungeonAggregate> aggregates = new ArrayList<>();
        private final List<DungeonPrimitive> primitives = new ArrayList<>();
        private final List<DungeonAreaFacts> areas = new ArrayList<>();
        private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
        private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
        private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
        private final Map<Long, List<DungeonCell>> allRoomCells = new LinkedHashMap<>();
        private final Set<DungeonBoundaryKey> seenBoundaries = new LinkedHashSet<>();
        private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey = new LinkedHashMap<>();
        private long nextPrimitiveId = 1_000L;

        private void recordRoomCells(Map<Long, List<DungeonCell>> roomCells) {
            allRoomCells.putAll(roomCells);
        }

        private void addRoomAggregates(
                long clusterId,
                List<DungeonRoom> clusterRooms,
                Map<Long, List<DungeonCell>> roomCells
        ) {
            for (DungeonRoom room : clusterRooms) {
                List<DungeonCell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
                DungeonAggregate aggregate = new DungeonAggregate(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
                aggregates.add(aggregate);
                areas.add(new DungeonAreaFacts(
                        aggregate.kind(),
                        aggregate.id(),
                        clusterId,
                        aggregate.label(),
                        aggregate.cells()));
            }
        }

        private void addAuthoredBoundaries(DungeonRoomCluster cluster, Map<Long, List<DungeonCell>> roomCells) {
            for (List<DungeonClusterBoundary> levelBoundaries : cluster.boundariesByLevel().values()) {
                for (DungeonClusterBoundary boundary : levelBoundaries) {
                    addBoundary(cluster, boundary, roomCells);
                }
            }
        }

        private void addPerimeterBoundaries(
                DungeonRoomCluster cluster,
                List<DungeonRoom> clusterRooms,
                Map<Long, List<DungeonCell>> roomCells
        ) {
            for (DungeonRoom room : clusterRooms) {
                for (DungeonCell cell : roomCells.getOrDefault(room.roomId(), List.of())) {
                    for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                        DungeonCell neighbor = direction.neighborOf(cell);
                        if (containsAnyRoomCell(roomCells, neighbor)) {
                            continue;
                        }
                        addBoundary(
                                cluster,
                                new DungeonClusterBoundary(
                                        cluster.clusterId(),
                                        cell.level(),
                                        new DungeonCell(
                                                cell.q() - cluster.center().q(),
                                                cell.r() - cluster.center().r(),
                                                cell.level()),
                                        direction,
                                        DungeonClusterBoundaryKind.WALL),
                                roomCells);
                    }
                }
            }
        }

        private void addBoundary(
                DungeonRoomCluster cluster,
                DungeonClusterBoundary boundary,
                Map<Long, List<DungeonCell>> roomCells
        ) {
            DungeonEdge edge = boundary.absoluteEdge(cluster.center());
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            if (!seenBoundaries.add(key)) {
                return;
            }
            long boundaryId = key.stableId();
            nextPrimitiveId = Math.max(nextPrimitiveId, boundaryId + 1L);
            String kind = boundary.kind().primitiveKind();
            String label = boundary.kind() == DungeonClusterBoundaryKind.DOOR ? "Door" : "Wall";
            DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef(cluster.center());
            DungeonPrimitive primitive = new DungeonPrimitive(boundaryId, kind, label, edge);
            primitives.add(primitive);
            boundaries.add(new DungeonBoundaryFacts(kind, primitive.id(), primitive.label(), primitive.edge(), topologyRef));
            boundaryIdsByKey.put(key, primitive.id());

            List<Long> touchingRoomIds = touchingRoomIds(edge, roomCells);
            for (Long roomId : touchingRoomIds) {
                containment.add(new DungeonRelationGraph.ContainmentRelation(roomId, primitive.id(), kind));
            }
            if (boundary.kind() == DungeonClusterBoundaryKind.DOOR && touchingRoomIds.size() >= 2) {
                connections.add(new DungeonRelationGraph.ConnectionRelation(
                        touchingRoomIds.getFirst(),
                        touchingRoomIds.get(1),
                        DOOR_KIND));
            }
        }

        private Projection toProjection(
                Map<Long, DungeonRoom> roomsById,
                Map<Long, DungeonRoomCluster> clustersById
        ) {
            return new Projection(
                    aggregates,
                    primitives,
                    areas,
                    boundaries,
                    containment,
                    connections,
                    allRoomCells,
                    boundaryIdsByKey,
                    roomsById,
                    clustersById,
                    nextPrimitiveId);
        }

        private static boolean containsAnyRoomCell(Map<Long, List<DungeonCell>> cellsByRoom, DungeonCell cell) {
            for (List<DungeonCell> cells : cellsByRoom.values()) {
                if (cells.contains(cell)) {
                    return true;
                }
            }
            return false;
        }

        private static List<Long> touchingRoomIds(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
            List<Long> result = new ArrayList<>();
            List<DungeonCell> touchingCells = edge.touchingCells();
            for (Map.Entry<Long, List<DungeonCell>> entry : cellsByRoom.entrySet()) {
                if (containsAny(entry.getValue(), touchingCells)) {
                    result.add(entry.getKey());
                }
            }
            return List.copyOf(result);
        }

        private static boolean containsAny(List<DungeonCell> cells, List<DungeonCell> candidates) {
            for (DungeonCell candidate : candidates) {
                if (cells.contains(candidate)) {
                    return true;
                }
            }
            return false;
        }
    }
}
