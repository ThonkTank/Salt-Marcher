package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * Explicitly partial authored facts clipped to requested chunks. Variants carry
 * enough semantic truth for an application projector without becoming domain
 * entities or render/hit models.
 */
public sealed interface DungeonWindowEntityFragment permits DungeonWindowEntityFragment.Room,
        DungeonWindowEntityFragment.RoomCluster,
        DungeonWindowEntityFragment.Corridor,
        DungeonWindowEntityFragment.Stair,
        DungeonWindowEntityFragment.Transition,
        DungeonWindowEntityFragment.FeatureMarker {

    DungeonPatchEntityRef entityRef();

    List<DungeonChunkKey> intersectingRequestedChunks();

    List<DungeonPatchEntityRef> dependencyHeaders();

    record Room(
            DungeonPatchEntityRef entityRef,
            long clusterId,
            String name,
            String visualDescription,
            List<Cell> floorCells,
            List<RoomExitFact> exitDescriptions,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public Room {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.ROOM);
            name = requiredText(name, "room name");
            visualDescription = cleanText(visualDescription);
            floorCells = orderedCells(floorCells);
            exitDescriptions = ordered(exitDescriptions, RoomExitFact.ORDER);
            requireSpatialFacts(floorCells, exitDescriptions);
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record RoomCluster(
            DungeonPatchEntityRef entityRef,
            String name,
            List<ClusterMemberCellFact> memberCells,
            List<ClusterBoundaryFact> boundaries,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public RoomCluster {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.ROOM_CLUSTER);
            name = requiredText(name, "cluster name");
            memberCells = ordered(memberCells, ClusterMemberCellFact.ORDER);
            boundaries = ordered(boundaries, ClusterBoundaryFact.ORDER);
            requireSpatialFacts(memberCells, boundaries);
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record Corridor(
            DungeonPatchEntityRef entityRef,
            int level,
            List<Long> roomIds,
            List<CorridorWaypointFact> waypoints,
            List<CorridorDoorFact> doorBindings,
            List<CorridorAnchorFact> anchorBindings,
            List<CorridorAnchorRefFact> anchorRefs,
            List<CorridorRouteCellFact> routeCells,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public Corridor {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.CORRIDOR);
            roomIds = orderedIds(roomIds);
            waypoints = ordered(waypoints, Comparator.comparingInt(CorridorWaypointFact::sortOrder));
            doorBindings = ordered(doorBindings, Comparator.comparingInt(CorridorDoorFact::sortOrder));
            anchorBindings = ordered(anchorBindings, Comparator.comparingInt(CorridorAnchorFact::sortOrder));
            anchorRefs = ordered(anchorRefs, Comparator.comparingInt(CorridorAnchorRefFact::sortOrder));
            routeCells = ordered(routeCells, CorridorRouteCellFact.ORDER);
            requireSpatialFacts(waypoints, doorBindings, anchorBindings, anchorRefs, routeCells);
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record Stair(
            DungeonPatchEntityRef entityRef,
            String name,
            StairShape shape,
            Direction direction,
            int dimension1,
            int dimension2,
            @Nullable Long corridorId,
            List<StairPathFact> path,
            List<StairExitFact> exits,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public Stair {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.STAIR);
            name = requiredText(name, "stair name");
            shape = Objects.requireNonNull(shape, "shape");
            direction = Objects.requireNonNull(direction, "direction");
            path = ordered(path, Comparator.comparingInt(StairPathFact::sortOrder));
            exits = ordered(exits, StairExitFact.ORDER);
            requireSpatialFacts(path, exits);
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record Transition(
            DungeonPatchEntityRef entityRef,
            String description,
            TransitionAnchor anchor,
            TransitionDestination destination,
            @Nullable Long linkedTransitionId,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public Transition {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.TRANSITION);
            description = cleanText(description);
            anchor = Objects.requireNonNull(anchor, "anchor");
            destination = Objects.requireNonNull(destination, "destination");
            if (!anchor.isPlaced()) {
                throw new IllegalArgumentException("a window transition must have a clipped anchor");
            }
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record FeatureMarker(
            DungeonPatchEntityRef entityRef,
            FeatureMarkerKind kind,
            Cell anchor,
            String label,
            String description,
            List<DungeonChunkKey> intersectingRequestedChunks,
            List<DungeonPatchEntityRef> dependencyHeaders
    ) implements DungeonWindowEntityFragment {
        public FeatureMarker {
            requireKind(entityRef, DungeonPatchEntityRef.Kind.FEATURE_MARKER);
            kind = Objects.requireNonNull(kind, "kind");
            anchor = Objects.requireNonNull(anchor, "anchor");
            label = requiredText(label, "marker label");
            description = cleanText(description);
            intersectingRequestedChunks = chunks(intersectingRequestedChunks);
            dependencyHeaders = dependencies(dependencyHeaders);
        }
    }

    record RoomExitFact(Cell cell, Direction direction, String description) {
        private static final Comparator<RoomExitFact> ORDER = Comparator
                .comparing(RoomExitFact::cell, DungeonWindowEntityFragment::compareCells)
                .thenComparing(RoomExitFact::direction);

        public RoomExitFact {
            cell = Objects.requireNonNull(cell, "cell");
            direction = Objects.requireNonNull(direction, "direction");
            description = cleanText(description);
        }
    }

    record ClusterMemberCellFact(long roomId, String roomName, Cell cell) {
        private static final Comparator<ClusterMemberCellFact> ORDER = Comparator
                .comparing(ClusterMemberCellFact::cell, DungeonWindowEntityFragment::compareCells)
                .thenComparingLong(ClusterMemberCellFact::roomId);

        public ClusterMemberCellFact {
            roomName = requiredText(roomName, "member room name");
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record ClusterBoundaryFact(
            Cell cell,
            Direction direction,
            BoundaryKind kind,
            DungeonTopologyRef topologyRef
    ) {
        private static final Comparator<ClusterBoundaryFact> ORDER = Comparator
                .comparing(ClusterBoundaryFact::cell, DungeonWindowEntityFragment::compareCells)
                .thenComparing(ClusterBoundaryFact::direction);

        public ClusterBoundaryFact {
            cell = Objects.requireNonNull(cell, "cell");
            direction = Objects.requireNonNull(direction, "direction");
            kind = Objects.requireNonNull(kind, "kind");
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    record CorridorWaypointFact(
            int sortOrder,
            long clusterId,
            Cell relativeCell,
            Cell absoluteCell
    ) {
        public CorridorWaypointFact {
            relativeCell = Objects.requireNonNull(relativeCell, "relativeCell");
            absoluteCell = Objects.requireNonNull(absoluteCell, "absoluteCell");
        }
    }

    record CorridorDoorFact(
            int sortOrder,
            long roomId,
            long clusterId,
            Cell relativeCell,
            Cell absoluteCell,
            Direction direction,
            DungeonTopologyRef topologyRef
    ) {
        public CorridorDoorFact {
            relativeCell = Objects.requireNonNull(relativeCell, "relativeCell");
            absoluteCell = Objects.requireNonNull(absoluteCell, "absoluteCell");
            direction = Objects.requireNonNull(direction, "direction");
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    record CorridorAnchorFact(
            int sortOrder,
            long anchorId,
            long hostCorridorId,
            Cell cell,
            DungeonTopologyRef topologyRef
    ) {
        public CorridorAnchorFact {
            cell = Objects.requireNonNull(cell, "cell");
            topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        }
    }

    record CorridorAnchorRefFact(
            int sortOrder,
            long hostCorridorId,
            long anchorId,
            Cell resolvedCell,
            DungeonTopologyRef topologyRef
    ) {
        public CorridorAnchorRefFact {
            resolvedCell = Objects.requireNonNull(resolvedCell, "resolvedCell");
            topologyRef = Objects.requireNonNull(topologyRef, "topologyRef");
        }
    }

    record CorridorRouteCellFact(int segmentOrder, int cellOrder, Cell cell) {
        private static final Comparator<CorridorRouteCellFact> ORDER = Comparator
                .comparingInt(CorridorRouteCellFact::segmentOrder)
                .thenComparingInt(CorridorRouteCellFact::cellOrder)
                .thenComparing(CorridorRouteCellFact::cell, DungeonWindowEntityFragment::compareCells);

        public CorridorRouteCellFact {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record StairPathFact(int sortOrder, Cell cell) {
        public StairPathFact {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    record StairExitFact(long exitId, Cell cell, String label) {
        private static final Comparator<StairExitFact> ORDER = Comparator
                .comparing(StairExitFact::cell, DungeonWindowEntityFragment::compareCells)
                .thenComparingLong(StairExitFact::exitId);

        public StairExitFact {
            cell = Objects.requireNonNull(cell, "cell");
            label = requiredText(label, "stair exit label");
        }
    }

    enum BoundaryKind {
        WALL,
        DOOR,
        OPEN
    }

    private static void requireKind(DungeonPatchEntityRef ref, DungeonPatchEntityRef.Kind kind) {
        if (ref == null || ref.kind() != kind) {
            throw new IllegalArgumentException("fragment identity kind must be " + kind);
        }
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }

    private static String cleanText(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<Cell> orderedCells(List<Cell> values) {
        return ordered(values, DungeonWindowEntityFragment::compareCells);
    }

    private static List<Long> orderedIds(List<Long> values) {
        List<Long> result = new ArrayList<>();
        for (Long value : values == null ? List.<Long>of() : values) {
            if (value != null && value > 0L) {
                result.add(value);
            }
        }
        result.sort(Long::compareTo);
        return List.copyOf(new LinkedHashSet<>(result));
    }

    private static <T> List<T> ordered(List<T> values, Comparator<T> order) {
        List<T> result = new ArrayList<>(values == null ? List.of() : values);
        result.sort(order);
        return List.copyOf(new LinkedHashSet<>(result));
    }

    private static List<DungeonChunkKey> chunks(List<DungeonChunkKey> values) {
        List<DungeonChunkKey> result = new ArrayList<>(new LinkedHashSet<>(
                values == null ? List.of() : values));
        result.sort(DungeonWindowRequest.CHUNK_ORDER);
        if (result.isEmpty()) {
            throw new IllegalArgumentException("a window fragment must intersect a requested chunk");
        }
        return List.copyOf(result);
    }

    private static List<DungeonPatchEntityRef> dependencies(List<DungeonPatchEntityRef> values) {
        List<DungeonPatchEntityRef> result = new ArrayList<>(new LinkedHashSet<>(
                values == null ? List.of() : values));
        result.sort(DungeonWindow.ENTITY_ORDER);
        return List.copyOf(result);
    }

    private static void requireSpatialFacts(List<?>... factLists) {
        for (List<?> facts : factLists) {
            if (facts != null && !facts.isEmpty()) {
                return;
            }
        }
        throw new IllegalArgumentException("a window fragment must contain clipped spatial facts");
    }

    private static int compareCells(Cell left, Cell right) {
        int level = Integer.compare(left.level(), right.level());
        if (level != 0) {
            return level;
        }
        int row = Integer.compare(left.r(), right.r());
        return row != 0 ? row : Integer.compare(left.q(), right.q());
    }
}
