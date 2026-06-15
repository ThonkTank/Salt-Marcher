package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

public final class RoomTopologyRebuilder {
    public RebuildResult rebuiltPreservingRooms(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : sortedByClusterId(workClusters)) {
            if (work.allCells().isEmpty() || work.rooms().isEmpty()) {
                continue;
            }
            clusters.add(work.cluster());
            rooms.addAll(work.rooms());
        }
        return new RebuildResult(safeTopology(topology).withRoomClusters(clusters), new RoomCatalog(rooms));
    }

    public DungeonRoomCluster clusterWithBoundaries(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        DungeonRoomTopologyClusterWork safeWork = Objects.requireNonNull(work, "work");
        return safeWork.rebuiltClusterWithBoundaries(RoomPerimeterBoundaryMaterialization.fromFloorCells(
                safeWork.cluster(),
                safeWork.allCells(),
                boundariesByLevel));
    }

    public DungeonRoomCluster clusterForStretch(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return Objects.requireNonNull(work, "work").rebuiltClusterWithBoundaries(boundariesByLevel);
    }

    private static SpatialTopology safeTopology(SpatialTopology topology) {
        return topology == null ? SpatialTopology.empty() : topology;
    }

    private static List<DungeonRoomTopologyClusterWork> sortedByClusterId(
            List<DungeonRoomTopologyClusterWork> workClusters
    ) {
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : workClusters == null
                ? List.<DungeonRoomTopologyClusterWork>of()
                : workClusters) {
            if (work != null && work.cluster() != null) {
                result.add(work);
            }
        }
        result.sort(RoomTopologyRebuilder::compareClusterWork);
        return result;
    }

    private static int compareClusterWork(DungeonRoomTopologyClusterWork left, DungeonRoomTopologyClusterWork right) {
        return Long.compare(left.cluster().clusterId(), right.cluster().clusterId());
    }

    public record RebuildResult(
            SpatialTopology topology,
            RoomCatalog rooms
    ) {
        public RebuildResult {
            topology = safeTopology(topology);
            rooms = rooms == null ? RoomCatalog.empty() : rooms;
        }
    }
}
