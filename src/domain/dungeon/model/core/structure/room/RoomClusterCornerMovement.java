package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

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
            int deltaLevel
    ) {
        if (corner == null || deltaLevel != 0 || clusterId <= NO_ID) {
            return Optional.empty();
        }
        return moveResolvedCorner(topology, rooms, corridors, clusterId, corner, deltaQ, deltaR);
    }

    private Optional<RebuildResult> moveResolvedCorner(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaQ,
            int deltaR
    ) {
        Optional<RebuildResult> horizontalFirst = moveHorizontalFirst(
                topology,
                rooms,
                corridors,
                clusterId,
                corner,
                deltaQ,
                deltaR);
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
                deltaR);
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
            int deltaR
    ) {
        Optional<RebuildResult> vertical = moveVertical(topology, rooms, corridors, clusterId, corner, deltaQ);
        if (deltaQ != 0 && vertical.isEmpty()) {
            return Optional.empty();
        }
        RebuildResult afterVertical = vertical.orElse(new RebuildResult(topology, rooms));
        Optional<RebuildResult> horizontal = moveHorizontal(
                afterVertical,
                corridors,
                clusterId,
                new Cell(corner.q() + deltaQ, corner.r(), corner.level()),
                deltaR);
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
            int deltaR
    ) {
        RebuildResult current = new RebuildResult(topology, rooms);
        Optional<RebuildResult> horizontal = moveHorizontal(current, corridors, clusterId, corner, deltaR);
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
                deltaQ);
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
            int deltaQ
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
                0);
    }

    private Optional<RebuildResult> moveHorizontal(
            RebuildResult current,
            List<Corridor> corridors,
            long clusterId,
            Cell corner,
            int deltaR
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
                0);
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
