package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

public final class RoomClusterCornerMovement {

    private static final long NO_ID = 0L;
    private static final RoomClusterBoundaryStretchMutation STRETCH_MUTATION =
            new RoomClusterBoundaryStretchMutation();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();

    public Optional<RebuildResult> moveCorner(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            RoomTopologyWorkCatalog.ReservedIdentities allocation
    ) {
        if (corner == null || deltaLevel != 0 || clusterId <= NO_ID) {
            return Optional.empty();
        }
        return moveResolvedCorner(
                topology,
                rooms,
                corridors,
                clusterId,
                corner,
                deltaQ,
                deltaR,
                new RoomMutationIdCursor(allocation));
    }

    private Optional<RebuildResult> moveResolvedCorner(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            RoomMutationIdCursor ids
    ) {
        Optional<RebuildResult> horizontalFirst = moveHorizontalFirst(
                topology,
                rooms,
                corridors,
                clusterId,
                corner,
                deltaQ,
                deltaR,
                ids);
        Cell targetCorner = new Cell(corner.q() + deltaQ, corner.r() + deltaR, corner.level());
        if (containsCorner(horizontalFirst, clusterId, targetCorner)) {
            return horizontalFirst;
        }
        Optional<RebuildResult> verticalFirst = moveVerticalFirst(
                topology,
                rooms,
                corridors,
                clusterId,
                corner,
                deltaQ,
                deltaR,
                ids);
        if (containsCorner(verticalFirst, clusterId, targetCorner)) {
            return verticalFirst;
        }
        if (verticalFirst.isPresent()) {
            return verticalFirst;
        }
        return horizontalFirst;
    }

    private Optional<RebuildResult> moveVerticalFirst(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            RoomMutationIdCursor ids
    ) {
        Optional<RebuildResult> vertical = moveVertical(topology, rooms, corridors, clusterId, corner, deltaQ, ids);
        if (deltaQ != 0 && vertical.isEmpty()) {
            return Optional.empty();
        }
        RebuildResult afterVertical = vertical.orElse(new RebuildResult(topology, rooms));
        Optional<RebuildResult> horizontal = moveHorizontal(
                afterVertical,
                corridors,
                clusterId,
                new Cell(corner.q() + deltaQ, corner.r(), corner.level()),
                deltaR,
                ids);
        if (deltaR != 0 && horizontal.isEmpty()) {
            return Optional.empty();
        }
        return horizontal.isPresent() ? horizontal : vertical;
    }

    private Optional<RebuildResult> moveHorizontalFirst(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR,
            RoomMutationIdCursor ids
    ) {
        RebuildResult current = new RebuildResult(topology, rooms);
        Optional<RebuildResult> horizontal = moveHorizontal(current, corridors, clusterId, corner, deltaR, ids);
        if (deltaR != 0 && horizontal.isEmpty()) {
            return Optional.empty();
        }
        RebuildResult afterHorizontal = horizontal.orElse(current);
        Optional<RebuildResult> vertical = moveVertical(
                afterHorizontal.topology(),
                afterHorizontal.rooms(),
                corridors,
                clusterId,
                new Cell(corner.q(), corner.r() + deltaR, corner.level()),
                deltaQ,
                ids);
        if (deltaQ != 0 && vertical.isEmpty()) {
            return Optional.empty();
        }
        return vertical.isPresent() ? vertical : horizontal;
    }

    private Optional<RebuildResult> moveVertical(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            RoomMutationIdCursor ids
    ) {
        if (deltaQ == 0) {
            return Optional.empty();
        }
        return STRETCH_MUTATION.moveBoundaryStretch(
                topology,
                rooms,
                corridors,
                clusterId,
                sideEdges(topology, rooms, clusterId, corner, true),
                deltaQ,
                0,
                0,
                ids);
    }

    private Optional<RebuildResult> moveHorizontal(
            RebuildResult current,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaR,
            RoomMutationIdCursor ids
    ) {
        if (deltaR == 0) {
            return Optional.empty();
        }
        return STRETCH_MUTATION.moveBoundaryStretch(
                current.topology(),
                current.rooms(),
                corridors,
                clusterId,
                sideEdges(current.topology(), current.rooms(), clusterId, corner, false),
                0,
                deltaR,
                0,
                ids);
    }

    private static List<Edge> sideEdges(
            SpatialTopology topology,
            RoomCatalog rooms,
            long clusterId,
            Cell corner,
            boolean vertical
    ) {
        if (corner == null) {
            return List.of();
        }
        List<Edge> result = new ArrayList<>();
        WORK_CATALOG.workCluster(topology, rooms, clusterId)
                .map(target -> RoomClusterCornerSideEdges.adjacentWallRunEdges(
                        target.cluster(),
                        corner,
                        vertical))
                .ifPresent(edges -> appendEdges(result, edges));
        return List.copyOf(result);
    }

    private static void appendEdges(List<Edge> result, List<Edge> edges) {
        for (Edge edge : edges) {
            result.add(new Edge(
                    edge.from(),
                    edge.to()));
        }
    }

    private static boolean containsCorner(Optional<RebuildResult> result, long clusterId, Cell corner) {
        return result.flatMap(rebuild -> WORK_CATALOG.workCluster(rebuild.topology(), rebuild.rooms(), clusterId))
                .map(work -> work.cluster().authoredBoundaryVertices(corner.level()).contains(corner))
                .orElse(false);
    }
}
