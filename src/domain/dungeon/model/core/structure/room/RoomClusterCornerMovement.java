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
        Optional<RebuildResult> vertical = moveVertical(topology, rooms, corridors, clusterId, corner, deltaQ);
        RebuildResult afterVertical = vertical.orElse(new RebuildResult(topology, rooms));
        Optional<RebuildResult> horizontal = moveHorizontal(
                afterVertical,
                corridors,
                clusterId,
                new Cell(corner.q() + deltaQ, corner.r(), corner.level()),
                deltaR);
        return horizontal.isPresent() ? horizontal : vertical;
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
                .map(target -> target.cluster().toCore(target.cellsByLevel()).boundingSideEdges(corner, vertical))
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
}
