package features.world.dungeonmap.cluster.model;

import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.StructureMutation;
import features.world.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeonmap.structure.model.boundary.wall.WallKind;
import features.world.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class RoomCluster {

    private final Long clusterId;
    private final Long structureObjectId;
    private final long mapId;
    private final GridPoint center;
    private final Structure structure;

    public RoomCluster(
            Long clusterId,
            long mapId,
            GridPoint center,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, Structure.empty(), requireExplicitStructure(rooms));
    }

    public RoomCluster(
            Long clusterId,
            long mapId,
            GridPoint center,
            Structure structure,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, structure, rooms);
    }

    public RoomCluster(
            Long clusterId,
            Long structureObjectId,
            long mapId,
            GridPoint center,
            Structure structure,
            List<Room> rooms
    ) {
        this.clusterId = clusterId;
        this.structureObjectId = structureObjectId;
        this.mapId = mapId;
        this.center = center == null ? new GridPoint(0, 0) : center;
        this.structure = normalizeClusterStructure(structure, rooms).withRoomMetadata(mapId, clusterId, rooms);
    }

    public Long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public Long structureObjectId() {
        return structureObjectId;
    }

    public GridPoint center() {
        return center;
    }

    public Structure structure() {
        return structure;
    }

    public RoomCluster projectedToLevel(int levelZ) {
        Structure projectedStructure = structure.projectedToLevel(levelZ);
        StructureRoomTopology projectedTopology = projectedStructure.roomTopology();
        if (projectedStructure == null || projectedStructure.levels().isEmpty() || projectedTopology.rooms().isEmpty()) {
            return null;
        }
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center,
                projectedStructure,
                projectedTopology.rooms());
    }

    public RoomCluster createWallPath(int levelZ, Collection<GridSegment> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, false);
    }

    public RoomCluster deleteWallPath(int levelZ, Collection<GridSegment> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, true);
    }

    public RoomCluster moveDoor(int levelZ, GridSegment sourceBoundarySegment2x, GridSegment targetBoundarySegment2x) {
        // Door movement stays cluster-owned so SELECT drag and write workflows reuse the same local boundary rules.
        return Topology.moveDoor(this, levelZ, sourceBoundarySegment2x, targetBoundarySegment2x);
    }

    public boolean canCreateDoor(int levelZ, GridSegment boundarySegment2x) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        if (boundarySegment2x == null
                || boundary.doorAtBoundarySegment(boundarySegment2x) != null) {
            return false;
        }
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment2x);
        if (!boundary.boundaryEdges().contains(boundarySegment2x)
                || effectiveWall == null
                || !effectiveWall.supportsDoorAttachments()
                || !boundary.isInteriorBoundary(boundarySegment2x)) {
            return false;
        }
        RoomPair roomPair = roomPairAtLevel(this, boundarySegment2x, levelZ);
        return roomPair != null
                && roomPair.left() != null
                && roomPair.right() != null
                && roomPair.left().roomId() != null
                && roomPair.right().roomId() != null
                && !roomPair.left().roomId().equals(roomPair.right().roomId());
    }

    public boolean canDeleteDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.isInteriorBoundary(boundarySegment2x)
                && boundary.doorAtBoundarySegment(boundarySegment2x) != null;
    }

    public boolean canCreateExteriorDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment2x);
        return boundarySegment2x != null
                && boundary.boundaryEdges().contains(boundarySegment2x)
                && boundary.doorAtBoundarySegment(boundarySegment2x) == null
                && effectiveWall != null
                && effectiveWall.supportsDoorAttachments()
                && boundary.isExteriorBoundary(boundarySegment2x);
    }

    public boolean canDeleteExteriorDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.doorAtBoundarySegment(boundarySegment2x) != null
                && boundary.isExteriorBoundary(boundarySegment2x);
    }

    public RoomCluster withDoorSegments(int levelZ, Collection<GridSegment> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, false);
    }

    public RoomCluster withExteriorDoors(int levelZ, Collection<GridSegment> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, true);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.ClusterRef(clusterId),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                GridPoint.cell(center));
    }

    public boolean overlapsCells(Collection<GridPoint> candidateCells) {
        Set<GridPoint> clusterCells = Topology.projectedSurfaceCells(structure);
        if (candidateCells == null || candidateCells.isEmpty() || clusterCells.isEmpty()) {
            return false;
        }
        for (GridPoint cell : candidateCells) {
            if (cell != null && clusterCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public RoomCluster movedBy(GridPoint delta) {
        return movedBy(delta, 0);
    }

    public RoomCluster movedBy(GridPoint delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        Structure movedStructure = structure.mutated(new StructureMutation.Translation(resolvedDelta, levelDelta));
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center.add(resolvedDelta),
                movedStructure,
                movedStructure.roomTopology().rooms());
    }

    public BoundaryPath findCreateWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment> route = structure.boundaryAtLevel(levelZ).findCreatableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public BoundaryPath findDeleteWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment> route = structure.boundaryAtLevel(levelZ).findDeletableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(GridPoint vertex) {
        return structure.boundaryAtLevel(primaryLevel()).touchesBoundaryVertex(vertex);
    }

    public boolean isEditableWallVertex(GridPoint vertex, boolean deleteMode) {
        return structure.boundaryAtLevel(primaryLevel()).isEditableWallVertex(vertex, deleteMode);
    }

    public int primaryLevel() {
        return structure.levels().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Set<GridSegment> outerBoundarySegments2x() {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            result.addAll(structure.boundaryAtLevel(levelZ).exteriorBoundaryEdges());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(GridPoint cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
    }

    private StructureRoomTopology roomTopology() {
        return structure.roomTopology();
    }

    private List<Room> rooms() {
        return roomTopology().rooms();
    }

    private Structure roomStructure(Room room) {
        return roomTopology().structureFor(room);
    }

    private Set<Integer> roomLevels(Room room) {
        return roomTopology().roomLevels(room);
    }

    private Room roomAt(GridPoint cell) {
        return cell == null ? null : roomAt(cell, primaryLevel());
    }

    private Room roomAt(GridPoint cell, int levelZ) {
        return cell == null ? null : roomTopology().roomAt(cell, levelZ);
    }

    private static List<Room> requireExplicitStructure(List<Room> rooms) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        if (!resolvedRooms.isEmpty()) {
            throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
        }
        return resolvedRooms;
    }

    private static RoomPair roomPairAtLevel(RoomCluster cluster, GridSegment segment2x, int levelZ) {
        if (cluster == null || segment2x == null) {
            return null;
        }
        List<GridPoint> touchingCells = segment2x.touchingCells().stream()
                .sorted(GridPoint.ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Room left = cluster.roomAt(touchingCells.getFirst(), levelZ);
        Room right = cluster.roomAt(touchingCells.getLast(), levelZ);
        return left == null || right == null ? null : new RoomPair(left, right);
    }

    private record RoomPair(Room left, Room right) {
    }

    private static Structure normalizeClusterStructure(Structure structure, List<Room> rooms) {
        if (structure != null && !structure.levels().isEmpty()) {
            return structure;
        }
        if (rooms == null || rooms.isEmpty()) {
            return Structure.empty();
        }
        throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
    }

    private static final class Topology {

        private Topology() {
        }

        static RoomCluster editWallPath(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean deleteWall
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<GridSegment> editedSegments = segments2x.stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> cluster.structure().boundaryAtLevel(levelZ).interiorAdjacencyEdges().contains(segment2x))
                    .filter(segment2x -> {
                        RoomPair roomPair = roomPairAtLevel(cluster, segment2x, levelZ);
                        return roomPair != null && !sameRoomId(roomPair.left(), roomPair.right());
                    })
                    .sorted(GridSegment.ORDER)
                    .toList();
            if (editedSegments.isEmpty()) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.WallPathEdit(
                    levelZ,
                    editedSegments,
                    deleteWall ? StructureMutation.BoundaryEditMode.DELETE : StructureMutation.BoundaryEditMode.CREATE));
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    cluster.center(),
                    updatedStructure,
                    cluster.rooms());
        }

        static RoomCluster editDoors(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean deleteDoor,
                boolean exteriorDoor
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<GridSegment> editableSegments = deleteDoor
                    ? deletedEditableSegments(cluster, levelZ, segments2x, exteriorDoor)
                    : createdEditableSegments(cluster, levelZ, segments2x, exteriorDoor);
            if (editableSegments.isEmpty()) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.DoorSegmentsEdit(
                    levelZ,
                    editableSegments,
                    deleteDoor ? StructureMutation.BoundaryEditMode.DELETE : StructureMutation.BoundaryEditMode.CREATE));
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    cluster.center(),
                    updatedStructure,
                    cluster.rooms());
        }

        static RoomCluster moveDoor(
                RoomCluster cluster,
                int levelZ,
                GridSegment sourceBoundarySegment2x,
                GridSegment targetBoundarySegment2x
        ) {
            if (cluster == null
                    || sourceBoundarySegment2x == null
                    || targetBoundarySegment2x == null
                    || Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)
                    || !cluster.canDeleteDoor(levelZ, sourceBoundarySegment2x)
                    || !cluster.canCreateDoor(levelZ, targetBoundarySegment2x)) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.DoorMove(
                    levelZ,
                    sourceBoundarySegment2x,
                    targetBoundarySegment2x));
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    cluster.center(),
                    updatedStructure,
                    cluster.rooms());
        }

        private static boolean sameRoomId(Room left, Room right) {
            return left != null
                    && right != null
                    && left.roomId() != null
                    && left.roomId().equals(right.roomId());
        }

        private static Set<GridPoint> projectedSurfaceCells(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                result.addAll(structure.surfaceAtLevel(levelZ).surface().cellCoords());
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static List<GridSegment> createdEditableSegments(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean exteriorDoor
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canCreateExteriorDoor(levelZ, segment2x)
                            : cluster.canCreateDoor(levelZ, segment2x))
                    .toList();
        }

        private static List<GridSegment> deletedEditableSegments(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean exteriorDoor
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canDeleteExteriorDoor(levelZ, segment2x)
                            : cluster.canDeleteDoor(levelZ, segment2x))
                    .toList();
        }
    }

    public record BoundaryPath(
            List<GridSegment> routeEdges,
            Set<GridSegment> committedEdges
    ) {
        public BoundaryPath {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }

        public static BoundaryPath empty() {
            return new BoundaryPath(List.of(), Set.of());
        }

        public boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }
}
