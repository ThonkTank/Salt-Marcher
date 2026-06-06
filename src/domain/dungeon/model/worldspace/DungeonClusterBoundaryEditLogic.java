package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

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
            List<Edge> edges,
            BoundaryKind kind,
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
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        BoundaryKind resolvedKind = kind == null ? BoundaryKind.WALL : kind;
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries =
                DungeonClusterBoundaryOrdering.boundaryMap(target.cluster());
        Map<Long, List<Cell>> roomCells = CELL_PROJECTOR.cellsByRoom(target.cluster(), target.rooms());
        boolean changed = false;
        for (Edge edge : edges) {
            if (deleteBoundary) {
                changed = removeExistingBoundaryIfAllowed(dungeonMap, target, boundaries, resolvedKind, edge)
                        || changed;
                continue;
            }
            DungeonClusterBoundary candidate = GEOMETRY_SERVICE.boundaryForEdge(
                    edge == null ? Set.of() : Set.copyOf(target.cellsAt(edge.from().level())),
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
            changed = DOOR_RULES.upsertBoundaryIfAllowed(
                    roomCells,
                    boundaries,
                    resolvedKind,
                    edge,
                    key,
                    existing,
                    candidate)
                    || changed;
        }
        return new BoundaryEditResult(DungeonClusterBoundaryOrdering.boundariesByLevel(boundaries.values()), changed);
    }

    private boolean removeExistingBoundaryIfAllowed(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryKind resolvedKind,
            Edge edge
    ) {
        if (!validBoundaryEdge(edge)) {
            return false;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        return resolvedKind == BoundaryKind.WALL
                ? deleteWallBoundary(target, boundaries, edge, key, existing)
                : deleteDoorBoundary(dungeonMap, target, boundaries, resolvedKind, key, existing);
    }

    private boolean validBoundaryEdge(Edge edge) {
        if (edge == null) {
            return false;
        }
        List<Cell> touchingCells = CellOrdering.sortedCells(edge.touchingCells());
        return touchingCells.size() == 2 && touchingCells.getFirst().level() == touchingCells.get(1).level();
    }

    private boolean deleteWallBoundary(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Edge edge,
            DungeonBoundaryKey key,
            DungeonClusterBoundary existing
    ) {
        if (existing != null && existing.kind() == BoundaryKind.DOOR) {
            return false;
        }
        if (existing != null) {
            boundaries.remove(key);
        }
        return insertOpenBoundaryIfNeeded(target, boundaries, edge, key, existing);
    }

    private boolean deleteDoorBoundary(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            DungeonClusterBoundary existing
    ) {
        if (!DOOR_RULES.removeBoundaryIfAllowed(dungeonMap, target, boundaries, resolvedKind, key, existing)) {
            return false;
        }
        insertWallBoundaryAfterDoorDelete(boundaries, key, existing);
        return true;
    }

    private void insertWallBoundaryAfterDoorDelete(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonBoundaryKey key,
            DungeonClusterBoundary existing
    ) {
        if (existing == null) {
            return;
        }
        boundaries.put(key, DOOR_RULES.restoredWallBoundary(existing));
    }

    private boolean insertOpenBoundaryIfNeeded(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Edge edge,
            DungeonBoundaryKey key,
            DungeonClusterBoundary existing
    ) {
        if (existing == null) {
            DungeonClusterBoundary openBoundary = GEOMETRY_SERVICE.openBoundaryForEdge(
                    Set.copyOf(target.cellsAt(edge.from().level())),
                    target.cluster().center(),
                    target.cluster().clusterId(),
                    edge);
            if (openBoundary == null || boundaries.containsKey(key)) {
                return false;
            }
            boundaries.put(key, openBoundary);
            return true;
        }
        DungeonClusterBoundary openBoundary = GEOMETRY_SERVICE.openBoundaryForEdge(
                Set.copyOf(target.cellsAt(edge.from().level())),
                target.cluster().center(),
                target.cluster().clusterId(),
                edge);
        if (openBoundary != null) {
            boundaries.put(key, openBoundary);
        }
        return true;
    }

    private boolean invalidBoundaryEditRequest(long clusterId, List<Edge> edges) {
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
