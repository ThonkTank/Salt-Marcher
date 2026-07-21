package features.dungeon.domain.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.component.boundary.BoundaryKind;

/**
 * Projection state for room boundary read facts supplied by core structure
 * owners.
 */
final class DungeonRoomBoundaryProjectionState {

    private static final String DOOR_KIND = "door";

    private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
    private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
    private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
    private final Set<DungeonBoundaryKey> seenBoundaries = new LinkedHashSet<>();
    private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey = new LinkedHashMap<>();
    private long nextBoundaryId = 1_000L;

    void addAuthoredBoundaries(RoomCluster cluster, Map<Long, List<Cell>> roomCells) {
        for (BoundarySegment boundary : cluster.orderedAuthoredBoundaries()) {
            addBoundary(cluster, boundary, roomCells);
        }
    }

    void addPerimeterBoundaries(
            RoomCluster cluster,
            List<RoomRegion> clusterRooms,
            Map<Long, List<Cell>> roomCells
    ) {
        for (RoomRegion room : clusterRooms) {
            for (Cell cell : roomCells.getOrDefault(room.roomId(), List.of())) {
                addCellPerimeter(cluster, roomCells, cell);
            }
        }
    }

    DungeonBoundaryProjection toProjection() {
        return new DungeonBoundaryProjection(
                boundaries,
                containment,
                connections,
                boundaryIdsByKey,
                nextBoundaryId);
    }

    private void addCellPerimeter(
            RoomCluster cluster,
            Map<Long, List<Cell>> roomCells,
            Cell cell
    ) {
        for (Direction direction : Direction.values()) {
            Cell neighbor = direction.neighborOf(cell);
            if (DungeonRoomBoundaryTouchSupport.containsAnyRoomCell(roomCells, neighbor)) {
                continue;
            }
            addBoundary(cluster, perimeterBoundary(cluster, cell, direction), roomCells);
        }
    }

    private static BoundarySegment perimeterBoundary(
            RoomCluster cluster,
            Cell cell,
            Direction direction
    ) {
        return new BoundarySegment(
                features.dungeon.domain.core.geometry.EdgeKey.from(direction.edgeOf(cell)),
                BoundaryKind.WALL);
    }

    private void addBoundary(
            RoomCluster cluster,
            BoundarySegment boundary,
            Map<Long, List<Cell>> roomCells
    ) {
        Edge edge = boundary.edge();
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        if (!seenBoundaries.add(key)) {
            return;
        }
        if (boundary.isOpen()) {
            return;
        }
        long boundaryId = key.stableId();
        nextBoundaryId = Math.max(nextBoundaryId, boundaryId + 1L);
        String kind = boundary.kind().name().toLowerCase(java.util.Locale.ROOT);
        String label = boundary.kind() == BoundaryKind.DOOR ? "Door" : "Wall";
        DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef();
        boundaries.add(new DungeonBoundaryFacts(kind, boundaryId, label, edge, topologyRef));
        boundaryIdsByKey.put(key, boundaryId);

        List<Long> touchingRoomIds = DungeonRoomBoundaryTouchSupport.touchingRoomIds(edge, roomCells);
        for (Long roomId : touchingRoomIds) {
            containment.add(new DungeonRelationGraph.ContainmentRelation(roomId, boundaryId, kind));
        }
        if (boundary.kind() == BoundaryKind.DOOR && touchingRoomIds.size() >= 2) {
            connections.add(new DungeonRelationGraph.ConnectionRelation(
                    touchingRoomIds.getFirst(),
                    touchingRoomIds.get(1),
                    DOOR_KIND));
        }
    }
}
