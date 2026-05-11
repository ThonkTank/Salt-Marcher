package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonBoundaryKey;
import src.domain.dungeon.model.map.model.DungeonClusterBoundary;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchSelection;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonRoomTopologyClusterWork;

final class DungeonBoundaryStretchEditLogic {

    private static final DungeonClusterBoundaryGeometryLogic GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryLogic();
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
        DungeonRoomTopologyClusterWork target = null;
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (work != null && work.cluster().clusterId() == clusterId) {
                target = work;
                break;
            }
        }
        if (target == null) {
            return dungeonMap;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = GEOMETRY_SERVICE.boundaryMap(target.cluster());
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
        Optional<StretchMutationResult> mutation = stretch.get().outer()
                ? MUTATION_SERVICE.applyOuterStretch(dungeonMap, target, stretch.get(), boundaries)
                : MUTATION_SERVICE.applyInnerStretch(dungeonMap, target, stretch.get(), boundaries);
        if (mutation.isEmpty()) {
            return dungeonMap;
        }
        return rebuiltStretch(dungeonMap, clusters, target, stretch.get(), mutation.get());
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
