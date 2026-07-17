package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomBoundaryStretchValues.StretchMutationResult;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryStretchPlan.Selection;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

public final class RoomClusterBoundaryStretchMutation {

    private static final RoomBoundaryStretchMutationStep MUTATION =
            new RoomBoundaryStretchMutationStep();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomPartitionPreservingMutation ROOM_MUTATION = new RoomPartitionPreservingMutation();

    public Optional<RebuildResult> moveBoundaryStretch(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (invalidStretchRequest(clusterId, sourceEdges)) {
            return Optional.empty();
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_CATALOG.workClusters(topology, rooms);
        Optional<DungeonRoomTopologyClusterWork> target = WORK_CATALOG.workCluster(topology, rooms, clusterId);
        if (target.isEmpty()) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = target.get().cluster().boundaryMap();
        Optional<Selection> stretch = target.get().boundaryStretchSelection(sourceEdges, deltaQ, deltaR, deltaLevel);
        if (stretch.isEmpty() || stretch.get().movement() == 0) {
            return Optional.empty();
        }
        Optional<StretchMutationResult> mutation = applyStretchMutation(corridors, target.get(), stretch.get(), boundaries);
        if (mutation.isEmpty()) {
            return Optional.empty();
        }
        return rebuiltStretch(topology, rooms, clusters, target.get(), mutation.get());
    }

    private Optional<StretchMutationResult> applyStretchMutation(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            Selection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        return stretch.outer()
                ? MUTATION.applyOuterStretch(corridors, target, stretch, boundaries)
                : MUTATION.applyInnerStretch(corridors, target, stretch, boundaries);
    }

    private Optional<RebuildResult> rebuiltStretch(
            SpatialTopology topology,
            RoomCatalog roomCatalog,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            StretchMutationResult mutation
    ) {
        RoomTopologyWorkCatalog.IdAllocation ids = WORK_CATALOG.newIdAllocation(topology, roomCatalog);
        return ROOM_MUTATION.stretchCluster(
                topology,
                clusters,
                target,
                mutation.cellsByLevel(),
                mutation.boundariesByLevel(),
                ids);
    }

    private boolean invalidStretchRequest(long clusterId, List<Edge> sourceEdges) {
        return clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty();
    }
}
