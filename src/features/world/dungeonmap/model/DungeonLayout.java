package features.world.dungeonmap.model;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.boundary.Door;
import features.world.dungeonmap.structure.model.boundary.DoorRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;
import features.world.dungeonmap.model.structures.connection.DoorExitDescriptor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorPathTrace;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
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
 * <p>Layout indices and runtime-facing cell lookups stay on `CellCoord`; shared half-step geometry belongs to
 * `GridSegment2x`.
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

    public record RoomBoundaryDescription(
            Long clusterId,
            Room room,
            CellCoord roomCell,
            CardinalDirection outwardDirection,
            boolean exterior
    ) {
        public RoomBoundaryDescription {
            room = Objects.requireNonNull(room, "room");
            roomCell = Objects.requireNonNull(roomCell, "roomCell");
            outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
        }
    }

    public record CorridorBoundaryDescription(
            Corridor corridor,
            CellCoord corridorCell
    ) {
        public CorridorBoundaryDescription {
            corridor = Objects.requireNonNull(corridor, "corridor");
            corridorCell = Objects.requireNonNull(corridorCell, "corridorCell");
        }
    }

    public record ConnectionSurfaceDescription(
            ConnectionEndpoint endpoint,
            CellCoord localCell,
            CardinalDirection outwardDirection
    ) {
        public ConnectionSurfaceDescription {
            endpoint = Objects.requireNonNull(endpoint, "endpoint");
            localCell = Objects.requireNonNull(localCell, "localCell");
            outwardDirection = Objects.requireNonNull(outwardDirection, "outwardDirection");
        }
    }

    public enum DoorRole {
        ROOM_LOCAL,
        ROOM_EXTERIOR,
        CORRIDOR_BOUNDARY
    }

    public record DoorDescription(
            DoorRef ref,
            Door door,
            int levelZ,
            DoorRole role,
            Long clusterId,
            Long corridorId,
            List<Room> touchingRooms
    ) {
        public DoorDescription {
            ref = Objects.requireNonNull(ref, "ref");
            door = Objects.requireNonNull(door, "door");
            role = Objects.requireNonNull(role, "role");
            touchingRooms = touchingRooms == null ? List.of() : List.copyOf(touchingRooms);
        }

        public GridSegment2x anchorSegment2x() {
            return door.anchorSegment2x();
        }

        public Long roomId() {
            if (role != DoorRole.ROOM_EXTERIOR || touchingRooms.isEmpty()) {
                return null;
            }
            Room room = touchingRooms.getFirst();
            return room == null ? null : room.roomId();
        }

        public boolean isRoomLocal() {
            return role == DoorRole.ROOM_LOCAL;
        }

        public boolean isRoomExterior() {
            return role == DoorRole.ROOM_EXTERIOR;
        }

        public boolean isCorridorBoundary() {
            return role == DoorRole.CORRIDOR_BOUNDARY;
        }

        public boolean supportsTransitionPlacement() {
            return connectionEndpoint() != null;
        }

        public ConnectionEndpoint connectionEndpoint() {
            if (isRoomExterior()) {
                Long roomId = roomId();
                return roomId == null ? null : ConnectionEndpoint.room(roomId);
            }
            if (isCorridorBoundary()) {
                return corridorId == null ? null : ConnectionEndpoint.corridor(corridorId);
            }
            return null;
        }

        public DungeonSelectionRef ownerRef() {
            return switch (role) {
                case ROOM_LOCAL -> clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
                case ROOM_EXTERIOR -> {
                    Long roomId = roomId();
                    if (roomId != null) {
                        yield new DungeonSelectionRef.RoomRef(roomId);
                    }
                    yield clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
                }
                case CORRIDOR_BOUNDARY -> corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
            };
        }
    }

    private static final DungeonLayout EMPTY = new DungeonLayout(0L, "Kein Dungeon", List.of(), List.of(), List.of(), List.of(), Map.of());

    private final long mapId;
    private final String name;
    private final List<Corridor> corridors;
    private final List<RoomCluster> clusters;
    private final List<DungeonStair> stairs;
    private final List<DungeonTransition> transitions;
    private final List<DoorEntry> doorEntries;
    private final Map<Long, Door> doorsById;
    private final Map<Long, DoorDescription> doorDescriptionsById;
    private final Map<ConnectionSegmentKey, DoorEntry> doorEntriesBySegmentAndLevel2x;
    private final List<Connection> connections;
    private final Map<Long, Connection> connectionsByDoorId;
    private final Map<GridSegment2x, Connection> connectionsBySegment2x;
    private final Map<ConnectionSegmentKey, Connection> connectionsBySegmentAndLevel2x;
    private final Map<ConnectionEndpoint, List<Connection>> connectionsByEndpoint;
    private final Map<Long, Room> roomsById;
    private final Map<Long, Corridor> corridorsById;
    private final Map<Long, RoomCluster> clustersById;
    private final Map<Long, DungeonStair> stairsById;
    private final Map<Long, DungeonTransition> transitionsById;
    private final Map<Long, Integer> clusterLevelsById;
    private final Map<Long, Set<Integer>> roomLevelsByRoomId;
    private final Map<CellCoord, List<Long>> corridorIdsByCell;
    private final Map<Integer, Map<CellCoord, List<Long>>> corridorIdsByLevelAndCell;
    private final Map<Integer, Map<CellCoord, List<Long>>> stairIdsByLevelAndCell;
    private final Map<Integer, Map<CellCoord, List<Long>>> transitionIdsByLevelAndCell;
    private final Set<CellCoord> traversableCells;
    private final Map<Integer, Set<CellCoord>> traversableCellsByLevel;
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
        this.roomsById = indexRooms(this.clusters);
        this.corridorsById = indexCorridors(this.corridors);
        this.clustersById = indexClusters(this.clusters);
        this.stairsById = indexStairs(this.stairs);
        this.transitionsById = indexTransitions(this.transitions);
        this.doorEntries = indexDoorEntries(this.clusters, this.corridors);
        this.doorsById = indexDoorsById(this.doorEntries);
        this.doorDescriptionsById = indexDoorDescriptionsById(this.doorEntries);
        this.doorEntriesBySegmentAndLevel2x = indexDoorEntriesBySegmentAndLevel2x(this.doorEntries);
        this.connections = indexConnections(this.clusters, this.corridors, this.transitions, this.doorsById);
        this.connectionsByDoorId = indexConnectionsByDoorId(this.connections);
        this.connectionsBySegment2x = indexConnectionsBySegment2x(this.connections, this.doorsById);
        this.connectionsBySegmentAndLevel2x = indexConnectionsBySegmentAndLevel2x(this.connections, this.doorsById);
        this.connectionsByEndpoint = indexConnectionsByEndpoint(this.connections);
        this.clusterLevelsById = indexLevels(clusterLevelsById);
        this.roomLevelsByRoomId = indexRoomLevels(this.roomsById, this.clustersById);
        this.corridorIdsByCell = indexCorridorIdsByCell(this.corridors);
        this.corridorIdsByLevelAndCell = indexCorridorIdsByLevelAndCell(this.corridors);
        this.stairIdsByLevelAndCell = indexStairIdsByLevelAndCell(this.stairs);
        this.transitionIdsByLevelAndCell = indexTransitionIdsByLevelAndCell();
        this.traversableCells = indexTraversableCells(this.clusters, this.corridors, this.stairs, this.transitions);
        this.traversableCellsByLevel = indexTraversableCellsByLevel(this.clusters, this.corridors, this.stairs, this.transitions);
        this.reachableLevels = indexReachableLevels(this.traversableCellsByLevel);
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

    public List<DungeonTransition> placedTransitions() {
        return transitions.stream()
                .filter(transition -> transition != null && transition.isPlaced())
                .toList();
    }

    public List<DungeonTransition> preparedTransitions() {
        return transitions.stream()
                .filter(transition -> transition != null && !transition.isPlaced())
                .toList();
    }

    public List<Integer> reachableLevels() {
        return reachableLevels;
    }

    public int defaultLevel() {
        return reachableLevels.isEmpty() ? 0 : reachableLevels.getFirst();
    }

    public CubePoint defaultRuntimePosition() {
        Room defaultRoom = rooms().stream()
                .filter(room -> room != null && room.roomId() != null)
                .sorted(Comparator.comparing(Room::roomId))
                .findFirst()
                .orElse(null);
        if (defaultRoom != null) {
            int levelZ = roomPrimaryLevel(defaultRoom);
            CellCoord preferred = roomCenterCellAtLevel(defaultRoom, levelZ);
            CellCoord resolved = nearestTraversableCell(preferred, levelZ);
            if (resolved != null) {
                return CubePoint.at(resolved, levelZ);
            }
        }
        for (int levelZ : reachableLevels) {
            CellCoord fallback = traversableCellsByLevel.getOrDefault(levelZ, Set.of()).stream()
                    .sorted(CellCoord.ORDER)
                    .findFirst()
                    .orElse(null);
            if (fallback != null) {
                return CubePoint.at(fallback, levelZ);
            }
        }
        return null;
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

    public Map<Long, CellCoord> clusterCentersById() {
        Map<Long, CellCoord> result = new LinkedHashMap<>();
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
        return room == null ? 0 : roomPrimaryLevel(room);
    }

    public Set<Integer> levelsForRoom(Long roomId) {
        return roomId == null ? Set.of() : roomLevelsByRoomId.getOrDefault(roomId, Set.of());
    }

    public int levelForCorridor(Long corridorId) {
        Corridor corridor = findCorridor(corridorId);
        return corridor == null ? 0 : corridor.levelZ();
    }

    public List<RoomCluster> overlappingClusters(Collection<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        Set<CellCoord> candidateCells = CellCoord.normalize(cells);
        return clusters.stream()
                .filter(cluster -> cluster != null && cluster.overlapsCells(candidateCells))
                .toList();
    }

    public List<Connection> connections() {
        return connections;
    }

    public List<Door> doors() {
        return doorEntries.stream()
                .map(DoorEntry::door)
                .toList();
    }

    public Door doorAt(int levelZ, GridSegment2x segment2x) {
        DoorEntry entry = doorEntryAt(levelZ, segment2x);
        return entry == null ? null : entry.door();
    }

    public Door resolveDoor(DoorRef ref) {
        return ref == null ? null : doorsById.get(ref.doorId());
    }

    public Door resolveDoor(DungeonSelectionRef.DoorRef ref) {
        return ref == null ? null : resolveDoor(new DoorRef(ref.doorId()));
    }

    public DoorDescription describeDoor(DoorRef ref) {
        return ref == null ? null : doorDescriptionsById.get(ref.doorId());
    }

    public DoorDescription describeDoor(DungeonSelectionRef.DoorRef ref) {
        return ref == null ? null : describeDoor(new DoorRef(ref.doorId()));
    }

    public DungeonSelectionRef.DoorRef doorSelectionRefAt(int levelZ, GridSegment2x segment2x) {
        DoorDescription description = describeDoorAt(levelZ, segment2x);
        return description == null
                ? null
                : new DungeonSelectionRef.DoorRef(description.ref().doorId());
    }

    public DoorDescription describeDoorAt(int levelZ, GridSegment2x segment2x) {
        DoorEntry entry = doorEntryAt(levelZ, segment2x);
        return entry == null ? null : entry.description();
    }

    public DoorDescription existingExteriorRoomDoor(DungeonSelectionRef.RoomBoundaryRef ref, int levelZ) {
        if (ref == null) {
            return null;
        }
        RoomBoundaryDescription boundary = describeRoomBoundary(ref, levelZ);
        if (boundary == null || !boundary.exterior()) {
            return null;
        }
        DoorDescription description = describeDoorAt(levelZ, ref.boundarySegment2x());
        return description != null
                && description.isRoomExterior()
                && Objects.equals(description.roomId(), ref.roomId())
                ? description
                : null;
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Corridor findCorridor(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public Connection connectionAt(GridSegment2x segment2x) {
        return segment2x == null ? null : connectionsBySegment2x.get(segment2x);
    }

    public Connection connectionForDoor(DoorRef ref) {
        return ref == null ? null : connectionsByDoorId.get(ref.doorId());
    }

    public Connection connectionForDoor(DungeonSelectionRef.DoorRef ref) {
        return ref == null ? null : connectionForDoor(new DoorRef(ref.doorId()));
    }

    public Connection connectionAt(int levelZ, GridSegment2x segment2x) {
        return segment2x == null ? null : connectionsBySegmentAndLevel2x.get(new ConnectionSegmentKey(levelZ, segment2x));
    }

    private DoorEntry doorEntryAt(int levelZ, GridSegment2x segment2x) {
        return segment2x == null ? null : doorEntriesBySegmentAndLevel2x.get(new ConnectionSegmentKey(levelZ, segment2x));
    }

    public List<Connection> connectionsForRoom(long roomId) {
        return connectionsFor(ConnectionEndpoint.room(roomId));
    }

    public List<Connection> connectionsForCluster(long clusterId) {
        RoomCluster cluster = findCluster(clusterId);
        if (cluster == null) {
            return List.of();
        }
        Set<Connection> result = new LinkedHashSet<>();
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

    public List<DoorExitDescriptor> describeRoomExits(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return roomLevels(room).stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        this,
                        roomCellsAtLevel(room, levelZ),
                        levelZ,
                        connectionsForRoom(room.roomId())).stream())
                .toList();
    }

    public List<DoorExitDescriptor> describeCorridorExits(Corridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        return DoorExitCatalog.describe(
                this,
                corridor.structure().surfaceAtLevel(corridor.levelZ()).cellCoords(),
                corridor.levelZ(),
                connectionsForCorridor(corridor.corridorId()));
    }

    private List<Connection> connectionsFor(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return List.of();
        }
        return connectionsByEndpoint.getOrDefault(endpoint, List.of());
    }

    public RoomCluster clusterForRoom(Room room) {
        return room == null ? null : findCluster(room.clusterId());
    }

    public Set<Integer> roomLevels(Room room) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? room == null ? Set.of() : room.levels() : cluster.roomLevels(room);
    }

    public int roomPrimaryLevel(Room room) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? room == null ? 0 : room.primaryLevel() : cluster.roomPrimaryLevel(room);
    }

    public List<Integer> roomRelevantLevels(Room room, CellCoord focusCell, int focusLevelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? List.of() : cluster.roomRelevantLevels(room, focusCell, focusLevelZ);
    }

    public CellCoord roomAnchorCellAtLevel(Room room, int levelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? room == null ? null : room.anchorAtLevel(levelZ) : cluster.roomAnchorCellAtLevel(room, levelZ);
    }

    public CellCoord roomCenterCellAtLevel(Room room, int levelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? null : cluster.roomCenterCellAtLevel(room, levelZ);
    }

    public Set<CellCoord> roomCellsAtLevel(Room room, int levelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? Set.of() : cluster.roomCellsAtLevel(room, levelZ);
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Room room, int levelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster == null ? Set.of() : cluster.roomFloorCellsAtLevel(room, levelZ);
    }

    public boolean roomHasFloorCell(Room room, CellCoord cell, int levelZ) {
        RoomCluster cluster = clusterForRoom(room);
        return cluster != null && cluster.roomHasFloorCell(room, cell, levelZ);
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

    public RoomCluster clusterOnLevel(DungeonSelectionRef ref, int levelZ) {
        RoomCluster cluster = switch (ownerRef(ref)) {
            case DungeonSelectionRef.ClusterRef clusterRef -> findCluster(clusterRef.clusterId());
            case DungeonSelectionRef.RoomRef roomRef -> clusterForRoom(roomRef.roomId());
            case null, default -> null;
        };
        return cluster == null ? null : cluster.projectedToLevel(levelZ);
    }

    public Room room(DungeonSelectionRef ref) {
        return switch (ownerRef(ref)) {
            case DungeonSelectionRef.RoomRef roomRef -> findRoom(roomRef.roomId());
            case null, default -> null;
        };
    }

    public Corridor corridor(DungeonSelectionRef ref) {
        return switch (ownerRef(ref)) {
            case DungeonSelectionRef.CorridorRef corridorRef -> findCorridor(corridorRef.corridorId());
            case null, default -> null;
        };
    }

    public DungeonStair stair(DungeonSelectionRef ref) {
        return switch (ownerRef(ref)) {
            case DungeonSelectionRef.StairRef stairRef -> findStair(stairRef.stairId());
            case null, default -> null;
        };
    }

    public DungeonTransition transition(DungeonSelectionRef ref) {
        return switch (ownerRef(ref)) {
            case DungeonSelectionRef.TransitionRef transitionRef -> findTransition(transitionRef.transitionId());
            case null, default -> null;
        };
    }

    /**
     * Door refs stay as pure identity in interaction state. Current owner semantics are derived from the live layout
     * so hover, selection, and tool routing cannot drift from canonical door classification.
     */
    public DungeonSelectionRef ownerRef(DungeonSelectionRef ref) {
        if (ref instanceof DungeonSelectionRef.DoorRef doorRef) {
            DoorDescription description = describeDoor(doorRef);
            return description == null ? null : description.ownerRef();
        }
        return ref == null ? null : ref.ownerRef();
    }

    public boolean canAttachCorridor(DoorDescription description) {
        if (description == null || !description.isRoomExterior()) {
            return false;
        }
        RoomCluster cluster = findCluster(description.clusterId());
        return cluster != null && cluster.canDeleteExteriorDoor(description.levelZ(), description.anchorSegment2x());
    }

    /**
     * Room-boundary refs stay as stable owner/segment identity. Gesture-time facts like the touched room cell,
     * outward step, and exterior-vs-interior meaning are derived from the current layout projection.
     */
    public RoomBoundaryDescription describeRoomBoundary(DungeonSelectionRef.RoomBoundaryRef ref, int levelZ) {
        if (ref == null) {
            return null;
        }
        Room room = room(ref);
        if (room == null || ref.boundarySegment2x() == null) {
            return null;
        }
        for (CellCoord cell : ref.boundarySegment2x().touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
            if (!roomCellsAtLevel(room, levelZ).contains(cell)) {
                continue;
            }
            CardinalDirection outwardDirection = ref.boundarySegment2x().directionFrom(cell);
            if (outwardDirection == null) {
                continue;
            }
            CellCoord opposite = outwardDirection == null ? null : cell.add(outwardDirection.delta());
            boolean exterior = opposite == null || roomAtCell(opposite, levelZ) == null;
            return new RoomBoundaryDescription(room.clusterId(), room, cell, outwardDirection, exterior);
        }
        return null;
    }

    /**
     * Corridor-boundary refs remain tool-facing identity only. The layout resolves the touched corridor cell so
     * wall-based attach flows do not rebuild that boundary semantics in shell code.
     */
    public CorridorBoundaryDescription describeCorridorBoundary(
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        if (ref == null || ref.boundarySegment2x() == null) {
            return null;
        }
        CorridorBoundaryDescription boundary = connectedCorridorBoundary(ref, levelZ);
        if (boundary == null
                || boundary.corridor().boundaryDoorSegments(this).contains(ref.boundarySegment2x())
                || connectionAt(levelZ, ref.boundarySegment2x()) != null) {
            return null;
        }
        return boundary;
    }

    public ConnectionSurfaceDescription describeConnectionSurface(
            ConnectionEndpoint endpoint,
            GridSegment2x boundarySegment2x,
            int levelZ
    ) {
        if (endpoint == null || boundarySegment2x == null) {
            return null;
        }
        return switch (endpoint.type()) {
            case ROOM -> {
                RoomBoundaryDescription boundary = describeRoomBoundary(
                        new DungeonSelectionRef.RoomBoundaryRef(endpoint.id(), boundarySegment2x),
                        levelZ);
                yield boundary == null ? null : new ConnectionSurfaceDescription(
                        endpoint,
                        boundary.roomCell(),
                        boundary.outwardDirection());
            }
            case CORRIDOR -> {
                CorridorBoundaryDescription boundary = connectedCorridorBoundary(
                        new DungeonSelectionRef.CorridorBoundaryRef(endpoint.id(), boundarySegment2x),
                        levelZ);
                CardinalDirection outwardDirection = boundary == null ? null : boundarySegment2x.directionFrom(boundary.corridorCell());
                yield boundary == null || outwardDirection == null
                        ? null
                        : new ConnectionSurfaceDescription(endpoint, boundary.corridorCell(), outwardDirection);
            }
            default -> null;
        };
    }

    public Room roomAtCell(CellCoord cell) {
        for (RoomCluster cluster : clusters) {
            if (clusterContainsProjectedCell(cluster, cell)) {
                return cluster.roomAt(cell);
            }
        }
        return null;
    }

    public Room roomAtCell(CellCoord cell, int levelZ) {
        for (RoomCluster cluster : clusters) {
            Room room = cluster.roomAt(cell, levelZ);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    public Room roomWithFloorAtCell(CellCoord cell, int levelZ) {
        Room room = roomAtCell(cell, levelZ);
        return room != null && roomHasFloorCell(room, cell, levelZ) ? room : null;
    }

    private CorridorBoundaryDescription connectedCorridorBoundary(
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        if (ref == null || ref.boundarySegment2x() == null) {
            return null;
        }
        Corridor corridor = corridor(ref);
        if (corridor == null || !corridor.structure().boundaryAtLevel(levelZ).boundaryEdges().contains(ref.boundarySegment2x())) {
            return null;
        }
        List<CellCoord> corridorCells = ref.boundarySegment2x().touchingCells().stream()
                .filter(cell -> corridor.structure().surfaceAtLevel(levelZ).contains(cell))
                .sorted(CellCoord.ORDER)
                .toList();
        if (corridorCells.size() != 1) {
            return null;
        }
        return new CorridorBoundaryDescription(corridor, corridorCells.getFirst());
    }

    public RoomCluster clusterAtCell(CellCoord cell) {
        for (RoomCluster cluster : clusters) {
            if (clusterContainsProjectedCell(cluster, cell)) {
                return cluster;
            }
        }
        return null;
    }

    public RoomCluster clusterAtCell(CellCoord cell, int levelZ) {
        for (RoomCluster cluster : clusters) {
            if (cluster.contains(cell, levelZ)) {
                return cluster;
            }
        }
        return null;
    }

    public List<Corridor> corridorsAtCell(CellCoord cell) {
        List<Long> corridorIds = cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Corridor> corridorsAtCell(CellCoord cell, int levelZ) {
        return structuresAtCell(corridorIdsByLevelAndCell, cell, levelZ, this::findCorridor);
    }

    public List<DungeonStair> stairsAtCell(CellCoord cell, int levelZ) {
        return structuresAtCell(stairIdsByLevelAndCell, cell, levelZ, this::findStair);
    }

    public List<DungeonTransition> transitionsAtCell(CellCoord cell, int levelZ) {
        return structuresAtCell(transitionIdsByLevelAndCell, cell, levelZ, this::findTransition);
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

    public CellStructure structureAtCell(CellCoord cell, int levelZ) {
        if (cell == null) {
            return null;
        }
        Room room = roomWithFloorAtCell(cell, levelZ);
        if (room != null) {
            return new CellStructure.RoomStructure(room);
        }
        Corridor corridor = corridorsAtCell(cell, levelZ).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .min(Comparator.comparing(Corridor::corridorId))
                .orElse(null);
        if (corridor != null) {
            return new CellStructure.CorridorStructure(corridor);
        }
        DungeonStair stair = stairsAtCell(cell, levelZ).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
        if (stair != null) {
            return new CellStructure.StairStructure(stair);
        }
        DungeonTransition transition = transitionsAtCell(cell, levelZ).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .min(Comparator.comparing(DungeonTransition::transitionId))
                .orElse(null);
        return transition == null ? null : new CellStructure.TransitionStructure(transition);
    }

    public Set<CellCoord> traversableCells() {
        return traversableCells;
    }

    public boolean isTraversableCell(CellCoord cell) {
        return cell != null && traversableCells.contains(cell);
    }

    public boolean isTraversableCell(CellCoord cell, int levelZ) {
        return cell != null && traversableCellsByLevel.getOrDefault(levelZ, Set.of()).contains(cell);
    }

    public CellCoord nearestTraversableCell(CellCoord cell) {
        if (cell == null || traversableCells.isEmpty()) {
            return null;
        }
        return traversableCells.stream()
                .min(Comparator
                        .comparingInt((CellCoord candidate) -> candidate.manhattanDistance(cell))
                        .thenComparing(CellCoord.ORDER))
                .orElse(null);
    }

    public CellCoord nearestTraversableCell(CellCoord cell, int levelZ) {
        Set<CellCoord> candidates = traversableCellsByLevel.getOrDefault(levelZ, Set.of());
        if (cell == null || candidates.isEmpty()) {
            return null;
        }
        return candidates.stream()
                .min(Comparator
                        .comparingInt((CellCoord candidate) -> candidate.manhattanDistance(cell))
                        .thenComparing(CellCoord.ORDER))
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

    /**
     * Room rewrite workflows validate corridor bindings against the exact post-rewrite cluster projection before any
     * rows are committed, so the room owner needs a direct "replace these clusters with these final owners" layout seam.
     */
    public DungeonLayout withReplacedClusters(List<RoomCluster> originalClusters, List<RoomCluster> finalClusters) {
        List<RoomCluster> resolvedOriginalClusters = normalizedClusters(originalClusters);
        List<RoomCluster> resolvedFinalClusters = normalizedClusters(finalClusters);
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return this;
        }

        Set<Long> replacedClusterIds = resolvedOriginalClusters.stream()
                .map(RoomCluster::clusterId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, RoomCluster> replacementsById = new LinkedHashMap<>();
        ArrayList<RoomCluster> appendedClusters = new ArrayList<>();
        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                appendedClusters.add(cluster);
            } else {
                replacementsById.put(cluster.clusterId(), cluster);
            }
        }

        ArrayList<RoomCluster> updatedClusters = new ArrayList<>(clusters.size() + resolvedFinalClusters.size());
        for (RoomCluster existing : clusters) {
            if (existing == null || existing.clusterId() == null || !replacedClusterIds.contains(existing.clusterId())) {
                updatedClusters.add(existing);
                continue;
            }
            RoomCluster replacement = replacementsById.remove(existing.clusterId());
            if (replacement != null) {
                updatedClusters.add(replacement);
            }
        }
        updatedClusters.addAll(replacementsById.values());
        updatedClusters.addAll(appendedClusters);

        LinkedHashMap<Long, Integer> updatedClusterLevels = new LinkedHashMap<>(clusterLevelsById);
        for (Long clusterId : replacedClusterIds) {
            updatedClusterLevels.remove(clusterId);
        }
        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster != null && cluster.clusterId() != null) {
                updatedClusterLevels.put(cluster.clusterId(), cluster.primaryLevel());
            }
        }
        return new DungeonLayout(mapId, name, corridors, updatedClusters, stairs, transitions, updatedClusterLevels);
    }

    /**
     * Corridor graph edits resolve against the layout that already owns room bindings and connection context; callers
     * should not keep re-threading room collections through separate helper seams.
     */
    public Corridor planCorridor(int levelZ, List<CorridorNode> nodes, List<CorridorSegment> segments) {
        return Corridor.planned(this, levelZ, nodes, segments);
    }

    public Corridor planCorridor(
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        return Corridor.planned(this, levelZ, nodes, segments, doors);
    }

    public Corridor resolveCorridor(Long corridorId, int levelZ, List<CorridorNode> nodes, List<CorridorSegment> segments) {
        return Corridor.resolved(this, corridorId, levelZ, nodes, segments);
    }

    public Corridor resolveCorridor(
            Long corridorId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        return Corridor.resolved(this, corridorId, levelZ, nodes, segments, doors);
    }

    public Corridor resolveCorridor(
            Long corridorId,
            Long structureObjectId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Collection<Door> doors
    ) {
        Corridor resolvedCorridor = Corridor.resolved(this, corridorId, levelZ, nodes, segments, doors);
        return Corridor.rehydrated(
                this,
                corridorId,
                structureObjectId,
                levelZ,
                nodes,
                segments,
                resolvedCorridor.structure(),
                resolvedCorridor.pathTraces());
    }

    public Corridor rehydrateCorridor(
            Long corridorId,
            Long structureObjectId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Structure structure,
            List<CorridorPathTrace> pathTraces
    ) {
        return Corridor.rehydrated(this, corridorId, structureObjectId, levelZ, nodes, segments, structure, pathTraces);
    }

    public DungeonLayout withAddedCorridor(Corridor corridor) {
        if (corridor == null) {
            return this;
        }
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(corridors);
        updatedCorridors.add(corridor);
        return withCorridors(updatedCorridors);
    }

    public DungeonLayout withUpdatedCorridor(Corridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return this;
        }
        boolean replaced = false;
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(corridors.size());
        for (Corridor existing : corridors) {
            if (existing != null && Objects.equals(existing.corridorId(), corridor.corridorId())) {
                updatedCorridors.add(corridor);
                replaced = true;
            } else {
                updatedCorridors.add(existing);
            }
        }
        if (!replaced) {
            updatedCorridors.add(corridor);
        }
        return withCorridors(updatedCorridors);
    }

    public DungeonLayout withRemovedCorridor(Long corridorId) {
        if (corridorId == null) {
            return this;
        }
        List<Corridor> updatedCorridors = corridors.stream()
                .filter(corridor -> corridor == null || !Objects.equals(corridor.corridorId(), corridorId))
                .toList();
        return updatedCorridors.size() == corridors.size() ? this : withCorridors(updatedCorridors);
    }

    public DungeonLayout withAddedStair(DungeonStair stair) {
        if (stair == null) {
            return this;
        }
        ArrayList<DungeonStair> updatedStairs = new ArrayList<>(stairs);
        updatedStairs.add(stair);
        return withStairs(updatedStairs);
    }

    public DungeonLayout withUpdatedStair(DungeonStair stair) {
        if (stair == null || stair.stairId() == null) {
            return this;
        }
        boolean replaced = false;
        ArrayList<DungeonStair> updatedStairs = new ArrayList<>(stairs.size());
        for (DungeonStair existing : stairs) {
            if (existing != null && Objects.equals(existing.stairId(), stair.stairId())) {
                updatedStairs.add(stair);
                replaced = true;
            } else {
                updatedStairs.add(existing);
            }
        }
        if (!replaced) {
            updatedStairs.add(stair);
        }
        return withStairs(updatedStairs);
    }

    public DungeonLayout withRemovedStair(Long stairId) {
        if (stairId == null) {
            return this;
        }
        List<DungeonStair> updatedStairs = stairs.stream()
                .filter(stair -> stair == null || !Objects.equals(stair.stairId(), stairId))
                .toList();
        return updatedStairs.size() == stairs.size() ? this : withStairs(updatedStairs);
    }

    public DungeonLayout withAddedTransition(DungeonTransition transition) {
        if (transition == null) {
            return this;
        }
        ArrayList<DungeonTransition> updatedTransitions = new ArrayList<>(transitions);
        updatedTransitions.add(transition);
        return withTransitions(updatedTransitions);
    }

    public DungeonLayout withUpdatedTransition(DungeonTransition transition) {
        if (transition == null || transition.transitionId() == null) {
            return this;
        }
        boolean replaced = false;
        ArrayList<DungeonTransition> updatedTransitions = new ArrayList<>(transitions.size());
        for (DungeonTransition existing : transitions) {
            if (existing != null && Objects.equals(existing.transitionId(), transition.transitionId())) {
                updatedTransitions.add(transition);
                replaced = true;
            } else {
                updatedTransitions.add(existing);
            }
        }
        if (!replaced) {
            updatedTransitions.add(transition);
        }
        return withTransitions(updatedTransitions);
    }

    public DungeonLayout withRemovedTransition(Long transitionId) {
        if (transitionId == null) {
            return this;
        }
        List<DungeonTransition> updatedTransitions = transitions.stream()
                .filter(transition -> transition == null || !Objects.equals(transition.transitionId(), transitionId))
                .toList();
        return updatedTransitions.size() == transitions.size() ? this : withTransitions(updatedTransitions);
    }

    public DungeonLayout withMovedCluster(Long clusterId, CellCoord delta, int levelDelta) {
        RoomCluster cluster = findCluster(clusterId);
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (clusterId == null || cluster == null || (!translate && levelDelta == 0)) {
            return this;
        }
        RoomCluster movedCluster = cluster.movedBy(delta, levelDelta);
        List<RoomCluster> updatedClusters = clusters.stream()
                .map(existing -> Objects.equals(clusterId, existing.clusterId()) ? movedCluster : existing)
                .toList();
        LinkedHashMap<Long, Integer> updatedClusterLevels = new LinkedHashMap<>(clusterLevelsById);
        updatedClusterLevels.put(clusterId, levelForCluster(clusterId) + levelDelta);
        DungeonLayout movedLayout = new DungeonLayout(
                mapId,
                name,
                corridors,
                updatedClusters,
                stairs,
                transitions,
                updatedClusterLevels);
        Set<Long> movedRoomIds = cluster.rooms().stream()
                .filter(room -> room != null && room.roomId() != null)
                .map(Room::roomId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (movedRoomIds.isEmpty()) {
            return movedLayout;
        }
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(corridors.size());
        boolean corridorsChanged = false;
        for (Corridor corridor : corridors) {
            Corridor updatedCorridor = corridor == null
                    ? null
                    : corridor.adjustedForMovedRooms(movedLayout, movedRoomIds, delta, levelDelta);
            updatedCorridors.add(updatedCorridor);
            corridorsChanged |= updatedCorridor != corridor;
        }
        return corridorsChanged
                ? new DungeonLayout(mapId, name, updatedCorridors, updatedClusters, stairs, transitions, updatedClusterLevels)
                : movedLayout;
    }

    private DungeonLayout withCorridors(List<Corridor> updatedCorridors) {
        return new DungeonLayout(mapId, name, updatedCorridors, clusters, stairs, transitions, clusterLevelsById);
    }

    private DungeonLayout withStairs(List<DungeonStair> updatedStairs) {
        return new DungeonLayout(mapId, name, corridors, clusters, updatedStairs, transitions, clusterLevelsById);
    }

    private DungeonLayout withTransitions(List<DungeonTransition> updatedTransitions) {
        return new DungeonLayout(mapId, name, corridors, clusters, stairs, updatedTransitions, clusterLevelsById);
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
                .filter(transition -> transition != null && transition.isPlaced() && transition.occupiesLevel(levelZ))
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
                .filter(transition -> transition != null && transition.isPlaced() && transition.occupiesLevel(levelZ))
                .toList();
    }

    private static boolean corridorReachesLevel(Corridor corridor, int levelZ) {
        return corridor != null
                && !corridor.structure().surfaceAtLevel(levelZ).cellCoords().isEmpty();
    }

    private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        ArrayList<RoomCluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
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

    private static List<DoorEntry> indexDoorEntries(List<RoomCluster> clusters, List<Corridor> corridors) {
        Map<Long, DoorEntry> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Integer levelZ : cluster.structure().levels()) {
                for (Door door : cluster.structure().boundaryAtLevel(levelZ).doors()) {
                    DoorEntry entry = clusterDoorEntry(cluster, levelZ, door);
                    if (entry != null) {
                        result.putIfAbsent(entry.ref().doorId(), entry);
                    }
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            for (Door door : corridor.structure().boundaryAtLevel(corridor.levelZ()).doors()) {
                DoorEntry entry = corridorDoorEntry(corridor, door);
                if (entry != null) {
                    result.putIfAbsent(entry.ref().doorId(), entry);
                }
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result.values());
    }

    private static Map<Long, Door> indexDoorsById(List<DoorEntry> doorEntries) {
        Map<Long, Door> result = new LinkedHashMap<>();
        for (DoorEntry doorEntry : doorEntries) {
            if (doorEntry != null) {
                result.put(doorEntry.ref().doorId(), doorEntry.door());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Long, DoorDescription> indexDoorDescriptionsById(List<DoorEntry> doorEntries) {
        Map<Long, DoorDescription> result = new LinkedHashMap<>();
        for (DoorEntry doorEntry : doorEntries) {
            if (doorEntry != null) {
                result.put(doorEntry.ref().doorId(), doorEntry.description());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<ConnectionSegmentKey, DoorEntry> indexDoorEntriesBySegmentAndLevel2x(List<DoorEntry> doorEntries) {
        Map<ConnectionSegmentKey, DoorEntry> result = new LinkedHashMap<>();
        for (DoorEntry doorEntry : doorEntries) {
            if (doorEntry == null || doorEntry.door() == null) {
                continue;
            }
            for (GridSegment2x segment2x : doorEntry.door().segments2x()) {
                result.putIfAbsent(new ConnectionSegmentKey(doorEntry.description().levelZ(), segment2x), doorEntry);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Connection> indexConnections(
            List<RoomCluster> clusters,
            List<Corridor> corridors,
            List<DungeonTransition> transitions,
            Map<Long, Door> doorsById
    ) {
        List<Connection> result = new ArrayList<>();
        Set<ConnectionSegmentKey> explicitDoorSegments = new LinkedHashSet<>();
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            for (Connection connection : corridor.connections().stream()
                    .filter(Objects::nonNull)
                    .map(Connection.class::cast)
                    .toList()) {
                result.add(connection);
                registerDoorSegments(explicitDoorSegments, connection, doorsById);
            }
        }
        for (DungeonTransition transition : transitions) {
            Connection connection = transition == null ? null : transition.localConnection();
            if (connection != null) {
                result.add(connection);
                registerDoorSegments(explicitDoorSegments, connection, doorsById);
            }
        }
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Connection connection : cluster.localConnections().stream()
                    .filter(Objects::nonNull)
                    .map(Connection.class::cast)
                    .toList()) {
                if (connectionUsesAnyDoorSegment(connection, explicitDoorSegments, doorsById)) {
                    continue;
                }
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static boolean connectionUsesAnyDoorSegment(
            Connection connection,
            Set<ConnectionSegmentKey> occupiedSegments,
            Map<Long, Door> doorsById
    ) {
        if (connection == null || connection.doorCarrier() == null || occupiedSegments == null || occupiedSegments.isEmpty()) {
            return false;
        }
        for (GridSegment2x segment2x : boundarySegments(connection, doorsById)) {
            if (occupiedSegments.contains(new ConnectionSegmentKey(connection.levelZ(), segment2x))) {
                return true;
            }
        }
        return false;
    }

    private static void registerDoorSegments(
            Set<ConnectionSegmentKey> occupiedSegments,
            Connection connection,
            Map<Long, Door> doorsById
    ) {
        if (occupiedSegments == null || connection == null || connection.doorCarrier() == null) {
            return;
        }
        for (GridSegment2x segment2x : boundarySegments(connection, doorsById)) {
            occupiedSegments.add(new ConnectionSegmentKey(connection.levelZ(), segment2x));
        }
    }

    private static Map<GridSegment2x, Connection> indexConnectionsBySegment2x(
            List<Connection> connections,
            Map<Long, Door> doorsById
    ) {
        Map<GridSegment2x, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.doorCarrier() == null) {
                continue;
            }
            boundarySegments(connection, doorsById).forEach(segment2x -> result.putIfAbsent(segment2x, connection));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Connection> indexConnectionsByDoorId(List<Connection> connections) {
        Map<Long, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.doorRef() == null) {
                continue;
            }
            Connection existing = result.putIfAbsent(connection.doorRef().doorId(), connection);
            if (existing != null && !existing.equals(connection)) {
                throw new IllegalStateException("Door " + connection.doorRef().doorId()
                        + " is referenced by multiple connections: "
                        + connectionKey(existing) + " and " + connectionKey(connection));
            }
        }
        return Map.copyOf(result);
    }

    private static String connectionKey(Connection connection) {
        if (connection == null) {
            return "null";
        }
        return connection.kind()
                + "(ownerId=" + connection.ownerId()
                + ", levelZ=" + connection.levelZ()
                + ")";
    }

    private static Map<ConnectionSegmentKey, Connection> indexConnectionsBySegmentAndLevel2x(
            List<Connection> connections,
            Map<Long, Door> doorsById
    ) {
        Map<ConnectionSegmentKey, Connection> result = new LinkedHashMap<>();
        for (Connection connection : connections) {
            if (connection == null || connection.doorCarrier() == null) {
                continue;
            }
            for (GridSegment2x segment2x : boundarySegments(connection, doorsById)) {
                result.putIfAbsent(new ConnectionSegmentKey(connection.levelZ(), segment2x), connection);
            }
        }
        return Map.copyOf(result);
    }

    private static Set<GridSegment2x> boundarySegments(Connection connection, Map<Long, Door> doorsById) {
        if (connection == null || connection.doorCarrier() == null) {
            return Set.of();
        }
        DoorRef ref = connection.doorRef();
        Door door = ref == null || doorsById == null ? null : doorsById.get(ref.doorId());
        if (door == null || door.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(new LinkedHashSet<>(door.segments2x()));
    }

    private static DoorEntry clusterDoorEntry(RoomCluster cluster, int levelZ, Door door) {
        if (cluster == null || door == null || door.isEmpty() || door.doorId() == null || door.doorId() == 0L) {
            return null;
        }
        List<Room> touchingRooms = touchingRooms(cluster, levelZ, door);
        DoorRole role = touchingRooms.size() >= 2 ? DoorRole.ROOM_LOCAL : DoorRole.ROOM_EXTERIOR;
        DoorRef ref = new DoorRef(door.doorId());
        return new DoorEntry(
                ref,
                door,
                new DoorDescription(
                        ref,
                        door,
                        levelZ,
                        role,
                        cluster.clusterId(),
                        null,
                        touchingRooms));
    }

    private static DoorEntry corridorDoorEntry(Corridor corridor, Door door) {
        if (corridor == null || door == null || door.isEmpty() || door.doorId() == null || door.doorId() == 0L) {
            return null;
        }
        DoorRef ref = new DoorRef(door.doorId());
        return new DoorEntry(
                ref,
                door,
                new DoorDescription(
                        ref,
                        door,
                        corridor.levelZ(),
                        DoorRole.CORRIDOR_BOUNDARY,
                        null,
                        corridor.corridorId(),
                        List.of()));
    }

    private static List<Room> touchingRooms(RoomCluster cluster, int levelZ, Door door) {
        if (cluster == null || door == null || door.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Room> rooms = new LinkedHashSet<>();
        for (GridSegment2x segment2x : door.segments2x()) {
            for (CellCoord cell : segment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
                Room room = cluster.roomAt(cell, levelZ);
                if (room != null) {
                    rooms.add(room);
                }
            }
        }
        return rooms.isEmpty() ? List.of() : List.copyOf(rooms);
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

    private static Map<Long, Set<Integer>> indexRoomLevels(
            Map<Long, Room> roomsById,
            Map<Long, RoomCluster> clustersById
    ) {
        Map<Long, Set<Integer>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Room> entry : roomsById.entrySet()) {
            Room room = entry.getValue();
            RoomCluster cluster = room == null ? null : clustersById.get(room.clusterId());
            result.put(entry.getKey(), cluster == null ? room == null ? Set.of(0) : room.levels() : cluster.roomLevels(room));
        }
        return Map.copyOf(result);
    }

    private static boolean clusterContainsProjectedCell(RoomCluster cluster, CellCoord cell) {
        if (cluster == null || cell == null) {
            return false;
        }
        return cluster.structure().levels().stream()
                .anyMatch(levelZ -> cluster.structure().surfaceAtLevel(levelZ).contains(cell));
    }

    private static Set<CellCoord> indexTraversableCells(
            List<RoomCluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        Set<CellCoord> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null) {
                    for (Integer levelZ : cluster.roomLevels(room)) {
                        result.addAll(cluster.roomFloorCellsAtLevel(room, levelZ));
                    }
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor != null) {
                result.addAll(corridor.structure().surfaceAtLevel(corridor.levelZ()).cellCoords());
            }
        }
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                stair.occupiedPositions().stream()
                        .map(CubePoint::projectedCell)
                        .forEach(result::add);
            }
        }
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.localConnection() == null || transition.localConnection().stairCarrier() == null) {
                continue;
            }
            transition.localConnection().stairCarrier().path().stream()
                    .map(CubePoint::projectedCell)
                    .forEach(result::add);
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, Set<CellCoord>> indexTraversableCellsByLevel(
            List<RoomCluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        Map<Integer, Set<CellCoord>> mutable = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (Integer levelZ : cluster.roomLevels(room)) {
                    mutable.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .addAll(cluster.roomFloorCellsAtLevel(room, levelZ));
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            mutable.computeIfAbsent(corridor.levelZ(), ignored -> new LinkedHashSet<>())
                    .addAll(corridor.structure().surfaceAtLevel(corridor.levelZ()).cellCoords());
        }
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                for (CubePoint point : stair.occupiedPositions()) {
                    if (point != null) {
                        mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                                .add(point.projectedCell());
                    }
                }
            }
        }
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.localConnection() == null || transition.localConnection().stairCarrier() == null) {
                continue;
            }
            for (CubePoint point : transition.localConnection().stairCarrier().path()) {
                if (point != null) {
                    mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                            .add(point.projectedCell());
                }
            }
        }
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<Integer> indexReachableLevels(Map<Integer, Set<CellCoord>> traversableCellsByLevel) {
        return traversableCellsByLevel.keySet().stream()
                .sorted()
                .toList();
    }

    private static Map<CellCoord, List<Long>> indexCorridorIdsByCell(List<Corridor> corridors) {
        Map<CellCoord, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (CellCoord cell : corridor.structure().surfaceAtLevel(corridor.levelZ()).cellCoords()) {
                mutable.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        Map<CellCoord, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<CellCoord, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, Map<CellCoord, List<Long>>> indexCorridorIdsByLevelAndCell(List<Corridor> corridors) {
        Map<Integer, Map<CellCoord, List<Long>>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (CellCoord cell : corridor.structure().surfaceAtLevel(corridor.levelZ()).cellCoords()) {
                mutable.computeIfAbsent(corridor.levelZ(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(cell, ignored -> new ArrayList<>())
                        .add(corridor.corridorId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private static Map<Integer, Map<CellCoord, List<Long>>> indexStairIdsByLevelAndCell(List<DungeonStair> stairs) {
        Map<Integer, Map<CellCoord, List<Long>>> mutable = new LinkedHashMap<>();
        for (DungeonStair stair : stairs) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            for (CubePoint point : stair.occupiedPositions()) {
                if (point == null) {
                    continue;
                }
                mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(point.projectedCell(), ignored -> new ArrayList<>())
                        .add(stair.stairId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private Map<Integer, Map<CellCoord, List<Long>>> indexTransitionIdsByLevelAndCell() {
        Map<Integer, Map<CellCoord, List<Long>>> mutable = new LinkedHashMap<>();
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.transitionId() == null || !transition.isPlaced()) {
                continue;
            }
            for (CubePoint point : transition.localConnection().occupiedPositions(this)) {
                if (point == null) {
                    continue;
                }
                mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(point.projectedCell(), ignored -> new ArrayList<>())
                        .add(transition.transitionId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private static <T> List<T> structuresAtCell(
            Map<Integer, Map<CellCoord, List<Long>>> idsByLevelAndCell,
            CellCoord cell,
            int levelZ,
            java.util.function.Function<Long, T> resolver
    ) {
        if (cell == null) {
            return List.of();
        }
        List<Long> ids = idsByLevelAndCell.getOrDefault(levelZ, Map.of()).getOrDefault(cell, List.of());
        return ids.stream()
                .map(resolver)
                .filter(Objects::nonNull)
                .toList();
    }

    private static Map<Integer, Map<CellCoord, List<Long>>> immutableIdIndex(
            Map<Integer, Map<CellCoord, List<Long>>> mutable
    ) {
        Map<Integer, Map<CellCoord, List<Long>>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Map<CellCoord, List<Long>>> levelEntry : mutable.entrySet()) {
            Map<CellCoord, List<Long>> perCell = new LinkedHashMap<>();
            for (Map.Entry<CellCoord, List<Long>> entry : levelEntry.getValue().entrySet()) {
                perCell.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            result.put(levelEntry.getKey(), Map.copyOf(perCell));
        }
        return Map.copyOf(result);
    }

    private record ConnectionSegmentKey(int levelZ, GridSegment2x segment2x) {
    }

    private record DoorEntry(DoorRef ref, Door door, DoorDescription description) {
    }
}
