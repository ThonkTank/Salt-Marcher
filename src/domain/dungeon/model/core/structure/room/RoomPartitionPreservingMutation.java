package src.domain.dungeon.model.core.structure.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.room.RoomTopologyWorkCatalog.IdAllocation;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

final class RoomPartitionPreservingMutation {

    private static final int CONNECTED_CLUSTER_COMPONENT_LIMIT = 1;
    private static final RoomTopologyRebuilder REBUILDER = new RoomTopologyRebuilder();
    private static final RoomPartitionedWorkBuilder WORK_BUILDER =
            new RoomPartitionedWorkBuilder(REBUILDER);
    private static final RoomPartitionPreservingPaint PAINT =
            new RoomPartitionPreservingPaint(REBUILDER, WORK_BUILDER);
    private static final RoomPartitionPreservingDelete DELETE =
            new RoomPartitionPreservingDelete(REBUILDER, WORK_BUILDER);

    Optional<RebuildResult> paintRectangle(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> clusters,
            Cell start,
            Cell end,
            long mapId,
            IdAllocation allocation
    ) {
        return PAINT.paintRectangle(topology, clusters, start, end, mapId, allocation);
    }

    Optional<RebuildResult> deleteRectangle(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> clusters,
            Cell start,
            Cell end,
            IdAllocation allocation
    ) {
        return DELETE.deleteRectangle(topology, clusters, start, end, allocation);
    }

    Optional<RebuildResult> stretchCluster(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            Map<Integer, List<Cell>> nextCellsByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            IdAllocation allocation
    ) {
        if (target == null || unsupportedClusterSplit(nextCellsByLevel)) {
            return Optional.empty();
        }
        RoomMutationIdCursor ids = new RoomMutationIdCursor(allocation);
        DungeonRoomTopologyClusterWork partitioned = WORK_BUILDER.stretchPartitionedWork(
                target,
                nextCellsByLevel,
                boundariesByLevel,
                ids,
                RoomMutationRoomCoverage.previousCellsByRoom(List.of(target)));
        if (partitioned.allCells().isEmpty() || partitioned.rooms().isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(REBUILDER.rebuiltPreservingRooms(
                topology,
                RoomMutationWorkSets.replaceAffectedWith(
                        clusters,
                        Set.of(target.cluster().clusterId()),
                        partitioned)));
    }

    private static boolean unsupportedClusterSplit(Map<Integer, List<Cell>> cellsByLevel) {
        for (List<Cell> cells : cellsByLevel == null ? List.<List<Cell>>of() : cellsByLevel.values()) {
            if (RoomClusterCells.connectedComponents(new LinkedHashSet<>(cells == null ? List.of() : cells)).size()
                    > CONNECTED_CLUSTER_COMPONENT_LIMIT) {
                return true;
            }
        }
        return false;
    }
}
