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
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.SpatialTopology;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rebuilds read-side dungeon state from authored dungeon truth.
 */
public final class DungeonDerivedStateProjector {

    private static final String DOOR_KIND = "door";

    public DungeonDerivedState project(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.empty() : dungeonMap.topology();
        if (dungeonMap != null && !dungeonMap.rooms().rooms().isEmpty() && topology.hasAuthoredRooms()) {
            return authoredState(dungeonMap, topology);
        }
        return emptyState(topology);
    }

    private DungeonDerivedState authoredState(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonAggregate> aggregates = new ArrayList<>();
        List<DungeonPrimitive> primitives = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
        List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> featureRelations = new ArrayList<>();
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        Map<Long, DungeonRoom> roomsById = roomsById(dungeonMap.rooms().rooms());
        Map<Long, DungeonRoomCluster> clustersById = clustersById(topology.roomClusters());
        Map<Long, List<DungeonCell>> allRoomCells = new LinkedHashMap<>();
        Set<DungeonBoundaryKey> seenBoundaries = new LinkedHashSet<>();
        Map<DungeonBoundaryKey, Long> boundaryIdsByKey = new LinkedHashMap<>();
        DungeonCorridorReadProjector corridorReadProjector = new DungeonCorridorReadProjector();
        DungeonRoomCellProjector roomCellProjector = new DungeonRoomCellProjector();
        long primitiveId = 1_000L;

        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<DungeonCell>> roomCells = roomCellProjector.cellsByRoom(cluster, clusterRooms);
            allRoomCells.putAll(roomCells);
            for (DungeonRoom room : clusterRooms) {
                List<DungeonCell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
                DungeonAggregate aggregate = new DungeonAggregate(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
                aggregates.add(aggregate);
                areas.add(new DungeonAreaFacts(
                        aggregate.kind(),
                        aggregate.id(),
                        cluster.clusterId(),
                        aggregate.label(),
                        aggregate.cells()));
            }

            for (List<DungeonClusterBoundary> levelBoundaries : cluster.boundariesByLevel().values()) {
                for (DungeonClusterBoundary boundary : levelBoundaries) {
                    primitiveId = addBoundary(
                            cluster,
                            boundary,
                            primitiveId,
                            roomCells,
                            seenBoundaries,
                            boundaryIdsByKey,
                            primitives,
                            boundaries,
                            containment,
                            connections);
                }
            }
            for (DungeonRoom room : clusterRooms) {
                for (DungeonCell cell : roomCells.getOrDefault(room.roomId(), List.of())) {
                    for (DirectionStep step : DirectionStep.CARDINAL) {
                        DungeonCell neighbor = step.neighbor(cell);
                        if (containsAnyRoomCell(roomCells, neighbor)) {
                            continue;
                        }
                        DungeonClusterBoundary perimeter = new DungeonClusterBoundary(
                                cluster.clusterId(),
                                cell.level(),
                                new DungeonCell(cell.q() - cluster.center().q(), cell.r() - cluster.center().r(), cell.level()),
                                step.direction(),
                                src.domain.dungeon.map.value.DungeonClusterBoundaryKind.WALL);
                        primitiveId = addBoundary(
                                cluster,
                                perimeter,
                                primitiveId,
                                roomCells,
                                seenBoundaries,
                                boundaryIdsByKey,
                                primitives,
                                boundaries,
                                containment,
                                connections);
                    }
                }
            }
        }
        DungeonCorridorReadProjector.Result corridorProjection = corridorReadProjector.project(
                dungeonMap.connections().corridors(),
                clustersById,
                roomsById,
                allRoomCells,
                primitiveId,
                boundaryIdsByKey);
        aggregates.addAll(corridorProjection.aggregates());
        primitives.addAll(corridorProjection.primitives());
        areas.addAll(corridorProjection.areas());
        boundaries.addAll(corridorProjection.boundaries());
        containment.addAll(corridorProjection.containment());
        connections.addAll(corridorProjection.connections());
        DungeonFeatureReadProjector.Result featureProjection = new DungeonFeatureReadProjector().project(
                dungeonMap.connections().stairs(),
                dungeonMap.connections().transitions());
        features.addAll(featureProjection.features());
        featureRelations.addAll(featureProjection.relations());

        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                areas,
                boundaries,
                features);
        return new DungeonDerivedState(
                map,
                aggregates,
                primitives,
                new DungeonRelationGraph(containment, connections, featureRelations),
                new DungeonTraversalLinkProjector().project(dungeonMap, map));
    }

    private static long addBoundary(
            DungeonRoomCluster cluster,
            DungeonClusterBoundary boundary,
            long primitiveId,
            Map<Long, List<DungeonCell>> roomCells,
            Set<DungeonBoundaryKey> seenBoundaries,
            Map<DungeonBoundaryKey, Long> boundaryIdsByKey,
            List<DungeonPrimitive> primitives,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonRelationGraph.ContainmentRelation> containment,
            List<DungeonRelationGraph.ConnectionRelation> connections
    ) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center()));
        if (!seenBoundaries.add(key)) {
            return primitiveId;
        }
        long boundaryId = key.stableId();
        long nextPrimitiveId = Math.max(primitiveId, boundaryId + 1L);
        String kind = boundary.kind().primitiveKind();
        String label = boundary.kind() == src.domain.dungeon.map.value.DungeonClusterBoundaryKind.DOOR ? "Door" : "Wall";
        DungeonEdge edge = boundary.absoluteEdge(cluster.center());
        DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef(cluster.center());
        DungeonPrimitive primitive = new DungeonPrimitive(boundaryId, kind, label, edge);
        primitives.add(primitive);
        boundaries.add(new DungeonBoundaryFacts(kind, primitive.id(), primitive.label(), primitive.edge(), topologyRef));
        boundaryIdsByKey.put(key, primitive.id());

        List<Long> touchingRoomIds = touchingRoomIds(edge, roomCells);
        for (Long roomId : touchingRoomIds) {
            containment.add(new DungeonRelationGraph.ContainmentRelation(roomId, primitive.id(), kind));
        }
        if (boundary.kind() == src.domain.dungeon.map.value.DungeonClusterBoundaryKind.DOOR && touchingRoomIds.size() >= 2) {
            connections.add(new DungeonRelationGraph.ConnectionRelation(
                    touchingRoomIds.getFirst(),
                    touchingRoomIds.get(1),
                    DOOR_KIND));
        }
        return nextPrimitiveId;
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
        List<DungeonCell> touchingCells = edge == null ? List.of() : edge.touchingCells();
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

    private DungeonDerivedState emptyState(SpatialTopology topology) {
        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                List.of(),
                List.of(),
                List.of());
        return new DungeonDerivedState(
                map,
                List.of(),
                List.of(),
                new DungeonRelationGraph(List.of(), List.of()),
                List.of());
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
