package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterCollection;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

public final class DungeonRoomTopologyEditor {

    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();
    private static final DungeonRoomClusterRebuildLogic REBUILD_SERVICE = new DungeonRoomClusterRebuildLogic();
    private static final DungeonClusterBoundaryEditLogic BOUNDARY_EDIT_SERVICE =
            new DungeonClusterBoundaryEditLogic();
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();

    public DungeonMap paintRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(target);
        RoomClusterCollection nextCoreClusters = WORK_SERVICE.coreClusters(clusters).paintRectangle(
                start,
                end,
                target.metadata().mapId().value(),
                WORK_SERVICE.newCoreIdAllocation(target));
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_SERVICE.fromCoreClusters(nextCoreClusters, clusters);
        return REBUILD_SERVICE.rebuilt(target, nextClusters);
    }

    public DungeonMap deleteRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(target);
        RoomClusterCollection nextCoreClusters = WORK_SERVICE.coreClusters(clusters).deleteRectangle(
                start,
                end,
                WORK_SERVICE.newCoreIdAllocation(target));
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_SERVICE.fromCoreClusters(nextCoreClusters, clusters);
        return REBUILD_SERVICE.rebuilt(target, nextClusters);
    }

    public DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        return BOUNDARY_EDIT_SERVICE.editBoundaries(requireDungeonMap(dungeonMap), clusterId, edges, kind, deleteBoundary);
    }

    public DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return STRETCH_EDIT_SERVICE.moveBoundaryStretch(
                requireDungeonMap(dungeonMap),
                clusterId,
                sourceEdges,
                deltaQ,
                deltaR,
                deltaLevel);
    }

    private DungeonMap requireDungeonMap(DungeonMap dungeonMap) {
        return Objects.requireNonNull(dungeonMap, "dungeonMap");
    }
}
