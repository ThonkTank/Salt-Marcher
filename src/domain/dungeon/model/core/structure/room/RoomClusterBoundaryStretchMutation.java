package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomBoundaryStretchValues.StretchMutationResult;
import src.domain.dungeon.model.core.structure.room.RoomBoundaryStretchValues.StretchSelection;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class RoomClusterBoundaryStretchMutation {

    private static final DungeonRoomBoundaryPartition BOUNDARY_PARTITION =
            new DungeonRoomBoundaryPartition();
    private static final RoomBoundaryStretchSelection SELECTION =
            new RoomBoundaryStretchSelection();
    private static final RoomBoundaryStretchMutationStep MUTATION =
            new RoomBoundaryStretchMutationStep();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomTopologyRebuilder REBUILDER = new RoomTopologyRebuilder();

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
        DungeonRoomTopologyClusterWork target = targetCluster(clusters, clusterId);
        if (target == null) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = target.cluster().boundaryMap();
        Optional<StretchSelection> stretch = SELECTION.resolveStretch(
                target,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel,
                boundaries);
        if (stretch.isEmpty() || stretch.get().movement() == 0) {
            return Optional.empty();
        }
        Optional<StretchMutationResult> mutation = applyStretchMutation(corridors, target, stretch.get(), boundaries);
        if (mutation.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(rebuiltStretch(topology, rooms, clusters, target, stretch.get(), mutation.get()));
    }

    private @Nullable DungeonRoomTopologyClusterWork targetCluster(
            List<DungeonRoomTopologyClusterWork> clusters,
            long clusterId
    ) {
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (work != null && work.cluster().clusterId() == clusterId) {
                return work;
            }
        }
        return null;
    }

    private Optional<StretchMutationResult> applyStretchMutation(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        return stretch.outer()
                ? MUTATION.applyOuterStretch(corridors, target, stretch, boundaries)
                : MUTATION.applyInnerStretch(corridors, target, stretch, boundaries);
    }

    private RebuildResult rebuiltStretch(
            SpatialTopology topology,
            RoomCatalog roomCatalog,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            StretchMutationResult mutation
    ) {
        RoomTopologyWorkCatalog.IdAllocation ids = WORK_CATALOG.newIdAllocation(topology, roomCatalog);
        DungeonRoomTopologyClusterWork partitionWork =
                new DungeonRoomTopologyClusterWork(target.cluster(), target.rooms(), mutation.cellsByLevel());
        List<DungeonRoom> rooms = BOUNDARY_PARTITION.roomsForBoundaryEdit(partitionWork, mutation.boundariesByLevel(), ids);
        DungeonRoomTopologyClusterWork rebuiltWork = stretch.outer()
                ? new DungeonRoomTopologyClusterWork(
                REBUILDER.clusterForStretch(partitionWork, mutation.boundariesByLevel()),
                rooms,
                mutation.cellsByLevel())
                : new DungeonRoomTopologyClusterWork(
                REBUILDER.clusterWithBoundaries(target, mutation.boundariesByLevel()),
                rooms,
                mutation.cellsByLevel());
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId() ? rebuiltWork : work);
        }
        return REBUILDER.rebuiltPreservingRooms(topology, nextClusters);
    }

    private boolean invalidStretchRequest(long clusterId, List<Edge> sourceEdges) {
        return clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty();
    }
}
