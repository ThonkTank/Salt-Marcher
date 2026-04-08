package features.world.dungeon.dungeonmap.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.cluster.model.ClusterRewritePlan;
import features.world.dungeon.model.structures.connection.Connection;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DoorExitCatalog;
import features.world.dungeon.model.structures.connection.DoorExitDescriptor;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.dungeonmap.corridor.model.CorridorReconcileInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorResolutionInput;
import features.world.dungeon.dungeonmap.corridor.model.CorridorInput;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;

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
 * DungeonMap is only the global lookup and orchestration surface over direct structure owners.
 *
 * <p>The behavior to preserve is that clusters, corridors, stairs, and transitions answer their own invariants
 * directly. Do not move active behavior back into a second aggregate layer.
 *
 * <p>Map indices and runtime-facing cell lookups stay on `GridPoint`; shared half-step geometry belongs to
 * `GridSegment`.
 */
public final class DungeonMap {

    public sealed interface CellStructure permits CellStructure.RoomStructure, CellStructure.CorridorStructure, CellStructure.StairStructure, CellStructure.TransitionStructure {
        record RoomStructure(Long clusterId, Long roomId) implements CellStructure {
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
            GridPoint roomCell,
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
            GridPoint corridorCell
    ) {
        public CorridorBoundaryDescription {
            corridor = Objects.requireNonNull(corridor, "corridor");
            corridorCell = Objects.requireNonNull(corridorCell, "corridorCell");
        }
    }

    public record ConnectionSurfaceDescription(
            ConnectionEndpoint endpoint,
            GridPoint localCell,
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

        public GridSegment anchorSegment() {
            return door.anchorSegment();
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

    private static final DungeonMap EMPTY = new DungeonMap(0L, "Kein Dungeon", List.of(), List.of(), List.of(), List.of(), Map.of());

    private final long mapId;
    private final String name;
    private final List<Corridor> corridors;
    private final List<Cluster> clusters;
    private final List<DungeonStair> stairs;
    private final List<DungeonTransition> transitions;
    private final List<DoorEntry> doorEntries;
    private final Map<Long, Door> doorsById;
    private final Map<Long, DoorDescription> doorDescriptionsById;
    private final Map<ConnectionSegmentKey, DoorEntry> doorEntriesBySegmentAndLevel2x;
    private final List<Connection> connections;
    private final Map<Long, Connection> connectionsByDoorId;
    private final Map<GridSegment, Connection> connectionsBySegment2x;
    private final Map<ConnectionSegmentKey, Connection> connectionsBySegmentAndLevel2x;
    private final Map<ConnectionEndpoint, List<Connection>> connectionsByEndpoint;
    private final Map<Long, Corridor> corridorsById;
    private final Map<Long, Cluster> clustersById;
    private final Map<Long, DungeonStair> stairsById;
    private final Map<Long, DungeonTransition> transitionsById;
    private final Map<Long, Integer> clusterLevelsById;
    private final Map<GridPoint, List<Long>> corridorIdsByCell;
    private final Map<Integer, Map<GridPoint, List<Long>>> corridorIdsByLevelAndCell;
    private final Map<Integer, Map<GridPoint, List<Long>>> stairIdsByLevelAndCell;
    private final Map<Integer, Map<GridPoint, List<Long>>> transitionIdsByLevelAndCell;
    private final Set<GridPoint> traversableCells;
    private final Map<Integer, Set<GridPoint>> traversableCellsByLevel;
    private final List<Integer> reachableLevels;

    public DungeonMap(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<Cluster> clusters
    ) {
        this(mapId, name, corridors, clusters, List.of(), List.of(), Map.of());
    }

    public DungeonMap(
            long mapId,
            String name,
            List<Corridor> corridors,
            List<Cluster> clusters,
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
        this.corridorIdsByCell = indexCorridorIdsByCell(this.corridors);
        this.corridorIdsByLevelAndCell = indexCorridorIdsByLevelAndCell(this.corridors);
        this.stairIdsByLevelAndCell = indexStairIdsByLevelAndCell(this.stairs);
        this.transitionIdsByLevelAndCell = indexTransitionIdsByLevelAndCell();
        this.traversableCells = indexTraversableCells(this.clusters, this.corridors, this.stairs, this.transitions);
        this.traversableCellsByLevel = indexTraversableCellsByLevel(this.clusters, this.corridors, this.stairs, this.transitions);
        this.reachableLevels = indexReachableLevels(this.traversableCellsByLevel);
    }

    public static DungeonMap empty() {
        return EMPTY;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    private List<Room> rooms() {
        return clusters.stream()
                .flatMap(cluster -> cluster.roomTopology().rooms().stream())
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

    public GridPoint defaultRuntimePosition() {
        Room defaultRoom = rooms().stream()
                .filter(room -> room != null && room.roomId() != null)
                .sorted(Comparator.comparing(Room::roomId))
                .findFirst()
                .orElse(null);
        if (defaultRoom != null) {
            int levelZ = roomPrimaryLevel(defaultRoom);
            GridPoint preferred = roomStructure(defaultRoom).surfaceAtLevel(levelZ).center();
            GridPoint resolved = nearestTraversableCell(preferred, levelZ);
            if (resolved != null) {
                return GridPoint.cell(cellX(resolved), cellY(resolved), levelZ);
            }
        }
        for (int levelZ : reachableLevels) {
            GridPoint fallback = traversableCellsByLevel.getOrDefault(levelZ, Set.of()).stream()
                    .sorted(GridPoint.ORDER)
                    .findFirst()
                    .orElse(null);
            if (fallback != null) {
                return GridPoint.cell(cellX(fallback), cellY(fallback), levelZ);
            }
        }
        return null;
    }

    public Map<Long, Corridor> corridorsById() {
        return corridorsById;
    }

    public List<Cluster> clusters() {
        return clusters;
    }

    public Map<Long, GridPoint> clusterCentersById() {
        Map<Long, GridPoint> result = new LinkedHashMap<>();
        for (Cluster cluster : clusters) {
            if (cluster != null && cluster.clusterId() != null) {
                result.put(cluster.clusterId(), cluster.center());
            }
        }
        return Map.copyOf(result);
    }

    public int levelForCluster(Long clusterId) {
        return clusterId == null ? 0 : clusterLevelsById.getOrDefault(clusterId, 0);
    }

    public int levelForCorridor(Long corridorId) {
        Corridor corridor = findCorridor(corridorId);
        return corridor == null ? 0 : corridor.levelZ();
    }

    public List<Cluster> overlappingClusters(GridArea cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        return clusters.stream()
                .filter(cluster -> cluster != null && cluster.overlapsCells(cells))
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

    public Door doorAt(int levelZ, GridSegment segment) {
        DoorEntry entry = doorEntryAt(levelZ, segment);
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

    public DungeonSelectionRef.DoorRef doorSelectionRefAt(int levelZ, GridSegment segment) {
        DoorDescription description = describeDoorAt(levelZ, segment);
        return description == null
                ? null
                : new DungeonSelectionRef.DoorRef(description.ref().doorId());
    }

    public DoorDescription describeDoorAt(int levelZ, GridSegment segment) {
        DoorEntry entry = doorEntryAt(levelZ, segment);
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
        DoorDescription description = describeDoorAt(levelZ, ref.boundarySegment());
        return description != null
                && description.isRoomExterior()
                && Objects.equals(description.roomId(), ref.roomId())
                ? description
                : null;
    }

    private Room findRoom(Long roomId) {
        if (roomId == null) {
            return null;
        }
        for (Cluster cluster : clusters) {
            Room room = cluster == null ? null : cluster.roomTopology().findRoom(roomId);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    public Corridor findCorridor(Long corridorId) {
        return corridorId == null ? null : corridorsById.get(corridorId);
    }

    public Connection connectionAt(GridSegment segment) {
        return segment == null ? null : connectionsBySegment2x.get(segment);
    }

    public Connection connectionForDoor(DoorRef ref) {
        return ref == null ? null : connectionsByDoorId.get(ref.doorId());
    }

    public Connection connectionForDoor(DungeonSelectionRef.DoorRef ref) {
        return ref == null ? null : connectionForDoor(new DoorRef(ref.doorId()));
    }

    public Connection connectionAt(int levelZ, GridSegment segment) {
        return segment == null ? null : connectionsBySegmentAndLevel2x.get(new ConnectionSegmentKey(levelZ, segment));
    }

    private DoorEntry doorEntryAt(int levelZ, GridSegment segment) {
        return segment == null ? null : doorEntriesBySegmentAndLevel2x.get(new ConnectionSegmentKey(levelZ, segment));
    }

    private List<Connection> connectionsForRoom(long roomId) {
        return connectionsFor(ConnectionEndpoint.room(roomId));
    }

    public List<Connection> connectionsForCluster(long clusterId) {
        Cluster cluster = findCluster(clusterId);
        if (cluster == null) {
            return List.of();
        }
        Set<Connection> result = new LinkedHashSet<>();
        for (Room room : cluster.roomTopology().rooms()) {
            if (room != null && room.roomId() != null) {
                result.addAll(connectionsForRoom(room.roomId()));
            }
        }
        return List.copyOf(result);
    }

    public List<Connection> connectionsForCorridor(long corridorId) {
        return connectionsFor(ConnectionEndpoint.corridor(corridorId));
    }

    public List<DoorExitDescriptor> describeCorridorExits(Corridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return List.of();
        }
        return DoorExitCatalog.describe(
                this,
                corridor.surfaceAtLevel(corridor.levelZ()).floor().cellFootprint(),
                corridor.levelZ(),
                connectionsForCorridor(corridor.corridorId()));
    }

    public List<Connection> connectionsForEndpoint(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return List.of();
        }
        return connectionsByEndpoint.getOrDefault(endpoint, List.of());
    }

    private List<Connection> connectionsFor(ConnectionEndpoint endpoint) {
        return connectionsForEndpoint(endpoint);
    }

    private Cluster clusterForRoom(Room room) {
        return room == null ? null : findCluster(room.clusterId());
    }

    private Set<Integer> roomLevels(Room room) {
        Cluster cluster = clusterForRoom(room);
        return cluster == null ? room == null ? Set.of() : room.levels() : cluster.roomTopology().roomLevels(room);
    }

    private int roomPrimaryLevel(Room room) {
        Cluster cluster = clusterForRoom(room);
        return cluster == null ? room == null ? 0 : room.primaryLevel() : cluster.roomTopology().roomPrimaryLevel(room);
    }

    private List<Integer> roomRelevantLevels(Room room, GridPoint focusCell, int focusLevelZ) {
        Cluster cluster = clusterForRoom(room);
        return cluster == null ? List.of() : cluster.roomTopology().roomRelevantLevels(room, focusCell, focusLevelZ);
    }

    private Structure roomStructure(Room room) {
        Cluster cluster = clusterForRoom(room);
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(room);
    }

    private Structure roomStructure(Long roomId) {
        Cluster cluster = clusterForRoom(roomId);
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(roomId);
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

    public Cluster findCluster(Long clusterId) {
        return clusterId == null ? null : clustersById.get(clusterId);
    }

    private Cluster clusterForRoom(Long roomId) {
        Room room = findRoom(roomId);
        return room == null ? null : findCluster(room.clusterId());
    }

    public Cluster clusterOnLevel(DungeonSelectionRef ref, int levelZ) {
        Cluster cluster = switch (ownerRef(ref)) {
            case DungeonSelectionRef.ClusterRef clusterRef -> findCluster(clusterRef.clusterId());
            case DungeonSelectionRef.RoomRef roomRef -> clusterForRoom(roomRef.roomId());
            case null, default -> null;
        };
        return cluster == null ? null : cluster.projectedToLevel(levelZ);
    }

    private Room room(DungeonSelectionRef ref) {
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
        Cluster cluster = findCluster(description.clusterId());
        return cluster != null && cluster.canDeleteExteriorDoor(description.levelZ(), description.anchorSegment());
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
        if (room == null || ref.boundarySegment() == null) {
            return null;
        }
        for (GridPoint cell : ref.boundarySegment().cellFootprint().cells().stream().sorted(GridPoint.ORDER).toList()) {
            if (!roomStructure(room).surfaceAtLevel(levelZ).surface().contains(cell)) {
                continue;
            }
            CardinalDirection outwardDirection = ref.boundarySegment().directionFrom(cell);
            if (outwardDirection == null) {
                continue;
            }
            GridPoint opposite = outwardDirection == null ? null : cell.step(outwardDirection);
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
        if (ref == null || ref.boundarySegment() == null) {
            return null;
        }
        CorridorBoundaryDescription boundary = connectedCorridorBoundary(ref, levelZ);
        if (boundary == null
                || boundary.corridor().boundaryDoorBoundary().contains(ref.boundarySegment())
                || connectionAt(levelZ, ref.boundarySegment()) != null) {
            return null;
        }
        return boundary;
    }

    public ConnectionSurfaceDescription describeConnectionSurface(
            ConnectionEndpoint endpoint,
            GridSegment boundarySegment,
            int levelZ
    ) {
        if (endpoint == null || boundarySegment == null) {
            return null;
        }
        return switch (endpoint.type()) {
            case ROOM -> {
                RoomBoundaryDescription boundary = describeRoomBoundary(
                        new DungeonSelectionRef.RoomBoundaryRef(endpoint.id(), boundarySegment),
                        levelZ);
                yield boundary == null ? null : new ConnectionSurfaceDescription(
                        endpoint,
                        boundary.roomCell(),
                        boundary.outwardDirection());
            }
            case CORRIDOR -> {
                CorridorBoundaryDescription boundary = connectedCorridorBoundary(
                        new DungeonSelectionRef.CorridorBoundaryRef(endpoint.id(), boundarySegment),
                        levelZ);
                CardinalDirection outwardDirection = boundary == null ? null : boundarySegment.directionFrom(boundary.corridorCell());
                yield boundary == null || outwardDirection == null
                        ? null
                        : new ConnectionSurfaceDescription(endpoint, boundary.corridorCell(), outwardDirection);
            }
            default -> null;
        };
    }

    private Room roomAtCell(GridPoint cell) {
        for (Cluster cluster : clusters) {
            if (clusterContainsProjectedCell(cluster, cell)) {
                return cluster.roomTopology().roomAt(cell, cluster.primaryLevel());
            }
        }
        return null;
    }

    private Room roomAtCell(GridPoint cell, int levelZ) {
        for (Cluster cluster : clusters) {
            Room room = cluster.roomTopology().roomAt(cell, levelZ);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    private Room roomWithFloorAtCell(GridPoint cell, int levelZ) {
        Room room = roomAtCell(cell, levelZ);
        return room != null && roomStructure(room).surfaceAtLevel(levelZ).floor().contains(cell) ? room : null;
    }

    private CorridorBoundaryDescription connectedCorridorBoundary(
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        if (ref == null || ref.boundarySegment() == null) {
            return null;
        }
        Corridor corridor = corridor(ref);
        if (corridor == null || !corridor.boundaryAtLevel(levelZ).boundary().contains(ref.boundarySegment())) {
            return null;
        }
        List<GridPoint> corridorCells = ref.boundarySegment().cellFootprint().cells().stream()
                .filter(cell -> corridor.surfaceAtLevel(levelZ).surface().contains(cell))
                .sorted(GridPoint.ORDER)
                .toList();
        if (corridorCells.size() != 1) {
            return null;
        }
        return new CorridorBoundaryDescription(corridor, corridorCells.getFirst());
    }

    public Cluster clusterAtCell(GridPoint cell) {
        for (Cluster cluster : clusters) {
            if (clusterContainsProjectedCell(cluster, cell)) {
                return cluster;
            }
        }
        return null;
    }

    public Cluster clusterAtCell(GridPoint cell, int levelZ) {
        for (Cluster cluster : clusters) {
            if (cluster.contains(cell, levelZ)) {
                return cluster;
            }
        }
        return null;
    }

    public List<Corridor> corridorsAtCell(GridPoint cell) {
        List<Long> corridorIds = cell == null ? List.of() : corridorIdsByCell.getOrDefault(cell, List.of());
        return corridorIds.stream()
                .map(this::findCorridor)
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Corridor> corridorsAtCell(GridPoint cell, int levelZ) {
        return structuresAtCell(corridorIdsByLevelAndCell, cell, levelZ, this::findCorridor);
    }

    public List<DungeonStair> stairsAtCell(GridPoint cell, int levelZ) {
        return structuresAtCell(stairIdsByLevelAndCell, cell, levelZ, this::findStair);
    }

    public List<DungeonTransition> transitionsAtCell(GridPoint cell, int levelZ) {
        return structuresAtCell(transitionIdsByLevelAndCell, cell, levelZ, this::findTransition);
    }

    public CellStructure structureAtCell(GridPoint cell) {
        if (cell == null) {
            return null;
        }
        Room room = roomAtCell(cell);
        if (room != null) {
            return new CellStructure.RoomStructure(room.clusterId(), room.roomId());
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

    public CellStructure structureAtCell(GridPoint cell, int levelZ) {
        if (cell == null) {
            return null;
        }
        Room room = roomWithFloorAtCell(cell, levelZ);
        if (room != null) {
            Cluster cluster = clusterAtCell(cell, levelZ);
            return new CellStructure.RoomStructure(cluster == null ? null : cluster.clusterId(), room.roomId());
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

    Set<GridPoint> traversableCells() {
        return traversableCells;
    }

    public boolean isTraversableCell(GridPoint cell) {
        return cell != null && traversableCells.contains(cell);
    }

    public boolean isTraversableCell(GridPoint cell, int levelZ) {
        return cell != null && traversableCellsByLevel.getOrDefault(levelZ, Set.of()).contains(cell);
    }

    public GridPoint nearestTraversableCell(GridPoint cell) {
        if (cell == null || traversableCells.isEmpty()) {
            return null;
        }
        return traversableCells.stream()
                .min(Comparator
                        .comparingInt((GridPoint candidate) -> Math.abs(cellX(candidate) - cellX(cell)) + Math.abs(cellY(candidate) - cellY(cell)))
                        .thenComparing(GridPoint.ORDER))
                .orElse(null);
    }

    public GridPoint nearestTraversableCell(GridPoint cell, int levelZ) {
        Set<GridPoint> candidates = traversableCellsByLevel.getOrDefault(levelZ, Set.of());
        if (cell == null || candidates.isEmpty()) {
            return null;
        }
        return candidates.stream()
                .min(Comparator
                        .comparingInt((GridPoint candidate) -> Math.abs(cellX(candidate) - cellX(cell)) + Math.abs(cellY(candidate) - cellY(cell)))
                        .thenComparing(GridPoint.ORDER))
                .orElse(null);
    }

    public DungeonMap withReplacedCluster(Cluster cluster) {
        if (cluster == null || cluster.clusterId() == null) {
            return this;
        }
        List<Cluster> updatedClusters = clusters.stream()
                .map(existing -> cluster.clusterId().equals(existing.clusterId()) ? cluster : existing)
                .toList();
        return new DungeonMap(mapId, name, corridors, updatedClusters, stairs, transitions, clusterLevelsById);
    }

    /**
     * Room rewrite workflows validate corridor bindings against the exact post-rewrite cluster projection before any
     * rows are committed, so the room owner needs a direct "replace these clusters with these final owners" layout seam.
     */
    public DungeonMap withReplacedClusters(List<Cluster> originalClusters, List<Cluster> finalClusters) {
        List<Cluster> resolvedOriginalClusters = normalizedClusters(originalClusters);
        List<Cluster> resolvedFinalClusters = normalizedClusters(finalClusters);
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return this;
        }

        Set<Long> replacedClusterIds = resolvedOriginalClusters.stream()
                .map(Cluster::clusterId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Cluster> replacementsById = new LinkedHashMap<>();
        ArrayList<Cluster> appendedClusters = new ArrayList<>();
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                appendedClusters.add(cluster);
            } else {
                replacementsById.put(cluster.clusterId(), cluster);
            }
        }

        ArrayList<Cluster> updatedClusters = new ArrayList<>(clusters.size() + resolvedFinalClusters.size());
        for (Cluster existing : clusters) {
            if (existing == null || existing.clusterId() == null || !replacedClusterIds.contains(existing.clusterId())) {
                updatedClusters.add(existing);
                continue;
            }
            Cluster replacement = replacementsById.remove(existing.clusterId());
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
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster != null && cluster.clusterId() != null) {
                updatedClusterLevels.put(cluster.clusterId(), cluster.primaryLevel());
            }
        }
        return new DungeonMap(mapId, name, corridors, updatedClusters, stairs, transitions, updatedClusterLevels);
    }

    public DungeonMap withAppliedClusterRewrite(ClusterRewritePlan plan) {
        if (plan == null) {
            return this;
        }
        return withReplacedClusters(plan.originalClusters(), plan.finalClusters());
    }

    public CorridorResolutionInput corridorResolutionInput(int levelZ) {
        return new CorridorResolutionInput(
                levelZ,
                blockedRoomCells(levelZ),
                exteriorDoorInputs(levelZ));
    }

    public void validateClusterRewrite(ClusterRewritePlan plan) {
        if (plan == null || !plan.hasChanges()) {
            return;
        }
        Set<Long> affectedRoomIds = plan.affectedRoomIds();
        if (affectedRoomIds.isEmpty()) {
            return;
        }
        DungeonMap rewrittenMap = withAppliedClusterRewrite(plan);
        validateCorridorRewrite(rewrittenMap, affectedRoomIds, plan.translation());
        validateTransitionRewrite(rewrittenMap, affectedRoomIds);
    }

    public ClusterRewriteEffects reconcileClusterRewrite(DungeonMap persistedRoomMap, ClusterRewritePlan plan) {
        if (persistedRoomMap == null || plan == null || !plan.hasChanges()) {
            return ClusterRewriteEffects.empty();
        }
        Set<Long> affectedRoomIds = plan.affectedRoomIds();
        if (affectedRoomIds.isEmpty()) {
            return ClusterRewriteEffects.empty();
        }
        List<Corridor> reboundCorridors = reboundCorridors(persistedRoomMap, affectedRoomIds, plan.translation());
        Map<Long, DungeonConnection> reboundTransitionConnections = reboundTransitionConnections(
                persistedRoomMap,
                affectedRoomIds);
        return reboundCorridors.isEmpty() && reboundTransitionConnections.isEmpty()
                ? ClusterRewriteEffects.empty()
                : new ClusterRewriteEffects(reboundCorridors, reboundTransitionConnections);
    }

    public void assertClusterFloorDeletionAllowed(Room room, int levelZ, GridArea removedFloorCells) {
        if (room == null || room.roomId() == null || removedFloorCells == null || removedFloorCells.isEmpty()) {
            return;
        }
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.levelZ() != levelZ) {
                continue;
            }
            if (corridor.touchesRoomAnchorCells(room.roomId(), removedFloorCells)) {
                throw new IllegalArgumentException("Boden unter einem Corridor-Anker kann nicht entfernt werden.");
            }
        }
        for (DungeonTransition transition : transitionsAtLevel(levelZ)) {
            if (transition != null
                    && transition.transitionId() != null
                    && transition.localConnection() != null
                    && transition.localConnection().cellFootprint(this).cells().stream()
                    .filter(point -> point != null && point.z() == levelZ)
                    .anyMatch(removedFloorCells.cells()::contains)) {
                throw new IllegalArgumentException("Boden unter einem platzierten Übergang kann nicht entfernt werden.");
            }
        }
        for (DungeonStair stair : stairsAtLevel(levelZ)) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            boolean usesRemovedExit = stair.exitsAtLevel(levelZ).stream()
                    .map(features.world.dungeon.model.structures.stair.StairExit::cell)
                    .filter(Objects::nonNull)
                    .anyMatch(removedFloorCells.cells()::contains);
            if (usesRemovedExit) {
                throw new IllegalArgumentException("Boden unter einem Treppenanschluss kann nicht entfernt werden.");
            }
        }
    }

    public void validateCorridorRoomRewrite(DungeonMap rewrittenMap, Set<Long> affectedRoomIds) {
        validateCorridorRewrite(rewrittenMap, affectedRoomIds, GridTranslation.none());
    }

    public List<Corridor> reboundCorridors(DungeonMap rewrittenMap, Set<Long> affectedRoomIds) {
        return reboundCorridors(rewrittenMap, affectedRoomIds, GridTranslation.none());
    }

    private void validateCorridorRewrite(DungeonMap rewrittenMap, Set<Long> affectedRoomIds, GridTranslation translation) {
        if (rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (Corridor corridor : corridors) {
            if (corridor != null && touchesAffectedRooms(corridor, affectedRoomIds)) {
                corridor.validateReconcile(corridorReconcileInput(corridor, rewrittenMap, affectedRoomIds, translation));
            }
        }
    }

    private List<Corridor> reboundCorridors(DungeonMap rewrittenMap, Set<Long> affectedRoomIds, GridTranslation translation) {
        if (rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return List.of();
        }
        ArrayList<Corridor> reboundCorridors = new ArrayList<>();
        for (Corridor corridor : corridors) {
            if (corridor != null && touchesAffectedRooms(corridor, affectedRoomIds)) {
                Corridor reboundCorridor = corridor.reconciled(
                        corridorReconcileInput(corridor, rewrittenMap, affectedRoomIds, translation));
                if (reboundCorridor != corridor) {
                    reboundCorridors.add(reboundCorridor);
                }
            }
        }
        return reboundCorridors.isEmpty() ? List.of() : List.copyOf(reboundCorridors);
    }

    private CorridorReconcileInput corridorReconcileInput(
            Corridor corridor,
            DungeonMap updatedMap,
            Set<Long> affectedRoomIds,
            GridTranslation translation
    ) {
        Corridor resolvedCorridor = Objects.requireNonNull(corridor, "corridor");
        DungeonMap resolvedUpdatedMap = Objects.requireNonNull(updatedMap, "updatedMap");
        int corridorLevel = resolvedCorridor.levelZ();
        CorridorResolutionInput updatedResolution = resolvedUpdatedMap.corridorResolutionInput(corridorLevel);
        return new CorridorReconcileInput(
                affectedRoomIds,
                exteriorDoorInputs(corridorLevel),
                resolvedUpdatedMap.exteriorDoorInputs(corridorLevel),
                translation,
                updatedResolution);
    }

    private Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> exteriorDoorInputs(int levelZ) {
        LinkedHashMap<DoorRef, CorridorResolutionInput.ExteriorDoorInput> result = new LinkedHashMap<>();
        for (DoorDescription description : doorDescriptionsById.values()) {
            if (description == null || description.levelZ() != levelZ || !description.isRoomExterior()) {
                continue;
            }
            RoomBoundaryDescription boundary = describeRoomBoundary(
                    new DungeonSelectionRef.RoomBoundaryRef(description.roomId(), description.anchorSegment()),
                    levelZ);
            if (boundary == null || !boundary.exterior()) {
                continue;
            }
            result.put(description.ref(), new CorridorResolutionInput.ExteriorDoorInput(
                    description.ref(),
                    description.door(),
                    description.roomId(),
                    description.anchorSegment(),
                    boundary.roomCell(),
                    boundary.outwardDirection()));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private GridArea blockedRoomCells(int levelZ) {
        LinkedHashSet<GridPoint> blocked = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null) {
                    blocked.addAll(cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).surface().cellFootprint().cells());
                }
            }
        }
        return blocked.isEmpty() ? GridArea.empty() : GridArea.of(blocked);
    }

    private boolean touchesAffectedRooms(Corridor corridor, Set<Long> affectedRoomIds) {
        if (corridor == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return false;
        }
        return corridor.connectedRoomIds().stream()
                .anyMatch(affectedRoomIds::contains);
    }

    private boolean touchesAffectedRooms(DungeonTransition transition, Set<Long> affectedRoomIds) {
        if (transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return false;
        }
        return transition.localConnection().endpoints().stream()
                .filter(Objects::nonNull)
                .filter(endpoint -> endpoint.type() == features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .anyMatch(affectedRoomIds::contains);
    }

    private void validateTransitionRewrite(DungeonMap rewrittenMap, Set<Long> affectedRoomIds) {
        if (rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (DungeonTransition transition : transitions) {
            if (touchesAffectedRooms(transition, affectedRoomIds)) {
                reboundTransitionLocalConnection(rewrittenMap, transition, affectedRoomIds, false);
            }
        }
    }

    private Map<Long, DungeonConnection> reboundTransitionConnections(
            DungeonMap rewrittenMap,
            Set<Long> affectedRoomIds
    ) {
        if (rewrittenMap == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, DungeonConnection> reboundConnectionsById = new LinkedHashMap<>();
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.transitionId() == null || !touchesAffectedRooms(transition, affectedRoomIds)) {
                continue;
            }
            DungeonConnection reboundConnection = reboundTransitionLocalConnection(
                    rewrittenMap,
                    transition,
                    affectedRoomIds,
                    true);
            if (!Objects.equals(reboundConnection, transition.localConnection())) {
                reboundConnectionsById.put(transition.transitionId(), reboundConnection);
            }
        }
        return reboundConnectionsById.isEmpty() ? Map.of() : Map.copyOf(reboundConnectionsById);
    }

    private DungeonConnection reboundTransitionLocalConnection(
            DungeonMap rewrittenMap,
            DungeonTransition transition,
            Set<Long> affectedRoomIds,
            boolean requirePersistedRoomId
    ) {
        if (rewrittenMap == null
                || transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return transition == null ? null : transition.localConnection();
        }
        DungeonConnection localConnection = transition.localConnection();
        if (localConnection.doorCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            Room reboundRoom = resolveTransitionDoorRoom(
                    rewrittenMap,
                    localConnection.levelZ(),
                    localConnection.doorRef(),
                    requirePersistedRoomId);
            DoorDescription reboundDoor = rewrittenMap.describeDoor(localConnection.doorRef());
            if (reboundDoor == null) {
                throw new IllegalArgumentException("Transition door no longer resolves to a canonical door");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new DoorConnectionCarrier(reboundDoor.ref()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        if (localConnection.stairCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            Room reboundRoom = rewrittenMap.roomWithFloorAtCell(stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
            if (reboundRoom == null) {
                throw new IllegalArgumentException("Transition stair anchor no longer resolves to a room floor");
            }
            if (requirePersistedRoomId && reboundRoom.roomId() == null) {
                throw new IllegalArgumentException("Transition stair rebound requires a persisted room id");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new StairConnectionCarrier(
                            stairCarrier.anchorCell(),
                            stairCarrier.anchorLevelZ(),
                            stairCarrier.stair()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        return localConnection;
    }

    private Room resolveTransitionDoorRoom(
            DungeonMap rewrittenMap,
            int levelZ,
            DoorRef doorRef,
            boolean requirePersistedRoomId
    ) {
        if (rewrittenMap == null || doorRef == null) {
            throw new IllegalArgumentException("Transition door rebound requires a canonical door");
        }
        DoorDescription reboundDoor = rewrittenMap.describeDoor(doorRef);
        if (reboundDoor == null || reboundDoor.levelZ() != levelZ || reboundDoor.role() != DoorRole.ROOM_EXTERIOR) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        Room reboundRoom = reboundDoor.touchingRooms().isEmpty() ? null : reboundDoor.touchingRooms().getFirst();
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        if (requirePersistedRoomId && reboundRoom.roomId() == null) {
            throw new IllegalArgumentException("Transition door rebound requires a persisted room id");
        }
        return reboundRoom;
    }

    /**
     * Corridor authored input resolves against the map that already owns room bindings and door context.
     */
    public Corridor resolveCorridor(CorridorInput input) {
        CorridorInput resolvedInput = Objects.requireNonNull(input, "input");
        return Corridor.fromInput(
                resolvedInput,
                corridorResolutionInput(resolvedInput.levelZ()));
    }

    public Corridor rehydrateCorridor(CorridorInput input, Structure structure) {
        CorridorInput resolvedInput = Objects.requireNonNull(input, "input");
        Structure resolvedStructure = Objects.requireNonNull(structure, "structure");
        return Corridor.rehydrated(
                resolvedInput,
                resolvedStructure,
                corridorResolutionInput(resolvedInput.levelZ()));
    }

    public DungeonMap withAddedCorridor(Corridor corridor) {
        if (corridor == null) {
            return this;
        }
        ArrayList<Corridor> updatedCorridors = new ArrayList<>(corridors);
        updatedCorridors.add(corridor);
        return withCorridors(updatedCorridors);
    }

    public DungeonMap withUpdatedCorridor(Corridor corridor) {
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

    public DungeonMap withRemovedCorridor(Long corridorId) {
        if (corridorId == null) {
            return this;
        }
        List<Corridor> updatedCorridors = corridors.stream()
                .filter(corridor -> corridor == null || !Objects.equals(corridor.corridorId(), corridorId))
                .toList();
        return updatedCorridors.size() == corridors.size() ? this : withCorridors(updatedCorridors);
    }

    public DungeonMap withAddedStair(DungeonStair stair) {
        if (stair == null) {
            return this;
        }
        ArrayList<DungeonStair> updatedStairs = new ArrayList<>(stairs);
        updatedStairs.add(stair);
        return withStairs(updatedStairs);
    }

    public DungeonMap withUpdatedStair(DungeonStair stair) {
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

    public DungeonMap withRemovedStair(Long stairId) {
        if (stairId == null) {
            return this;
        }
        List<DungeonStair> updatedStairs = stairs.stream()
                .filter(stair -> stair == null || !Objects.equals(stair.stairId(), stairId))
                .toList();
        return updatedStairs.size() == stairs.size() ? this : withStairs(updatedStairs);
    }

    public DungeonMap withAddedTransition(DungeonTransition transition) {
        if (transition == null) {
            return this;
        }
        ArrayList<DungeonTransition> updatedTransitions = new ArrayList<>(transitions);
        updatedTransitions.add(transition);
        return withTransitions(updatedTransitions);
    }

    public DungeonMap withUpdatedTransition(DungeonTransition transition) {
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

    public DungeonMap withRemovedTransition(Long transitionId) {
        if (transitionId == null) {
            return this;
        }
        List<DungeonTransition> updatedTransitions = transitions.stream()
                .filter(transition -> transition == null || !Objects.equals(transition.transitionId(), transitionId))
                .toList();
        return updatedTransitions.size() == transitions.size() ? this : withTransitions(updatedTransitions);
    }

    public DungeonMap withMovedCluster(Long clusterId, GridTranslation translation) {
        Cluster cluster = findCluster(clusterId);
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (clusterId == null || cluster == null || resolvedTranslation.isZero()) {
            return this;
        }
        ClusterRewritePlan plan = ClusterRewritePlan.of(
                List.of(cluster),
                List.of(cluster.translated(resolvedTranslation)),
                resolvedTranslation);
        DungeonMap movedLayout = withAppliedClusterRewrite(plan);
        return movedLayout.withAppliedClusterRewriteEffects(reconcileClusterRewrite(movedLayout, plan));
    }

    private DungeonMap withCorridors(List<Corridor> updatedCorridors) {
        return new DungeonMap(mapId, name, updatedCorridors, clusters, stairs, transitions, clusterLevelsById);
    }

    private DungeonMap withStairs(List<DungeonStair> updatedStairs) {
        return new DungeonMap(mapId, name, corridors, clusters, updatedStairs, transitions, clusterLevelsById);
    }

    private DungeonMap withTransitions(List<DungeonTransition> updatedTransitions) {
        return new DungeonMap(mapId, name, corridors, clusters, stairs, updatedTransitions, clusterLevelsById);
    }

    private DungeonMap withAppliedClusterRewriteEffects(ClusterRewriteEffects effects) {
        if (effects == null) {
            return this;
        }
        DungeonMap updatedMap = this;
        if (!effects.reboundCorridors().isEmpty()) {
            LinkedHashMap<Long, Corridor> corridorUpdatesById = effects.reboundCorridors().stream()
                    .filter(Objects::nonNull)
                    .filter(corridor -> corridor.corridorId() != null)
                    .collect(Collectors.toMap(
                            Corridor::corridorId,
                            corridor -> corridor,
                            (left, right) -> right,
                            LinkedHashMap::new));
            if (!corridorUpdatesById.isEmpty()) {
                List<Corridor> updatedCorridors = corridors.stream()
                        .map(corridor -> corridor == null || corridor.corridorId() == null
                                ? corridor
                                : corridorUpdatesById.getOrDefault(corridor.corridorId(), corridor))
                        .toList();
                updatedMap = updatedMap.withCorridors(updatedCorridors);
            }
        }
        if (!effects.reboundTransitionConnectionsById().isEmpty()) {
            Map<Long, DungeonConnection> transitionConnectionsById = effects.reboundTransitionConnectionsById();
            List<DungeonTransition> updatedTransitions = updatedMap.transitions.stream()
                    .map(transition -> transition == null || transition.transitionId() == null
                            ? transition
                            : transitionConnectionsById.containsKey(transition.transitionId())
                            ? transition.withLocalConnection(transitionConnectionsById.get(transition.transitionId()))
                            : transition)
                    .toList();
            updatedMap = updatedMap.withTransitions(updatedTransitions);
        }
        return updatedMap;
    }

    public DungeonMap projectedToLevel(int levelZ) {
        List<Cluster> projectedClusters = clusters.stream()
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
        return new DungeonMap(mapId, name, projectedCorridors, projectedClusters, projectedStairs, projectedTransitions, clusterLevelsById);
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
                && !corridor.surfaceAtLevel(levelZ).floor().cellFootprint().cells().isEmpty();
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        ArrayList<Cluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
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

    private static List<DoorEntry> indexDoorEntries(List<Cluster> clusters, List<Corridor> corridors) {
        Map<Long, DoorEntry> result = new LinkedHashMap<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Integer levelZ : cluster.levels()) {
                for (Door door : cluster.boundaryAtLevel(levelZ).doors()) {
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
            for (Door door : corridor.boundaryAtLevel(corridor.levelZ()).doors()) {
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
            for (GridSegment segment2x : doorEntry.door().boundary().segments()) {
                result.putIfAbsent(new ConnectionSegmentKey(doorEntry.description().levelZ(), segment2x), doorEntry);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Connection> indexConnections(
            List<Cluster> clusters,
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
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Connection connection : cluster.roomTopology().localConnections().stream()
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
        for (GridSegment segment2x : boundarySegments(connection, doorsById)) {
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
        for (GridSegment segment2x : boundarySegments(connection, doorsById)) {
            occupiedSegments.add(new ConnectionSegmentKey(connection.levelZ(), segment2x));
        }
    }

    private static Map<GridSegment, Connection> indexConnectionsBySegment2x(
            List<Connection> connections,
            Map<Long, Door> doorsById
    ) {
        Map<GridSegment, Connection> result = new LinkedHashMap<>();
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
            for (GridSegment segment2x : boundarySegments(connection, doorsById)) {
                result.putIfAbsent(new ConnectionSegmentKey(connection.levelZ(), segment2x), connection);
            }
        }
        return Map.copyOf(result);
    }

    private static Set<GridSegment> boundarySegments(Connection connection, Map<Long, Door> doorsById) {
        if (connection == null || connection.doorCarrier() == null) {
            return Set.of();
        }
        DoorRef ref = connection.doorRef();
        Door door = ref == null || doorsById == null ? null : doorsById.get(ref.doorId());
        if (door == null || !door.hasBoundarySegments()) {
            return Set.of();
        }
        return door.boundary().segments();
    }

    private static DoorEntry clusterDoorEntry(Cluster cluster, int levelZ, Door door) {
        if (cluster == null || door == null || !door.hasBoundarySegments() || door.doorId() == null || door.doorId() == 0L) {
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
        if (corridor == null || door == null || !door.hasBoundarySegments() || door.doorId() == null || door.doorId() == 0L) {
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

    private static List<Room> touchingRooms(Cluster cluster, int levelZ, Door door) {
        if (cluster == null || door == null || !door.hasBoundarySegments()) {
            return List.of();
        }
        LinkedHashSet<Room> rooms = new LinkedHashSet<>();
        for (GridPoint cell : door.cellFootprint().cells().stream().sorted(GridPoint.ORDER).toList()) {
            Room room = cluster.roomTopology().roomAt(cell, levelZ);
            if (room != null) {
                rooms.add(room);
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

    private static Map<Long, Cluster> indexClusters(List<Cluster> clusters) {
        Map<Long, Cluster> result = new LinkedHashMap<>();
        for (Cluster cluster : clusters) {
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

    private static boolean clusterContainsProjectedCell(Cluster cluster, GridPoint cell) {
        if (cluster == null || cell == null) {
            return false;
        }
        return cluster.levels().stream()
                .anyMatch(levelZ -> cluster.surfaceAtLevel(levelZ).surface().contains(cell));
    }

    private static Set<GridPoint> indexTraversableCells(
            List<Cluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        Set<GridPoint> result = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null) {
                    for (Integer levelZ : cluster.roomTopology().roomLevels(room)) {
                        result.addAll(cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellFootprint().cells());
                    }
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor != null) {
                // Traversable layout indexes must follow the explicit floor set even when a structure also owns
                // non-walkable surface cells.
                result.addAll(corridor.surfaceAtLevel(corridor.levelZ()).floor().cellFootprint().cells());
            }
        }
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                result.addAll(stair.cellFootprint().cells());
            }
        }
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.localConnection() == null || transition.localConnection().stairCarrier() == null) {
                continue;
            }
            result.addAll(transition.localConnection().stairCarrier().stair().cellFootprint().cells());
        }
        return Set.copyOf(result);
    }

    private static Map<Integer, Set<GridPoint>> indexTraversableCellsByLevel(
            List<Cluster> clusters,
            List<Corridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        Map<Integer, Set<GridPoint>> mutable = new LinkedHashMap<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                for (Integer levelZ : cluster.roomTopology().roomLevels(room)) {
                    mutable.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .addAll(cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellFootprint().cells());
                }
            }
        }
        for (Corridor corridor : corridors) {
            if (corridor == null) {
                continue;
            }
            mutable.computeIfAbsent(corridor.levelZ(), ignored -> new LinkedHashSet<>())
                    .addAll(corridor.surfaceAtLevel(corridor.levelZ()).floor().cellFootprint().cells());
        }
        for (DungeonStair stair : stairs) {
            if (stair != null) {
                for (GridPoint point : stair.cellFootprint().cells()) {
                    if (point != null) {
                        mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                                .add(point);
                    }
                }
            }
        }
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.localConnection() == null || transition.localConnection().stairCarrier() == null) {
                continue;
            }
            for (GridPoint point : transition.localConnection().stairCarrier().stair().gridPath().points()) {
                if (point != null) {
                    mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                            .add(point);
                }
            }
        }
        Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static List<Integer> indexReachableLevels(Map<Integer, Set<GridPoint>> traversableCellsByLevel) {
        return traversableCellsByLevel.keySet().stream()
                .sorted()
                .toList();
    }

    private static Map<GridPoint, List<Long>> indexCorridorIdsByCell(List<Corridor> corridors) {
        Map<GridPoint, List<Long>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (GridPoint cell : corridor.surfaceAtLevel(corridor.levelZ()).surface().cellFootprint().cells()) {
                mutable.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(corridor.corridorId());
            }
        }
        Map<GridPoint, List<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<GridPoint, List<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Map<Integer, Map<GridPoint, List<Long>>> indexCorridorIdsByLevelAndCell(List<Corridor> corridors) {
        Map<Integer, Map<GridPoint, List<Long>>> mutable = new LinkedHashMap<>();
        for (Corridor corridor : corridors) {
            if (corridor == null || corridor.corridorId() == null) {
                continue;
            }
            for (GridPoint cell : corridor.surfaceAtLevel(corridor.levelZ()).surface().cellFootprint().cells()) {
                mutable.computeIfAbsent(corridor.levelZ(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(cell, ignored -> new ArrayList<>())
                        .add(corridor.corridorId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private static Map<Integer, Map<GridPoint, List<Long>>> indexStairIdsByLevelAndCell(List<DungeonStair> stairs) {
        Map<Integer, Map<GridPoint, List<Long>>> mutable = new LinkedHashMap<>();
        for (DungeonStair stair : stairs) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            for (GridPoint point : stair.cellFootprint().cells()) {
                if (point == null) {
                    continue;
                }
                mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(point, ignored -> new ArrayList<>())
                        .add(stair.stairId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private Map<Integer, Map<GridPoint, List<Long>>> indexTransitionIdsByLevelAndCell() {
        Map<Integer, Map<GridPoint, List<Long>>> mutable = new LinkedHashMap<>();
        for (DungeonTransition transition : transitions) {
            if (transition == null || transition.transitionId() == null || !transition.isPlaced()) {
                continue;
            }
            for (GridPoint point : transition.localConnection().cellFootprint(this).cells()) {
                if (point == null) {
                    continue;
                }
                mutable.computeIfAbsent(point.z(), ignored -> new LinkedHashMap<>())
                        .computeIfAbsent(point, ignored -> new ArrayList<>())
                        .add(transition.transitionId());
            }
        }
        return immutableIdIndex(mutable);
    }

    private static <T> List<T> structuresAtCell(
            Map<Integer, Map<GridPoint, List<Long>>> idsByLevelAndCell,
            GridPoint cell,
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

    private static Map<Integer, Map<GridPoint, List<Long>>> immutableIdIndex(
            Map<Integer, Map<GridPoint, List<Long>>> mutable
    ) {
        Map<Integer, Map<GridPoint, List<Long>>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Map<GridPoint, List<Long>>> levelEntry : mutable.entrySet()) {
            Map<GridPoint, List<Long>> perCell = new LinkedHashMap<>();
            for (Map.Entry<GridPoint, List<Long>> entry : levelEntry.getValue().entrySet()) {
                perCell.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            result.put(levelEntry.getKey(), Map.copyOf(perCell));
        }
        return Map.copyOf(result);
    }

    private static int cellX(GridPoint point) {
        return point.x2() / 2;
    }

    private static int cellY(GridPoint point) {
        return point.y2() / 2;
    }

    private record ConnectionSegmentKey(int levelZ, GridSegment segment2x) {
    }

    private record DoorEntry(DoorRef ref, Door door, DoorDescription description) {
    }
}
