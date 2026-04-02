package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.ClusterRewriteSplit;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Layout is only the global lookup surface over direct structure owners.
 *
 * <p>The behavior to preserve is that rooms/clusters, corridors, stairs, and transitions answer queries directly.
 * Do not move active behavior back into a second aggregate layer.
 *
 * <p>`Point2i` here stays limited to cell lookups, traversable-cell indexes, and movement vectors. Shared half-step
 * geometry belongs to `LegacyGridPoint2x` and `LegacyGridSegment2x` instead.
 */
public final class DungeonLayout {

    public sealed interface CellStructure permits CellStructure.RoomStructure, CellStructure.CorridorStructure, CellStructure.StairStructure, CellStructure.TransitionStructure {
        record RoomStructure(Room room) implements CellStructure {
        }

        record CorridorStructure(Corridor corridor) implements CellStructure {
        }

        record StairStructure(DungeonStair stair) implements CellStructure {
        }

        record TransitionStructure(DungeonTransition transition) implements CellStructure {
        }
    }

    private static final DungeonLayout EMPTY = new DungeonLayout(0L, "Kein Dungeon", List.of(), List.of(), List.of(), List.of(), Map.of());

    private final long mapId;
    private final String name;
    private final List<Corridor> corridors;
    private final List<RoomCluster> clusters;
    private final List<DungeonStair> stairs;
    private final List<DungeonTransition> transitions;
    private final List<Connection> connections;
    private final Map<LegacyGridSegment2x, Connection> connectionsBySegment2x;
    private final Map<ConnectionSegmentKey, Connection> connectionsBySegmentAndLevel2x;
    private final Map<ConnectionEndpoint, List<Connection>> connectionsByEndpoint;
    private final Map<Door, List<ConnectionEndpoint>> endpointsByDoor;
    private final Map<Long, Room> roomsById;
    private final Map<Long, Corridor> corridorsById;
    private final Map<Long, RoomCluster> clustersById;
    private final Map<Long, DungeonStair> stairsById;
    private final Map<Long, DungeonTransition> transitionsById;
    private final Map<Long, Integer> clusterLevelsById;
    private final Map<Long, Set<Integer>> roomLevelsByRoomId;
    private final Map<Point2i, List<Long>> corridorIdsByCell;
    private final Map<CubePoint, List<Long>> corridorIdsByPoint;
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
        this(mapId, name, corridors, clusters, List.of(), List.of(), Map.of());
    }

    public DungeonLayout(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<RoomCluster> clusters,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions,
            Map<Long, Integer> clusterLevelsById
    ) {
        this.mapId = mapId;
        this.name = name == null || name.isBlank() ? "Dungeon " + mapId : name;
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.clusters = clusters == null ? List.of() : List.copyOf(clusters);
        this.stairs = stairs == null ? List.of() : List.copyOf(stairs);
        this.transitions = transitions == null ? List.of() : List.copyOf(transitions);
        this.connections = indexConnections(this.clusters, this.corridors);
        this.connectionsBySegment2x = indexConnectionsBySegment2x(this.connections);
        this.connectionsBySegmentAndLevel2x = indexConnectionsBySegmentAndLevel2x(this.connections);
        this.connectionsByEndpoint = indexConnectionsByEndpoint(this.connections);
        this.endpointsByDoor = indexEndpointsByDoor(this.connections);
        this.roomsById = indexRooms(this.clusters);
        this.corridorsById = indexCorridors(this.corridors);
        this.clustersById = indexClusters(this.clusters);
        this.stairsById = indexStairs(this.stairs);
        this.transitionsById = indexTransitions(this.transitions);
        this.clusterLevelsById = indexLevels(clusterLevelsById);
        this.roomLevelsByRoomId = indexRoomLevels(this.roomsById);
        this.corridorIdsByCell = indexCorridorIdsByCell(this.corridors);
        this.corridorIdsByPoint = indexCorridorIdsByPoint(this.corridors);
        this.stairIdsByPoint = indexStairIdsByPoint(this.stairs);
        this.transitionIdsByPoint = indexTransitionIdsByPoint(this.transitions);
        this.traversableCells = indexTraversableCells(this.clusters, this.corridors);
        this.traversableCubeCells = indexTraversableCubeCells(this.clusters, this.corridors, this.stairs);
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
        Room room = findRoom(roomId);
        return room == null ? 0 : room.structure().primaryLevel();
    }

    public Set<Integer> levelsForRoom(Long roomId) {
        return roomId == null ? Set.of() : roomLevelsByRoomId.getOrDefault(roomId, Set.of());
    }

    public int levelForCorridor(Long corridorId) {
        Corridor corridor = findCorridor(corridorId);
        return corridor == null ? 0 : corridor.levelZ();
    }

    public List<RoomCluster> overlappingClusters(Collection<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        return clusters.stream()
                .filter(cluster -> cluster != null && cluster.overlaps(cells))
                .toList();
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

    public Door doorAt(LegacyGridSegment2x segment2x) {
        Connection connection = connectionAt(segment2x);
        return connection == null ? null : connection.door();
    }

    public Connection connectionAt(LegacyGridSegment2x segment2x) {
        return segment2x == null ? null : connectionsBySegment2x.get(segment2x);
    }

    public Connection connectionAt(int levelZ, LegacyGridSegment2x segment2x) {
        return segment2x == null ? null : connectionsBySegmentAndLevel2x.get(new ConnectionSegmentKey(levelZ, segment2x));
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

    public List<Door> doorsAtSegments(Set<LegacyGridSegment2x> segments2x) {
        if (segments2x == null || segments2x.isEmpty()) {
            return List.of();
        }
        return segments2x.stream()
                .map(this::doorAt)
                .filter(Objects::nonNull)
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

    public List<Corridor> corridorsForRoom(Long roomId) {
        if (roomId == null) {
            return List.of();
        }
        return corridors.stream()
                .filter(corridor -> corridor != null && corridor.connectsRoom(roomId))
                .toList();
    }

    public RoomCluster findCluster(Long clusterId) {
        return clusterId == null ? null : clustersById.get(clusterId);
    }

    public RoomCluster clusterForRoom(Long roomId) {
        Room room = findRoom(roomId);
        return room == null ? null : findCluster(room.clusterId());
    }

    public Room roomAtCell(CellCoord cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster.roomAt(cell);
            }
        }
        return null;
    }

    public Room roomAtCell(Point2i cell) {
        return roomAtCell(cell == null ? null : CellCoord.fromPoint(cell));
    }

    public RoomCluster clusterAtCell(CellCoord cell) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    public RoomCluster clusterAtCell(Point2i cell) {
        return clusterAtCell(cell == null ? null : CellCoord.fromPoint(cell));
    }

    public List<Corridor> corridorsAtCell(CellCoord cell) {
        List<Long> corridorIds = cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell.toPoint2i(), List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Corridor> corridorsAtCell(Point2i cell) {
        return corridorsAtCell(cell == null ? null : CellCoord.fromPoint(cell));
    }

    public List<Corridor> corridorsAtCell(CellCoord cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return corridorsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<Corridor> corridorsAtCell(Point2i cell, int levelZ) {
        return corridorsAtCell(cell == null ? null : CellCoord.fromPoint(cell), levelZ);
    }

    public List<Corridor> corridorsAtPoint(CubePoint point) {
        List<Long> corridorIds = point == null ? List.of() : corridorIdsByPoint.getOrDefault(point, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<DungeonStair> stairsAtCell(CellCoord cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return stairsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<DungeonStair> stairsAtCell(Point2i cell, int levelZ) {
        return stairsAtCell(cell == null ? null : CellCoord.fromPoint(cell), levelZ);
    }

    public List<DungeonStair> stairsAtPoint(CubePoint point) {
        List<Long> stairIds = point == null ? List.of() : stairIdsByPoint.getOrDefault(point, List.of());
        return stairIds.stream()
                .map(this::findStair)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<DungeonTransition> transitionsAtCell(CellCoord cell, int levelZ) {
        if (cell == null) {
            return List.of();
        }
        return transitionsAtPoint(CubePoint.at(cell, levelZ));
    }

    public List<DungeonTransition> transitionsAtCell(Point2i cell, int levelZ) {
        return transitionsAtCell(cell == null ? null : CellCoord.fromPoint(cell), levelZ);
    }

    public List<DungeonTransition> transitionsAtPoint(CubePoint point) {
        List<Long> transitionIds = point == null ? List.of() : transitionIdsByPoint.getOrDefault(point, List.of());
        return transitionIds.stream()
                .map(this::findTransition)
                .filter(Objects::nonNull)
                .toList();
    }

    public CellStructure structureAtCell(CellCoord cell) {
        if (cell == null) {
            return null;
        }
        Room room = roomAtCell(cell);
        if (room != null) {
            return new CellStructure.RoomStructure(room);
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

    public CellStructure structureAtCell(Point2i cell) {
        return structureAtCell(cell == null ? null : CellCoord.fromPoint(cell));
    }

    public Set<Point2i> traversableCells() {
        return traversableCells;
    }

    public boolean isTraversableCell(CellCoord cell) {
        return cell != null && traversableCells.contains(cell.toPoint2i());
    }

    public boolean isTraversableCell(Point2i cell) {
        return isTraversableCell(cell == null ? null : CellCoord.fromPoint(cell));
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

    public DungeonLayout withReplacedCluster(RoomCluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return this;
        }
        List<RoomCluster> updatedClusters = clusters.stream()
                .map(existing -> cluster.clusterId().equals(existing.clusterId()) ? cluster : existing)
                .toList();
        return new DungeonLayout(mapId, name, corridors, updatedClusters, stairs, transitions, clusterLevelsById);
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
        return new DungeonLayout(mapId, name, corridors, updatedClusters, stairs, transitions, updatedClusterLevels);
    }

    public DungeonLayout projectedToLevel(int levelZ) {
        List<RoomCluster> projectedClusters = clusters.stream()
                .map(cluster -> cluster == null ? null : cluster.projectedToLevel(levelZ))
                .filter(Objects::nonNull)
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
        return new DungeonLayout(mapId, name, projectedCorridors, projectedClusters, projectedStairs, projectedTransitions, clusterLevelsById);
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

    private static boolean corridorReachesLevel(Corridor corridor, int levelZ) {
        return corridor != null
                && !corridor.structure().cellsAtLevel(levelZ).isEmpty();
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

    private static Map<LegacyGridSegment2x, Connection> indexConnectionsBySegment2x(List<Connection> connections) {
        Map<LegacyGridSegment2x, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            connection.door().segments2x().forEach(segment2x -> result.putIfAbsent(segment2x, connection));
        }
        return Map.copyOf(result);
    }

    private static Map<ConnectionSegmentKey, Connection> indexConnectionsBySegmentAndLevel2x(List<Connection> connections) {
        Map<ConnectionSegmentKey, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.door() == null) {
                continue;
            }
            for (LegacyGridSegment2x segment2x : connection.door().segments2x()) {
                result.putIfAbsent(new ConnectionSegmentKey(connection.levelZ(), segment2x), connection);
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

    private static Map<Long, Set<Integer>> indexRoomLevels(Map<Long, Room> roomsById) {
        Map<Long, Set<Integer>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Room> entry : roomsById.entrySet()) {
            Room room = entry.getValue();
            result.put(entry.getKey(), room == null ? Set.of(0) : room.structure().levels());
        }
        return Map.copyOf(result);
    }

    private static Set<Point2i> indexTraversableCells(List<RoomCluster> clusters, List<Corridor> corridors) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null) {
                    result.addAll(room.structure().cells());
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor != null) {
                result.addAll(corridor.structure().cells());
            }
        }
        return Set.copyOf(result);
    }

    private static Set<CubePoint> indexTraversableCubeCells(
            List<RoomCluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs
    ) {
        Set<CubePoint> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                result.addAll(room.structure().cubePoints());
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            result.addAll(corridor.structure().cubePoints());
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

    private static Map<Point2i, List<Long>> indexCorridorIdsByCell(List<Corridor> corridors) {
        Map<Point2i, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (Point2i cell : corridor.structure().cells()) {
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
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (CubePoint cell : corridor.structure().cubePoints()) {
                if (cell != null) {
                    mutable.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(corridor.corridorId());
                }
            }
        }
        Map<CubePoint, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<CubePoint, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
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

    private record ConnectionSegmentKey(int levelZ, LegacyGridSegment2x segment2x) {
    }
}
