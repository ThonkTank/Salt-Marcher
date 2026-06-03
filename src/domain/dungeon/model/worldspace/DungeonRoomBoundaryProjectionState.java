package src.domain.dungeon.model.worldspace;


import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonRoomBoundaryProjectionState {

    private static final String DOOR_KIND = "door";

    private final List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
    private final List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
    private final List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
    private final Set<DungeonBoundaryKey> seenBoundaries = new LinkedHashSet<>();
    private final Map<DungeonBoundaryKey, Long> boundaryIdsByKey = new LinkedHashMap<>();
    private long nextBoundaryId = 1_000L;

    void addAuthoredBoundaries(DungeonRoomCluster cluster, Map<Long, List<DungeonCell>> roomCells) {
        for (List<DungeonClusterBoundary> levelBoundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : levelBoundaries) {
                addBoundary(cluster, boundary, roomCells);
            }
        }
    }

    void addPerimeterBoundaries(
            DungeonRoomCluster cluster,
            List<DungeonRoom> clusterRooms,
            Map<Long, List<DungeonCell>> roomCells
    ) {
        for (DungeonRoom room : clusterRooms) {
            for (DungeonCell cell : roomCells.getOrDefault(room.roomId(), List.of())) {
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
            Map<Long, List<DungeonCell>> roomCells,
            DungeonCell cell
    ) {
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            DungeonCell neighbor = direction.neighborOf(cell);
            if (DungeonRoomBoundaryTouchSupport.containsAnyRoomCell(roomCells, neighbor)) {
                continue;
            }
            addBoundary(cluster, perimeterBoundary(cluster, cell, direction), roomCells);
        }
    }

    private static DungeonClusterBoundary perimeterBoundary(
            DungeonRoomCluster cluster,
            DungeonCell cell,
            DungeonEdgeDirection direction
    ) {
        return new DungeonClusterBoundary(
                cluster.clusterId(),
                cell.level(),
                new DungeonCell(
                        cell.q() - cluster.center().q(),
                        cell.r() - cluster.center().r(),
                        cell.level()),
                direction,
                DungeonClusterBoundaryKind.WALL);
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
        if (boundary.isOpen()) {
            return;
        }
        long boundaryId = key.stableId();
        nextBoundaryId = Math.max(nextBoundaryId, boundaryId + 1L);
        String kind = boundary.kind().boundaryKind();
        String label = boundary.kind() == DungeonClusterBoundaryKind.DOOR ? "Door" : "Wall";
        DungeonTopologyRef topologyRef = boundary.resolvedTopologyRef(cluster.center());
        boundaries.add(new DungeonBoundaryFacts(kind, boundaryId, label, edge, topologyRef));
        boundaryIdsByKey.put(key, boundaryId);

        List<Long> touchingRoomIds = DungeonRoomBoundaryTouchSupport.touchingRoomIds(edge, roomCells);
        for (Long roomId : touchingRoomIds) {
            containment.add(new DungeonRelationGraph.ContainmentRelation(roomId, boundaryId, kind));
        }
        if (boundary.kind() == DungeonClusterBoundaryKind.DOOR && touchingRoomIds.size() >= 2) {
            connections.add(new DungeonRelationGraph.ConnectionRelation(
                    touchingRoomIds.getFirst(),
                    touchingRoomIds.get(1),
                    DOOR_KIND));
        }
    }
}
