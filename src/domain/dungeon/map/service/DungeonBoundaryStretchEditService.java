package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.map.value.DungeonBoundaryStretchValueTypes.StretchSelection;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonBoundaryStretchEditService {

    private static final DungeonClusterBoundaryGeometryService GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryService();
    private static final DungeonRoomBoundaryPartitionService PARTITION_SERVICE =
            new DungeonRoomBoundaryPartitionService();
    private static final DungeonBoundaryStretchSelectionService SELECTION_SERVICE =
            new DungeonBoundaryStretchSelectionService();
    private static final DungeonBoundaryStretchMutationService MUTATION_SERVICE =
            new DungeonBoundaryStretchMutationService();
    private static final DungeonRoomClusterWorkService WORK_SERVICE = new DungeonRoomClusterWorkService();
    private static final DungeonRoomClusterRebuildService REBUILD_SERVICE = new DungeonRoomClusterRebuildService();

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
        DungeonRoomTopologyClusterWork target = clusters.stream()
                .filter(work -> work.cluster().clusterId() == clusterId)
                .findFirst()
                .orElse(null);
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
        DungeonRoomClusterWorkService.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
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
