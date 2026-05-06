package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonClusterBoundaryEditService {

    private static final DungeonCorridorBindingLookupService CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupService();
    private static final DungeonClusterBoundaryGeometryService GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryService();
    private static final DungeonRoomBoundaryPartitionService PARTITION_SERVICE =
            new DungeonRoomBoundaryPartitionService();
    private static final DungeonRoomClusterWorkService WORK_SERVICE = new DungeonRoomClusterWorkService();
    private static final DungeonRoomClusterRebuildService REBUILD_SERVICE = new DungeonRoomClusterRebuildService();
    private static final DungeonRoomCellProjector CELL_PROJECTOR = new DungeonRoomCellProjector();

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
        DungeonRoomClusterWorkService.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
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
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = GEOMETRY_SERVICE.boundaryMap(target.cluster());
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
                    ? removeBoundaryIfAllowed(dungeonMap, target, boundaries, resolvedKind, key, existing) || changed
                    : upsertBoundaryIfAllowed(roomCells, boundaries, resolvedKind, edge, key, existing, candidate) || changed;
        }
        return new BoundaryEditResult(GEOMETRY_SERVICE.boundariesByLevel(boundaries.values()), changed);
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
                && CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                existing.level(),
                Set.of(key))) {
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

    private boolean editableDoorBoundary(
            @Nullable DungeonClusterBoundary existing,
            DungeonEdge edge,
            Map<Long, List<DungeonCell>> roomCells
    ) {
        long touchingRoomCount = touchingRoomCount(edge, roomCells);
        if (touchesMultipleRooms(touchingRoomCount)) {
            return existing != null && existing.kind() != DungeonClusterBoundaryKind.DOOR;
        }
        return touchingRoomCount == 1 && (existing == null || existing.kind() != DungeonClusterBoundaryKind.DOOR);
    }

    private long touchingRoomCount(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        if (edge == null || cellsByRoom.isEmpty()) {
            return 0L;
        }
        Set<DungeonCell> touching = Set.copyOf(edge.touchingCells());
        return cellsByRoom.values().stream()
                .filter(roomCells -> roomCells.stream().anyMatch(touching::contains))
                .limit(2L)
                .count();
    }

    private boolean invalidBoundaryEditRequest(long clusterId, List<DungeonEdge> edges) {
        return clusterId <= 0L || edges == null || edges.isEmpty();
    }

    private boolean touchesMultipleRooms(long touchingRoomCount) {
        return touchingRoomCount >= 2;
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
