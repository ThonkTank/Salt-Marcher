package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.ClusterRewriteSplit;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonLayout {

    public sealed interface CellStructure permits CellStructure.RoomStructure, CellStructure.NetworkStructure, CellStructure.CorridorStructure, CellStructure.StairStructure, CellStructure.TransitionStructure {
        record RoomStructure(Room room) implements CellStructure {
        }

        record NetworkStructure(CorridorNetwork network) implements CellStructure {
        }

        record CorridorStructure(Corridor corridor) implements CellStructure {
        }

        record StairStructure(DungeonStair stair) implements CellStructure {
        }

        record TransitionStructure(DungeonTransition transition) implements CellStructure {
        }
    }

    private static final DungeonLayout EMPTY = new DungeonLayout(0L, "Kein Dungeon", List.of(), List.of(), List.of(), List.of(), Map.of(), Map.of());

    private final long mapId;
    private final String name;
    private final List<Corridor> corridors;
    private final List<RoomCluster> clusters;
    private final List<DungeonStair> stairs;
    private final List<DungeonTransition> transitions;
    // Layout is only the global aggregation/query surface over self-managed structures.
    private final List<Connection> connections;
    private final Map<VertexEdge, Connection> connectionsByEdge;
    private final Map<ConnectionEndpoint, List<Connection>> connectionsByEndpoint;
    private final Map<Door, List<ConnectionEndpoint>> endpointsByDoor;
    private final List<CorridorNetwork> corridorNetworks;
    private final Map<Long, Room> roomsById;
    private final Map<Long, Corridor> corridorsById;
    private final Map<Long, RoomCluster> clustersById;
    private final Map<Long, DungeonStair> stairsById;
    private final Map<Long, DungeonTransition> transitionsById;
    private final Map<Long, Integer> clusterLevelsById;
    private final Map<Long, Integer> roomLevelsById;
    private final Map<String, CorridorNetwork> corridorNetworksById;
    private final Map<Long, String> corridorNetworkIdByCorridorId;
    private final Map<Point2i, List<Long>> corridorIdsByCell;
    private final Map<CubePoint, List<Long>> corridorIdsByPoint;
    private final Map<Point2i, String> corridorNetworkIdByCell;
    private final Map<CubePoint, List<Long>> stairIdsByPoint;
    private final Map<CubePoint, List<Long>> transitionIdsByPoint;
    private final Set<Point2i> traversableCells;
    private final Set<CubePoint> traversableCubeCells;
    private final List<Integer> reachableLevels;

    public DungeonLayout(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<RoomCluster> clusters
    ) {
        this(mapId, name, corridors, clusters, List.of(), List.of(), Map.of(), Map.of());
    }

    public DungeonLayout(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<RoomCluster> clusters,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions,
            Map<Long, Integer> clusterLevelsById,
            Map<Long, Integer> roomLevelsById
    ) {
        this.mapId = mapId;
        this.name = name == null || name.isBlank() ? "Dungeon " + mapId : name;
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.clusters = clusters == null ? List.of() : List.copyOf(clusters);
        this.stairs = stairs == null ? List.of() : List.copyOf(stairs);
        this.transitions = transitions == null ? List.of() : List.copyOf(transitions);
        this.connections = indexConnections(this.clusters, this.corridors);
        this.connectionsByEdge = indexConnectionsByEdge(this.connections);
        this.connectionsByEndpoint = indexConnectionsByEndpoint(this.connections);
        this.endpointsByDoor = indexEndpointsByDoor(this.connections);
        this.corridorNetworks = CorridorNetwork.buildNetworks(mapId, this.corridors, doors(), this.endpointsByDoor);
        this.roomsById = indexRooms(this.clusters);
        this.corridorsById = indexCorridors(this.corridors);
        this.clustersById = indexClusters(this.clusters);
        this.stairsById = indexStairs(this.stairs);
        this.transitionsById = indexTransitions(this.transitions);
        this.clusterLevelsById = indexLevels(clusterLevelsById);
        this.roomLevelsById = indexRoomLevels(this.roomsById, roomLevelsById, this.clusterLevelsById);
        this.corridorNetworksById = indexCorridorNetworks(this.corridorNetworks);
        this.corridorNetworkIdByCorridorId = indexCorridorNetworkIdsByCorridorId(this.corridorNetworks);
        this.corridorIdsByCell = indexCorridorIdsByCell(this.corridors);
        this.corridorIdsByPoint = indexCorridorIdsByPoint(this.corridors);
        this.corridorNetworkIdByCell = indexCorridorNetworkIdsByCell(this.corridorNetworks);
        this.stairIdsByPoint = indexStairIdsByPoint(this.stairs);
        this.transitionIdsByPoint = indexTransitionIdsByPoint(this.transitions);
        this.traversableCells = indexTraversableCells(this.clusters, this.corridors);
        this.traversableCubeCells = indexTraversableCubeCells(this.clusters, this.corridors, this.stairs, this.roomLevelsById);
        this.reachableLevels = indexReachableLevels(this.traversableCubeCells);
    }

    public static DungeonLayout empty() {
        return EMPTY;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public List<Room> rooms() {
        return clusters.stream()
                .flatMap(cluster -> cluster.rooms().stream())
                .toList();
    }

    public List<Corridor> corridors() {
        return corridors;
    }

    public List<DungeonStair> stairs() {
        return stairs;
    }

    public List<DungeonTransition> transitions() {
        return transitions;
    }

    public List<Integer> reachableLevels() {
        return reachableLevels;
    }

    public int defaultLevel() {
        return reachableLevels.isEmpty() ? 0 : reachableLevels.getFirst();
    }

    public Map<Long, Corridor> corridorsById() {
        return corridorsById;
    }

    public List<RoomCluster> clusters() {
        return clusters;
    }

    public Map<Long, Long> roomClusterIds() {
        Map<Long, Long> result = new LinkedHashMap<>();
        for (Room room : roomsById.values()) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room.clusterId());
            }
        }
        return Map.copyOf(result);
    }

    public Map<Long, Point2i> clusterCentersById() {
        Map<Long, Point2i> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster.center());
            }
        }
        return Map.copyOf(result);
    }

    public int levelForCluster(Long clusterId) {
        return clusterId == null ? 0 : clusterLevelsById.getOrDefault(clusterId, 0);
    }

    public int levelForRoom(Long roomId) {
        return roomId == null ? 0 : roomLevelsById.getOrDefault(roomId, 0);
    }

    public int levelForCorridor(Long corridorId) {
        return canonicalLevelForCorridor(corridorsById.get(corridorId));
    }

    private boolean corridorReachesLevel(Corridor corridor, int levelZ) {
        if (corridor.path() == null) {
            return false;
        }
        return corridor.path().floorsByLevel().containsKey(levelZ)
                || corridorConnectionReachesLevel(corridor, levelZ, roomLevelsById);
    }

    public List<RoomCluster> overlappingClusters(features.world.dungeonmap.model.geometry.TileShape shape) {
        if (shape == null || shape.size() == 0) {
            return List.of();
        }
        return clusters.stream()
                .filter(cluster -> cluster != null && cluster.overlaps(shape))
                .toList();
    }

    public List<CorridorNetwork> corridorNetworks() {
        return corridorNetworks;
    }

    public List<Door> doors() {
        return connections.stream()
                .map(Connection::door)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Connection> connections() {
        return connections;
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Corridor findCorridor(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public Door doorAt(VertexEdge edge) {
        Connection connection = connectionAt(edge);
        return connection == null ? null : connection.door();
    }

    public Connection connectionAt(VertexEdge edge) {
        return edge == null ? null : connectionsByEdge.get(edge);
    }

    public List<Door> doorsForRoom(long roomId) {
        return connectionsForRoom(roomId).stream()
                .map(Connection::door)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Door> doorsForCorridor(long corridorId) {
        return connectionsForCorridor(corridorId).stream()
                .map(Connection::door)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Door> doorsForNetwork(String networkId) {
        CorridorNetwork network = findCorridorNetwork(networkId);
        if (network == null) {
            return List.of();
        }
        Set<Door> result = new LinkedHashSet<>();
        for (Long corridorId : network.corridorIds()) {
            result.addAll(doorsForCorridor(corridorId));
        }
        return List.copyOf(result);
    }

    public List<Connection> connectionsForRoom(long roomId) {
        return connectionsFor(ConnectionEndpoint.room(roomId));
    }

    public List<Connection> connectionsForCluster(long clusterId) {
        RoomCluster cluster = findCluster(clusterId);
        if (cluster == null) {
            return List.of();
        }
        Set<Connection> result = new LinkedHashSet<>(connectionsFor(ConnectionEndpoint.cluster(clusterId)));
        for (Room room : cluster.rooms()) {
            if (room != null && room.roomId() != null) {
                result.addAll(connectionsForRoom(room.roomId()));
            }
        }
        return List.copyOf(result);
    }

    public List<Connection> connectionsForCorridor(long corridorId) {
        return connectionsFor(ConnectionEndpoint.corridor(corridorId));
    }

    public List<Door> doorsAtEdges(Set<VertexEdge> edges) {
        if (edges == null || edges.isEmpty()) {
            return List.of();
        }
        return edges.stream()
                .map(this::doorAt)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    public List<ConnectionEndpoint> endpointsForDoor(Door door) {
        if (door == null) {
            return List.of();
        }
        return endpointsByDoor.getOrDefault(door, List.of());
    }

    public ConnectionEndpoint oppositeEndpoint(Door door, ConnectionEndpoint endpoint) {
        if (door == null || endpoint == null) {
            return null;
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(door);
        if (endpoints.size() != 2 || !endpoints.contains(endpoint)) {
            return null;
        }
        return endpoints.get(0).equals(endpoint) ? endpoints.get(1) : endpoints.get(0);
    }

    private List<Connection> connectionsFor(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return List.of();
        }
        return connectionsByEndpoint.getOrDefault(endpoint, List.of());
    }

    public DungeonStair findStair(Long stairId) {
        return stairId == null ? null : stairsById.get(stairId);
    }

    public DungeonTransition findTransition(Long transitionId) {
        return transitionId == null ? null : transitionsById.get(transitionId);
    }

    public CorridorNetwork findCorridorNetwork(String networkId) {
        if (networkId == null) {
            return null;
        }
        return corridorNetworks().stream()
                .filter(network -> network.networkId().equals(networkId))
                .findFirst()
                .orElse(null);
    }

    public List<Corridor> corridorsForRoom(Long roomId) {
        if (roomId == null) {
            return List.of();
        }
        return corridors.stream()
                .filter(corridor -> corridor != null && corridor.connectsRoom(roomId))
                .toList();
    }

    public Corridor findCorridorContainingAllRooms(Set<Long> roomIds) {
        if (roomIds == null || roomIds.size() < 2) {
            return null;
        }
        return corridors.stream()
                .filter(corridor -> corridor != null && corridor.corridorId() != null)
                .filter(corridor -> corridor.roomIds().containsAll(roomIds))
                .findFirst()
                .orElse(null);
    }

    public RoomCluster findCluster(Long clusterId) {
        return clusterId == null ? null : clustersById.get(clusterId);
    }

    public CorridorNetwork corridorNetworkForCorridor(Long corridorId) {
        String networkId = corridorId == null ? null : corridorNetworkIdByCorridorId.get(corridorId);
        return networkId == null ? null : corridorNetworksById.get(networkId);
    }

    public RoomCluster clusterForRoom(Long roomId) {
        Room room = findRoom(roomId);
        return room == null ? null : findCluster(room.clusterId());
    }

    public Room roomAtCell(Point2i cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster.roomAt(cell);
            }
        }
        return null;
    }

    public RoomCluster clusterAtCell(Point2i cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    public List<Corridor> corridorsAtCell(Point2i cell) {
        List<Long> corridorIds = cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(corridor -> corridor != null)
                .toList();
    }

    public List<Corridor> corridorsAtCell(Point2i cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return corridorsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<Corridor> corridorsAtPoint(CubePoint point) {
        List<Long> corridorIds = point == null ? List.of() : corridorIdsByPoint.getOrDefault(point, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(corridor -> corridor != null)
                .toList();
    }

    public CorridorNetwork corridorNetworkAtCell(Point2i cell) {
        String networkId = cell == null ? null : corridorNetworkIdByCell.get(cell);
        return networkId == null ? null : corridorNetworksById.get(networkId);
    }

    public List<DungeonStair> stairsAtCell(Point2i cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return stairsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<DungeonStair> stairsAtPoint(CubePoint point) {
        List<Long> stairIds = point == null ? List.of() : stairIdsByPoint.getOrDefault(point, List.of());
        return stairIds.stream()
                .map(this::findStair)
                .filter(stair -> stair != null)
                .toList();
    }

    public List<DungeonTransition> transitionsAtCell(Point2i cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return transitionsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<DungeonTransition> transitionsAtPoint(CubePoint point) {
        List<Long> transitionIds = point == null ? List.of() : transitionIdsByPoint.getOrDefault(point, List.of());
        return transitionIds.stream()
                .map(this::findTransition)
                .filter(transition -> transition != null)
                .toList();
    }

    public CellStructure structureAtCell(Point2i cell) {
        if (cell == null) {
            return null;
        }
        Room room = roomAtCell(cell);
        if (room != null) {
            return new CellStructure.RoomStructure(room);
        }
        CorridorNetwork network = corridorNetworkAtCell(cell);
        if (network != null) {
            return new CellStructure.NetworkStructure(network);
        }
        Corridor corridor = corridorsAtCell(cell).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .min(Comparator.comparing(Corridor::corridorId))
                .orElse(null);
        if (corridor != null) {
            return new CellStructure.CorridorStructure(corridor);
        }
        DungeonStair stair = stairsAtCell(cell, defaultLevel()).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
        if (stair != null) {
            return new CellStructure.StairStructure(stair);
        }
        DungeonTransition transition = transitionsAtCell(cell, defaultLevel()).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .min(Comparator.comparing(DungeonTransition::transitionId))
                .orElse(null);
        return transition == null ? null : new CellStructure.TransitionStructure(transition);
    }

    public Set<Point2i> traversableCells() {
        return traversableCells;
    }



    public boolean isTraversableCell(Point2i cell) {
        return cell != null && traversableCells.contains(cell);
    }

    public boolean isTraversableCell(CubePoint point) {
        return point != null && traversableCubeCells.contains(point);
    }

    public Point2i nearestTraversableCell(Point2i cell) {
        if (cell == null || traversableCells.isEmpty()) {
            return null;
        }
        return traversableCells.stream()
                .min(Comparator
                        .comparingInt((Point2i candidate) -> candidate.distanceTo(cell))
                .thenComparing(Point2i.POINT_ORDER))
                .orElse(null);
    }

    public CubePoint nearestTraversableCell(CubePoint point) {
        if (point == null || traversableCubeCells.isEmpty()) {
            return null;
        }
        return traversableCubeCells.stream()
                .min(Comparator
                        .comparingInt((CubePoint candidate) -> candidate.manhattanDistanceTo(point))
                        .thenComparing(CubePoint.POINT_ORDER))
                .orElse(null);
    }

    public boolean hasDependentCorridors(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return false;
        }
        return !corridorIdsAffectedBy(cluster.roomIds(), Set.of(cluster.clusterId())).isEmpty();
    }

    public Set<Long> corridorIdsAffectedBy(ClusterRewrite rewrite) {
        if (rewrite == null) {
            return Set.of();
        }
        return corridorIdsAffectedBy(rewrite.affectedRoomIds(), rewrite.affectedClusterIds());
    }

    public List<Corridor> corridorsAffectedBy(ClusterRewrite rewrite) {
        if (rewrite == null) {
            return List.of();
        }
        return corridorsAffectedBy(rewrite.affectedRoomIds(), rewrite.affectedClusterIds());
    }

    public Set<Long> corridorIdsAffectedBy(Set<Long> roomIds, Set<Long> clusterIds) {
        return corridorsAffectedBy(roomIds, clusterIds).stream()
                .map(Corridor::corridorId)
                .collect(Collectors.toUnmodifiableSet());
    }

    public List<Corridor> corridorsAffectedBy(Set<Long> roomIds, Set<Long> clusterIds) {
        if ((roomIds == null || roomIds.isEmpty()) && (clusterIds == null || clusterIds.isEmpty())) {
            return List.of();
        }
        Set<Long> affectedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds);
        Set<Long> affectedClusterIds = clusterIds == null ? Set.of() : Set.copyOf(clusterIds);
        return corridors.stream()
                .filter(corridor -> corridor != null && corridor.corridorId() != null)
                .filter(corridor -> corridor.dependsOnAnyRoom(affectedRoomIds)
                        || corridor.isAffectedByClusterRewrite(affectedClusterIds))
                .toList();
    }

    /**
     * Convenience facade for the canonical corridor-planning projection of this layout.
     *
     * <p>The projection logic lives exclusively on {@link CorridorPlanningInputProjector}; keeping this method on
     * the layout preserves readable call sites without reintroducing a second implementation.</p>
     */
    public CorridorPlanningInput corridorPlanningInput() {
        return CorridorPlanningInputProjector.project(this);
    }

    public DungeonLayout withReplacedCluster(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return this;
        }
        List<RoomCluster> updatedClusters = clusters.stream()
                .map(existing -> cluster.clusterId().equals(existing.clusterId()) ? cluster : existing)
                .toList();
        return new DungeonLayout(mapId, name, corridors, updatedClusters, stairs, transitions, clusterLevelsById, roomLevelsById);
    }

    public DungeonLayout withTranslatedCluster(Long clusterId, Point2i delta) {
        if (clusterId == null || delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        RoomCluster cluster = findCluster(clusterId);
        if (cluster == null) {
            return this;
        }
        RoomCluster movedCluster = cluster.movedBy(delta);
        List<RoomCluster> updatedClusters = clusters.stream()
                .map(existing -> clusterId.equals(existing.clusterId()) ? movedCluster : existing)
                .toList();
        // All callers must see the same replanned topology. Performance work here must preserve that invariant.
        CorridorPlanningInput planningInput = CorridorPlanningInputProjector.project(updatedClusters, roomLevelsById, clusterLevelsById);
        CorridorRewriteContext rewriteContext = new CorridorRewriteContext(
                corridorPlanningInput(),
                planningInput,
                corridorIdsAffectedBy(movedCluster.roomIds(), Set.of(clusterId)),
                Set.of());
        List<Corridor> updatedCorridors = corridors.stream()
                .map(corridor -> corridor == null ? null : corridor.reanchoredFor(rewriteContext).replannedFor(rewriteContext))
                .toList();
        return new DungeonLayout(mapId, name, updatedCorridors, updatedClusters, stairs, transitions, clusterLevelsById, roomLevelsById);
    }

    public DungeonLayout applying(ClusterRewrite rewrite) {
        if (rewrite == null || rewrite.targetClusterId() == null) {
            return this;
        }
        List<RoomCluster> updatedClusters = new ArrayList<>();
        boolean replacedTarget = false;
        for (RoomCluster cluster : clusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            if (rewrite.deletedClusterIds().contains(cluster.clusterId())) {
                continue;
            }
            if (rewrite.targetClusterId().equals(cluster.clusterId())) {
                if (!rewrite.deletesCluster()) {
                    updatedClusters.add(new RoomCluster(
                            rewrite.targetClusterId(),
                            mapId,
                            rewrite.clusterCenter(),
                            rewrite.rooms(),
                            rewrite.localConnections()));
                    replacedTarget = true;
                }
                continue;
            }
            updatedClusters.add(cluster);
        }
        if (!rewrite.deletesCluster() && !replacedTarget) {
            updatedClusters.add(new RoomCluster(
                    rewrite.targetClusterId(),
                    mapId,
                    rewrite.clusterCenter(),
                    rewrite.rooms(),
                    rewrite.localConnections()));
        }
        for (ClusterRewriteSplit splitCluster : rewrite.splitClusters()) {
            updatedClusters.add(new RoomCluster(
                    splitCluster.clusterId(),
                    mapId,
                    splitCluster.clusterCenter(),
                    splitCluster.rooms(),
                    splitCluster.localConnections()));
        }
        Map<Long, Integer> updatedClusterLevels = new LinkedHashMap<>(clusterLevelsById);
        int targetLevel = levelForCluster(rewrite.targetClusterId());
        for (ClusterRewriteSplit splitCluster : rewrite.splitClusters()) {
            updatedClusterLevels.put(splitCluster.clusterId(), targetLevel);
        }
        return new DungeonLayout(mapId, name, corridors, updatedClusters, stairs, transitions, updatedClusterLevels, roomLevelsById);
    }

    public DungeonLayout projectedToLevel(int levelZ) {
        List<RoomCluster> projectedClusters = clusters.stream()
                .filter(cluster -> cluster != null && levelForCluster(cluster.clusterId()) == levelZ)
                .toList();
        List<Corridor> projectedCorridors = corridors.stream()
                .filter(corridor -> corridor != null && corridorReachesLevel(corridor, levelZ))
                .toList();
        List<DungeonStair> projectedStairs = stairs.stream()
                .filter(stair -> stair != null && stair.reachableLevels().contains(levelZ))
                .toList();
        List<DungeonTransition> projectedTransitions = transitions.stream()
                .filter(transition -> transition != null && transition.isPlaced() && transition.levelZ() == levelZ)
                .toList();
        return new DungeonLayout(mapId, name, projectedCorridors, projectedClusters, projectedStairs, projectedTransitions, clusterLevelsById, roomLevelsById);
    }

    public List<DungeonStair> stairsAtLevel(int levelZ) {
        return stairs.stream()
                .filter(stair -> stair != null && stair.reachableLevels().contains(levelZ))
                .toList();
    }

    public List<DungeonTransition> transitionsAtLevel(int levelZ) {
        return transitions.stream()
                .filter(transition -> transition != null && transition.isPlaced() && transition.levelZ() == levelZ)
                .toList();
    }

    private static Map<Long, Room> indexRooms(List<RoomCluster> clusters) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    result.put(room.roomId(), room);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static List<Connection> indexConnections(List<RoomCluster> clusters, List<Corridor> corridors) {
        List<Connection> result = new ArrayList<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            result.addAll(cluster.localConnections().stream()
                    .filter(Objects::nonNull)
                    .map(Connection.class::cast)
                    .toList());
        }
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            result.addAll(corridor.connections().stream()
                    .filter(Objects::nonNull)
                    .map(Connection.class::cast)
                    .toList());
        }
        return List.copyOf(result);
    }

    private static Map<VertexEdge, Connection> indexConnectionsByEdge(List<Connection> connections) {
        Map<VertexEdge, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            for (VertexEdge edge : connection.door().edges()) {
                result.putIfAbsent(edge, connection);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Door, List<ConnectionEndpoint>> indexEndpointsByDoor(List<Connection> connections) {
        Map<Door, List<ConnectionEndpoint>> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            result.put(connection.door(), connection.endpoints());
        }
        return Map.copyOf(result);
    }

    private static Map<ConnectionEndpoint, List<Connection>> indexConnectionsByEndpoint(List<Connection> connections) {
        Map<ConnectionEndpoint, List<Connection>> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null) {
                continue;
            }
            for (ConnectionEndpoint endpoint : connection.endpoints()) {
                result.computeIfAbsent(endpoint, ignored -> new ArrayList<>()).add(connection);
            }
        }
        return result.entrySet().stream()
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, entry -> List.copyOf(entry.getValue())));
    }

    private static Map<Long, RoomCluster> indexClusters(List<RoomCluster> clusters) {
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Corridor> indexCorridors(List<Corridor> corridors) {
        Map<Long, Corridor> result = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor != null && corridor.corridorId() != null) {
                result.put(corridor.corridorId(), corridor);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonStair> indexStairs(List<DungeonStair> stairs) {
        Map<Long, DungeonStair> result = new LinkedHashMap<>();
        for (DungeonStair stair : stairs) {
            if (stair != null && stair.stairId() != null) {
                result.put(stair.stairId(), stair);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonTransition> indexTransitions(List<DungeonTransition> transitions) {
        Map<Long, DungeonTransition> result = new LinkedHashMap<>();
        for (DungeonTransition transition : transitions) {
            if (transition != null && transition.transitionId() != null) {
                result.put(transition.transitionId(), transition);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Integer> indexLevels(Map<Long, Integer> levels) {
        Map<Long, Integer> result = new LinkedHashMap<>();
        if (levels == null) {
            return Map.of();
        }
        for (Map.Entry<Long, Integer> entry : levels.entrySet()) {
            if (entry.getKey() != null) {
                result.put(entry.getKey(), entry.getValue() == null ? 0 : entry.getValue());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Integer> indexRoomLevels(
            Map<Long, Room> roomsById,
            Map<Long, Integer> explicitRoomLevels,
            Map<Long, Integer> clusterLevels
    ) {
        Map<Long, Integer> result = new LinkedHashMap<>();
        if (roomsById == null || roomsById.isEmpty()) {
            return Map.of();
        }
        for (Map.Entry<Long, Room> entry : roomsById.entrySet()) {
            Long roomId = entry.getKey();
            Room room = entry.getValue();
            Integer level = explicitRoomLevels == null ? null : explicitRoomLevels.get(roomId);
            if (level == null && room != null) {
                level = clusterLevels.get(room.clusterId());
            }
            result.put(roomId, level == null ? 0 : level);
        }
        return Map.copyOf(result);
    }

    private int canonicalLevelForCorridor(Corridor corridor) {
        if (corridor == null || corridor.path() == null) {
            return 0;
        }
        Integer floorLevel = corridor.path().floorsByLevel().keySet().stream()
                .filter(Objects::nonNull)
                .min(Integer::compareTo)
                .orElse(null);
        if (floorLevel != null) {
            return floorLevel;
        }
        return corridor.connections().stream()
                .map(connection -> connectionLevel(connection, roomLevelsById))
                .filter(Objects::nonNull)
                .min(Integer::compareTo)
                .orElse(0);
    }

    public Set<VertexEdge> doorEdgesForCorridorAtLevel(long corridorId, int levelZ) {
        Corridor corridor = findCorridor(corridorId);
        if (corridor == null) {
            return Set.of();
        }
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Connection connection : corridor.connections()) {
            if (!Objects.equals(connectionLevel(connection, roomLevelsById), levelZ) || connection.door() == null) {
                continue;
            }
            result.addAll(connection.door().edges());
        }
        return Set.copyOf(result);
    }

    private static boolean corridorConnectionReachesLevel(
            Corridor corridor,
            int levelZ,
            Map<Long, Integer> roomLevelsById
    ) {
        return corridor.connections().stream()
                .anyMatch(connection -> Objects.equals(connectionLevel(connection, roomLevelsById), levelZ));
    }

    private static Integer connectionLevel(Connection connection, Map<Long, Integer> roomLevelsById) {
        if (connection == null) {
            return null;
        }
        for (ConnectionEndpoint endpoint : connection.endpoints()) {
            if (endpoint != null && endpoint.type() == features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.ROOM) {
                return roomLevelsById.getOrDefault(endpoint.id(), 0);
            }
        }
        return 0;
    }

    private static Set<Point2i> indexTraversableCells(List<RoomCluster> clusters, List<Corridor> corridors) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.floor() != null) {
                    result.addAll(room.floor().shape().absoluteCells());
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor != null && corridor.path() != null && corridor.path().floor() != null) {
                result.addAll(corridor.path().floor().shape().absoluteCells());
            }
        }
        return Set.copyOf(result);
    }

    private static Set<CubePoint> indexTraversableCubeCells(
            List<RoomCluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs,
            Map<Long, Integer> roomLevels
    ) {
        Set<CubePoint> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room == null || room.floor() == null || room.roomId() == null) {
                    continue;
                }
                int levelZ = roomLevels.getOrDefault(room.roomId(), 0);
                for (Point2i cell : room.floor().shape().absoluteCells()) {
                    result.add(CubePoint.at(cell, levelZ));
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.path() == null) {
                continue;
            }
            for (Map.Entry<Integer, features.world.dungeonmap.model.objects.Floor> entry : corridor.path().floorsByLevel().entrySet()) {
                if (entry == null || entry.getValue() == null) {
                    continue;
                }
                int levelZ = entry.getKey();
                for (Point2i cell : entry.getValue().shape().absoluteCells()) {
                    result.add(CubePoint.at(cell, levelZ));
                }
            }
        }
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                result.addAll(stair.occupiedPositions());
            }
        }
        return Set.copyOf(result);
    }

    private static List<Integer> indexReachableLevels(Set<CubePoint> traversableCubeCells) {
        Set<Integer> result = new LinkedHashSet<>();
        if (traversableCubeCells != null) {
            traversableCubeCells.stream()
                    .map(CubePoint::z)
                    .sorted()
                    .forEach(result::add);
        }
        return List.copyOf(result);
    }

    private static Map<String, CorridorNetwork> indexCorridorNetworks(List<CorridorNetwork> networks) {
        Map<String, CorridorNetwork> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network != null && network.networkId() != null) {
                result.put(network.networkId(), network);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, String> indexCorridorNetworkIdsByCorridorId(List<CorridorNetwork> networks) {
        Map<Long, String> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network == null || network.networkId() == null) {
                continue;
            }
            for (Long corridorId : network.corridorIds()) {
                if (corridorId != null) {
                    result.put(corridorId, network.networkId());
                }
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, List<Long>> indexCorridorIdsByCell(List<Corridor> corridors) {
        Map<Point2i, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null || corridor.path() == null) {
                continue;
            }
            // Keep the legacy 2D corridor lookup aggregate for projection-based callers.
            for (Point2i cell : corridor.path().floor().shape().absoluteCells()) {
                mutable.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        Map<Point2i, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Point2i, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<CubePoint, List<Long>> indexCorridorIdsByPoint(List<Corridor> corridors) {
        Map<CubePoint, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null || corridor.path() == null) {
                continue;
            }
            for (Map.Entry<Integer, features.world.dungeonmap.model.objects.Floor> entry : corridor.path().floorsByLevel().entrySet()) {
                if (entry == null || entry.getValue() == null) {
                    continue;
                }
                int levelZ = entry.getKey();
                for (Point2i cell : entry.getValue().shape().absoluteCells()) {
                    mutable.computeIfAbsent(CubePoint.at(cell, levelZ), ignored -> new ArrayList<>()).add(corridor.corridorId());
                }
            }
        }
        Map<CubePoint, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<CubePoint, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<Point2i, String> indexCorridorNetworkIdsByCell(List<CorridorNetwork> networks) {
        Map<Point2i, String> result = new LinkedHashMap<>();
        for (CorridorNetwork network : networks) {
            if (network == null || network.networkId() == null) {
                continue;
            }
            for (Point2i cell : network.floor().shape().absoluteCells()) {
                result.put(cell, network.networkId());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<CubePoint, List<Long>> indexStairIdsByPoint(List<DungeonStair> stairs) {
        Map<CubePoint, List<Long>> mutable = new LinkedHashMap<>();
        for (DungeonStair stair : stairs) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            for (CubePoint point : stair.occupiedPositions()) {
                mutable.computeIfAbsent(point, ignored -> new ArrayList<>()).add(stair.stairId());
            }
        }
        Map<CubePoint, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<CubePoint, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<CubePoint, List<Long>> indexTransitionIdsByPoint(List<DungeonTransition> transitions) {
        Map<CubePoint, List<Long>> mutable = new LinkedHashMap<>();
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.transitionId() == null || !transition.isPlaced()) {
                continue;
            }
            mutable.computeIfAbsent(transition.anchor(), ignored -> new ArrayList<>()).add(transition.transitionId());
        }
        Map<CubePoint, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<CubePoint, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
