package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

public final class RoomClusterBoundaryMutation {

    private static final RoomClusterBoundaryEdit BOUNDARY_EDIT = new RoomClusterBoundaryEdit();
    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomTopologyRebuilder REBUILDER = new RoomTopologyRebuilder();

    public Optional<RebuildResult> editBoundaries(
            SpatialTopology topology,
            RoomCatalog rooms,
            List<Corridor> corridors,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary,
            RoomTopologyWorkCatalog.ReservedIdentities ids
    ) {
        if (invalidBoundaryEditRequest(clusterId, edges)) {
            return Optional.empty();
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_CATALOG.workClusters(topology, rooms);
        DungeonRoomTopologyClusterWork target = null;
        for (DungeonRoomTopologyClusterWork work : clusters) {
            if (work != null && work.cluster().clusterId() == clusterId) {
                target = work;
                break;
            }
        }
        if (target == null) {
            return Optional.empty();
        }
        RoomClusterBoundaryEdit.BoundaryEditResult edit =
                BOUNDARY_EDIT.editBoundaries(corridors, target, edges, kind, deleteBoundary);
        if (!edit.changed()) {
            return Optional.empty();
        }
        List<RoomRegion> rebuiltRooms = edit.partitionEditedRooms(target, ids);
        ids.validateAllocatedRooms(rebuiltRooms);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == clusterId
                    ? new DungeonRoomTopologyClusterWork(
                    edit.rebuiltEditedCluster(target),
                    rebuiltRooms,
                    target.cellsByLevel())
                    : work);
        }
        return Optional.of(REBUILDER.rebuiltPreservingRooms(topology, nextClusters));
    }

    private boolean invalidBoundaryEditRequest(long clusterId, List<Edge> edges) {
        return clusterId <= 0L || edges == null || edges.isEmpty();
    }
}
