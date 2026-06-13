package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

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

    void addAuthoredBoundaries(DungeonRoomCluster cluster, Map<Long, List<Cell>> roomCells) {
        for (DungeonClusterBoundary boundary : cluster.orderedAuthoredBoundaries()) {
            addBoundary(cluster, boundary, roomCells);
        }
    }

    void addPerimeterBoundaries(
            DungeonRoomCluster cluster,
            List<DungeonRoom> clusterRooms,
            Map<Long, List<Cell>> roomCells
    ) {
        for (DungeonRoom room : clusterRooms) {
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
            DungeonRoomCluster cluster,
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

    private static DungeonClusterBoundary perimeterBoundary(
            DungeonRoomCluster cluster,
            Cell cell,
            Direction direction
    ) {
        return new DungeonClusterBoundary(
                cluster.clusterId(),
                cell.level(),
                new Cell(
                        cell.q() - cluster.center().q(),
                        cell.r() - cluster.center().r(),
                        cell.level()),
                direction,
                BoundaryKind.WALL);
    }

    private void addBoundary(
            DungeonRoomCluster cluster,
            DungeonClusterBoundary boundary,
            Map<Long, List<Cell>> roomCells
    ) {
        Edge edge = boundary.absoluteEdge(cluster.center());
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        if (!seenBoundaries.add(key)) {
            return;
        }
        if (boundary.isOpen()) {
            return;
        }
        long boundaryId = key.stableId();
        nextBoundaryId = Math.max(nextBoundaryId, boundaryId + 1L);
        String kind = boundary.kind().boundaryKind();
        String label = boundary.kind() == BoundaryKind.DOOR ? "Door" : "Wall";
        DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef(cluster.center());
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
