package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

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
            boolean deleteBoundary
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
        RoomTopologyWorkCatalog.IdAllocation ids = WORK_CATALOG.newIdAllocation(topology, rooms);
        List<DungeonRoom> rebuiltRooms = edit.partitionEditedRooms(target, ids);
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
