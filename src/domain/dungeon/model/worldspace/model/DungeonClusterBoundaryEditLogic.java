package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonClusterBoundaryEditLogic {

    private static final DungeonClusterBoundaryDoorRules DOOR_RULES =
            new DungeonClusterBoundaryDoorRules();
    private static final DungeonClusterBoundaryGeometryLogic GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryLogic();
    private static final DungeonRoomBoundaryPartitionLogic PARTITION_SERVICE =
            new DungeonRoomBoundaryPartitionLogic();
    private static final DungeonRoomClusterWorkLogic WORK_SERVICE = new DungeonRoomClusterWorkLogic();
    private static final DungeonRoomClusterRebuildLogic REBUILD_SERVICE = new DungeonRoomClusterRebuildLogic();
    private static final DungeonRoomCellProjection CELL_PROJECTOR = new DungeonRoomCellProjection();

    DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        if (invalidBoundaryEditRequest(clusterId, edges)) {
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
        BoundaryEditResult edit = editBoundaries(dungeonMap, target, edges, kind, deleteBoundary);
        if (!edit.changed()) {
            return dungeonMap;
        }
        DungeonRoomClusterWorkLogic.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
        List<DungeonRoom> rooms = PARTITION_SERVICE.roomsForBoundaryEdit(target, edit.boundariesByLevel(), ids);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == clusterId
                    ? new DungeonRoomTopologyClusterWork(
                    REBUILD_SERVICE.clusterWithBoundaries(target, edit.boundariesByLevel()),
                    rooms,
                    target.cellsByLevel())
                    : work);
        }
        return REBUILD_SERVICE.rebuiltPreservingRooms(dungeonMap, nextClusters);
    }

    private BoundaryEditResult editBoundaries(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        DungeonClusterBoundaryKind resolvedKind = kind == null ? DungeonClusterBoundaryKind.WALL : kind;
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries =
                DungeonClusterBoundaryOrdering.boundaryMap(target.cluster());
        Map<Long, List<DungeonCell>> roomCells = CELL_PROJECTOR.cellsByRoom(target.cluster(), target.rooms());
        boolean changed = false;
        for (DungeonEdge edge : edges) {
            DungeonClusterBoundary candidate = GEOMETRY_SERVICE.boundaryForEdge(
                    edge == null || edge.from() == null ? Set.of() : Set.copyOf(target.cellsAt(edge.from().level())),
                    target.cluster().center(),
                    target.cluster().clusterId(),
                    edge,
                    resolvedKind,
                    null);
            if (candidate == null) {
                continue;
            }
            DungeonBoundaryKey key = DungeonBoundaryKey.from(candidate.absoluteEdge(target.cluster().center()));
            DungeonClusterBoundary existing = boundaries.get(key);
            changed = deleteBoundary
                    ? DOOR_RULES.removeBoundaryIfAllowed(dungeonMap, target, boundaries, resolvedKind, key, existing)
                    || changed
                    : DOOR_RULES.upsertBoundaryIfAllowed(roomCells, boundaries, resolvedKind, edge, key, existing, candidate)
                    || changed;
        }
        return new BoundaryEditResult(DungeonClusterBoundaryOrdering.boundariesByLevel(boundaries.values()), changed);
    }

    private boolean invalidBoundaryEditRequest(long clusterId, List<DungeonEdge> edges) {
        return clusterId <= 0L || edges == null || edges.isEmpty();
    }

    private record BoundaryEditResult(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            boolean changed
    ) {
        private BoundaryEditResult {
            boundariesByLevel = boundariesByLevel == null ? Map.of() : Map.copyOf(boundariesByLevel);
        }
    }
}
