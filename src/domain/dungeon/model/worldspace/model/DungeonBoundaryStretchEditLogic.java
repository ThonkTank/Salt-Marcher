package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.model.worldspace.model.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchEditLogic {

    private static final DungeonRoomBoundaryPartitionLogic PARTITION_SERVICE =
            new DungeonRoomBoundaryPartitionLogic();
    private static final DungeonBoundaryStretchSelectionLogic SELECTION_SERVICE =
            new DungeonBoundaryStretchSelectionLogic();
    private static final DungeonBoundaryStretchMutationLogic MUTATION_SERVICE =
            new DungeonBoundaryStretchMutationLogic();
    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();
    private static final DungeonRoomClusterRebuildLogic REBUILD_SERVICE = new DungeonRoomClusterRebuildLogic();

    DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (invalidStretchRequest(clusterId, sourceEdges)) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        DungeonRoomTopologyClusterWork target = targetCluster(clusters, clusterId);
        if (target == null) {
            return dungeonMap;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries =
                DungeonClusterBoundaryOrdering.boundaryMap(target.cluster());
        Optional<StretchSelection> stretch = SELECTION_SERVICE.resolveStretch(
                target,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel,
                boundaries);
        if (stretch.isEmpty() || stretch.get().stationary()) {
            return dungeonMap;
        }
        Optional<StretchMutationResult> mutation = applyStretchMutation(dungeonMap, target, stretch.get(), boundaries);
        if (mutation.isEmpty()) {
            return dungeonMap;
        }
        return rebuiltStretch(dungeonMap, clusters, target, stretch.get(), mutation.get());
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
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        return stretch.outer()
                ? MUTATION_SERVICE.applyOuterStretch(dungeonMap, target, stretch, boundaries)
                : MUTATION_SERVICE.applyInnerStretch(dungeonMap, target, stretch, boundaries);
    }

    private DungeonMap rebuiltStretch(
            DungeonMap dungeonMap,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            StretchMutationResult mutation
    ) {
        DungeonRoomClusterWorkLogic.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
        DungeonRoomTopologyClusterWork partitionWork =
                new DungeonRoomTopologyClusterWork(target.cluster(), target.rooms(), mutation.cellsByLevel());
        List<DungeonRoom> rooms = PARTITION_SERVICE.roomsForBoundaryEdit(partitionWork, mutation.boundariesByLevel(), ids);
        DungeonRoomTopologyClusterWork rebuiltWork = stretch.outer()
                ? new DungeonRoomTopologyClusterWork(
                REBUILD_SERVICE.clusterForStretch(partitionWork, mutation.boundariesByLevel()),
                rooms,
                mutation.cellsByLevel())
                : new DungeonRoomTopologyClusterWork(
                REBUILD_SERVICE.clusterWithBoundaries(target, mutation.boundariesByLevel()),
                rooms,
                mutation.cellsByLevel());
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId() ? rebuiltWork : work);
        }
        return REBUILD_SERVICE.rebuiltPreservingRooms(dungeonMap, nextClusters);
    }

    private boolean invalidStretchRequest(long clusterId, List<DungeonEdge> sourceEdges) {
        return clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty();
    }
}
