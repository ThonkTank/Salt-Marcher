package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.DungeonRoomTopologyClusterWork;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;
import src.domain.dungeon.model.core.structure.room.RoomClusterCollection;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder;
import src.domain.dungeon.model.core.structure.room.RoomTopologyRebuilder.RebuildResult;
import src.domain.dungeon.model.core.structure.room.RoomTopologyWorkCatalog;

public final class DungeonRoomTopologyEditor {

    private static final RoomTopologyWorkCatalog WORK_CATALOG = new RoomTopologyWorkCatalog();
    private static final RoomTopologyRebuilder REBUILDER = new RoomTopologyRebuilder();
    private static final DungeonClusterBoundaryEditLogic BOUNDARY_EDIT_SERVICE =
            new DungeonClusterBoundaryEditLogic();
    private static final DungeonBoundaryStretchEditLogic STRETCH_EDIT_SERVICE =
            new DungeonBoundaryStretchEditLogic();

    public DungeonMap paintRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_CATALOG.workClusters(target.topology(), target.rooms());
        RoomClusterCollection nextCoreClusters = WORK_CATALOG.coreClusters(clusters).paintRectangle(
                start,
                end,
                target.metadata().mapId().value(),
                WORK_CATALOG.newIdAllocation(target.topology(), target.rooms()).toCore());
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_CATALOG.fromCoreClusters(nextCoreClusters, clusters);
        return withRoomTopology(target, REBUILDER.rebuilt(target.topology(), nextClusters));
    }

    public DungeonMap deleteRectangle(DungeonMap dungeonMap, Cell start, Cell end) {
        DungeonMap target = requireDungeonMap(dungeonMap);
        if (start == null || end == null) {
            return target;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_CATALOG.workClusters(target.topology(), target.rooms());
        RoomClusterCollection nextCoreClusters = WORK_CATALOG.coreClusters(clusters).deleteRectangle(
                start,
                end,
                WORK_CATALOG.newIdAllocation(target.topology(), target.rooms()).toCore());
        List<DungeonRoomTopologyClusterWork> nextClusters = WORK_CATALOG.fromCoreClusters(nextCoreClusters, clusters);
        return withRoomTopology(target, REBUILDER.rebuilt(target.topology(), nextClusters));
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

    static DungeonMap withRoomTopology(DungeonMap dungeonMap, RebuildResult rebuild) {
        return new DungeonMap(
                dungeonMap.metadata(),
                rebuild.topology(),
                rebuild.rooms(),
                dungeonMap.corridors(),
                dungeonMap.stairs(),
                dungeonMap.transitionCatalog(),
                dungeonMap.revision() + 1L);
    }
}
