package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonClusterBoundaryEditService {

    private static final DungeonRoomClusterRebuildService REBUILD_SERVICE = new DungeonRoomClusterRebuildService();
    private static final DungeonRoomCellProjector CELL_PROJECTOR = new DungeonRoomCellProjector();

    DungeonMap editBoundaries(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> edges,
            DungeonClusterBoundaryKind kind,
            boolean deleteBoundary
    ) {
        if (clusterId <= 0L || edges == null || edges.isEmpty()) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = REBUILD_SERVICE.workClusters(dungeonMap);
        DungeonRoomTopologyClusterWork target = clusters.stream()
                .filter(work -> work.cluster().clusterId() == clusterId)
                .findFirst()
                .orElse(null);
        if (target == null) {
            return dungeonMap;
        }
        BoundaryEditResult edit = editBoundaries(dungeonMap, target, edges, kind, deleteBoundary);
        if (!edit.changed()) {
            return dungeonMap;
        }
        DungeonRoomClusterRebuildService.IdAllocation ids = REBUILD_SERVICE.newIdAllocation(dungeonMap);
        List<DungeonRoom> rooms = REBUILD_SERVICE.roomsForBoundaryEdit(target, edit.boundariesByLevel(), ids);
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
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = REBUILD_SERVICE.boundaryMap(target.cluster());
        Map<Long, List<DungeonCell>> roomCells = CELL_PROJECTOR.cellsByRoom(target.cluster(), target.rooms());
        boolean changed = false;
        for (DungeonEdge edge : edges) {
            DungeonClusterBoundary candidate = boundaryForEdge(target, edge, resolvedKind);
            if (candidate == null) {
                continue;
            }
            DungeonBoundaryKey key = DungeonBoundaryKey.from(candidate.absoluteEdge(target.cluster().center()));
            DungeonClusterBoundary existing = boundaries.get(key);
            changed = deleteBoundary
                    ? removeBoundaryIfAllowed(dungeonMap, target, boundaries, resolvedKind, key, existing) || changed
                    : upsertBoundaryIfAllowed(roomCells, boundaries, resolvedKind, edge, key, existing, candidate) || changed;
        }
        return new BoundaryEditResult(REBUILD_SERVICE.boundariesByLevel(boundaries.values()), changed);
    }

    private boolean removeBoundaryIfAllowed(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonClusterBoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        if (existing == null || existing.kind() != resolvedKind) {
            return false;
        }
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                && REBUILD_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                existing.level(),
                java.util.Set.of(key))) {
            return false;
        }
        boundaries.remove(key);
        return true;
    }

    private boolean upsertBoundaryIfAllowed(
            Map<Long, List<DungeonCell>> roomCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonClusterBoundaryKind resolvedKind,
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing,
            DungeonClusterBoundary candidate
    ) {
        if (resolvedKind == DungeonClusterBoundaryKind.DOOR
                && !editableDoorBoundary(existing, edge, roomCells)) {
            return false;
        }
        if (resolvedKind == DungeonClusterBoundaryKind.WALL
                && existing != null
                && existing.kind() == DungeonClusterBoundaryKind.DOOR) {
            return false;
        }
        if (existing != null && existing.kind() == resolvedKind) {
            return false;
        }
        boundaries.put(key, candidate);
        return true;
    }

    private @Nullable DungeonClusterBoundary boundaryForEdge(
            DungeonRoomTopologyClusterWork target,
            DungeonEdge edge,
            DungeonClusterBoundaryKind kind
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        List<DungeonCell> touchingCells = DungeonRoomCellProjector.sortedCells(edge.touchingCells());
        if (touchingCells.size() != 2 || touchingCells.getFirst().level() != touchingCells.get(1).level()) {
            return null;
        }
        List<DungeonCell> clusterCells = target.cellsAt(touchingCells.getFirst().level());
        List<DungeonCell> insideCells = touchingCells.stream()
                .filter(clusterCells::contains)
                .toList();
        if (insideCells.isEmpty()
                || (kind != DungeonClusterBoundaryKind.DOOR && insideCells.size() != 2)
                || (kind == DungeonClusterBoundaryKind.DOOR && insideCells.size() > 2)) {
            return null;
        }
        DungeonCell baseCell = insideCells.getFirst();
        DungeonEdgeDirection direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        DungeonCell center = target.cluster().center();
        return new DungeonClusterBoundary(
                target.cluster().clusterId(),
                baseCell.level(),
                new DungeonCell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind);
    }

    private @Nullable DungeonEdgeDirection directionFrom(DungeonCell cell, DungeonEdge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }

    private boolean editableDoorBoundary(
            @Nullable DungeonClusterBoundary existing,
            DungeonEdge edge,
            Map<Long, List<DungeonCell>> roomCells
    ) {
        long touchingRoomCount = touchingRoomCount(edge, roomCells);
        if (touchingRoomCount >= 2) {
            return existing != null && existing.kind() != DungeonClusterBoundaryKind.DOOR;
        }
        return touchingRoomCount == 1 && (existing == null || existing.kind() != DungeonClusterBoundaryKind.DOOR);
    }

    private long touchingRoomCount(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        if (edge == null || cellsByRoom.isEmpty()) {
            return 0L;
        }
        java.util.Set<DungeonCell> touching = java.util.Set.copyOf(edge.touchingCells());
        return cellsByRoom.values().stream()
                .filter(roomCells -> roomCells.stream().anyMatch(touching::contains))
                .limit(2L)
                .count();
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
