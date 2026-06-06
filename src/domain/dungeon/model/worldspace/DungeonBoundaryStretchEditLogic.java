package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.DungeonClusterBoundary;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomBoundaryPartition;
import src.domain.dungeon.model.core.structure.room.DungeonRoomTopologyClusterWork;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder;
import src.domain.dungeon.model.core.structure.room.RoomTopologyWorkCatalog;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchMutationResult;
import src.domain.dungeon.model.worldspace.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchEditLogic {

    private static final DungeonRoomBoundaryPartition BOUNDARY_PARTITION =
            new DungeonRoomBoundaryPartition();
    private static final DungeonBoundaryStretchSelectionLogic SELECTION_SERVICE =
            new DungeonBoundaryStretchSelectionLogic();
    private static final DungeonBoundaryStretchMutationLogic MUTATION_SERVICE =
            new DungeonBoundaryStretchMutationLogic();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomTopologyRebuilder REBUILDER = new RoomTopologyRebuilder();

    DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (invalidStretchRequest(clusterId, sourceEdges)) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_CATALOG.workClusters(dungeonMap.topology(), dungeonMap.rooms());
        DungeonRoomTopologyClusterWork target = targetCluster(clusters, clusterId);
        if (target == null) {
            return dungeonMap;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = target.cluster().boundaryMap();
        Optional<StretchSelection> stretch = SELECTION_SERVICE.resolveStretch(
                target,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel,
                boundaries);
        if (stretch.isEmpty() || stretch.get().movement() == 0) {
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
        RoomTopologyWorkCatalog.IdAllocation ids = WORK_CATALOG.newIdAllocation(dungeonMap.topology(), dungeonMap.rooms());
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
        return DungeonRoomTopologyEditor.withRoomTopology(
                dungeonMap,
                REBUILDER.rebuiltPreservingRooms(dungeonMap.topology(), nextClusters));
    }

    private boolean invalidStretchRequest(long clusterId, List<Edge> sourceEdges) {
        return clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty();
    }
}
