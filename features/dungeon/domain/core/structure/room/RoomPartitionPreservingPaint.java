package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog.ReservedIdentities;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

final class RoomPartitionPreservingPaint {

    private final RoomTopologyRebuilder rebuilder;
    private final RoomPartitionedWorkBuilder workBuilder;

    RoomPartitionPreservingPaint(RoomTopologyRebuilder rebuilder, RoomPartitionedWorkBuilder workBuilder) {
        this.rebuilder = rebuilder;
        this.workBuilder = workBuilder;
    }

    Optional<RebuildResult> paintRectangle(
            SpatialTopology topology,
            List<DungeonRoomTopologyClusterWork> clusters,
            Cell start,
            Cell end,
            long mapId,
            ReservedIdentities allocation
    ) {
        Set<Cell> paintedCells = RoomClusterCells.rectangle(start, end);
        if (paintedCells.isEmpty()) {
            return Optional.empty();
        }
        List<DungeonRoomTopologyClusterWork> affected =
                RoomMutationWorkSets.affectedClustersAtLevel(clusters, start.level(), paintedCells);
        RoomMutationIdCursor ids = new RoomMutationIdCursor(allocation);
        if (affected.isEmpty()) {
            DungeonRoomTopologyClusterWork created =
                    RoomMutationClusterCreation.newClusterWork(
                            ids.reserveClusterId(),
                            ids.reserveRoomId(),
                            mapId,
                            paintedCells);
            return Optional.of(rebuilder.rebuiltPreservingRooms(
                    topology,
                    RoomMutationWorkSets.appendCluster(clusters, created)));
        }
        return Optional.of(rebuilder.rebuiltPreservingRooms(topology, paintedClusters(
                clusters,
                affected,
                paintedCells,
                start,
                ids)));
    }

    private List<DungeonRoomTopologyClusterWork> paintedClusters(
            List<DungeonRoomTopologyClusterWork> clusters,
            List<DungeonRoomTopologyClusterWork> affected,
            Set<Cell> paintedCells,
            Cell start,
            RoomMutationIdCursor ids
    ) {
        DungeonRoomTopologyClusterWork target = RoomMutationWorkSets.firstByClusterId(affected);
        Map<Integer, List<Cell>> mergedCellsByLevel =
                RoomMutationWorkSets.mergedCellsByLevel(target, affected, paintedCells, start.level());
        DungeonRoomTopologyClusterWork rehomed = workBuilder.rehomedWork(target, mergedCellsByLevel, affected);
        DungeonRoomTopologyClusterWork partitioned = workBuilder.partitionedWork(
                rehomed,
                mergedCellsByLevel,
                workBuilder.preservedBoundariesFor(target.cluster(), affected, mergedCellsByLevel),
                ids,
                RoomMutationRoomCoverage.previousCellsByRoom(affected));
        return RoomMutationWorkSets.replaceAffectedWith(
                clusters,
                RoomMutationWorkSets.clusterIds(affected),
                partitioned);
    }
}
