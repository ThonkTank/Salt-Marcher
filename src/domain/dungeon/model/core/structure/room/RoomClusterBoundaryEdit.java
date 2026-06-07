package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

final class RoomClusterBoundaryEdit {

    private static final RoomClusterBoundaryDoorRules DOOR_RULES =
            new RoomClusterBoundaryDoorRules();
    private static final RoomClusterBoundaryGeometry GEOMETRY =
            new RoomClusterBoundaryGeometry();
    private static final RoomCellCoverage CELL_COVERAGE = new RoomCellCoverage();

    BoundaryEditResult editBoundaries(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            List<Edge> edges,
            BoundaryKind kind,
            boolean deleteBoundary
    ) {
        BoundaryKind resolvedKind = kind == null ? BoundaryKind.WALL : kind;
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = target.cluster().boundaryMap();
        Map<Long, List<Cell>> roomCells = CELL_COVERAGE.cellsByRoom(target.cluster(), target.rooms());
        List<Edge> resolvedEdges = deleteBoundary && resolvedKind == BoundaryKind.WALL
                ? authoredWallDeleteEdges(target, boundaries, edges)
                : edges;
        boolean changed = false;
        for (Edge edge : resolvedEdges) {
            if (deleteBoundary) {
                changed = removeExistingBoundaryIfAllowed(corridors, target, boundaries, resolvedKind, edge)
                        || changed;
                continue;
            }
            changed = upsertBoundary(target, boundaries, roomCells, resolvedKind, edge) || changed;
        }
        return new BoundaryEditResult(DungeonClusterBoundary.orderedByLevel(boundaries.values()), changed);
    }

    private List<Edge> authoredWallDeleteEdges(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            List<Edge> targetEdges
    ) {
        List<Edge> wallEdges = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries.values()) {
            if (boundary != null && boundary.kind() == BoundaryKind.WALL) {
                wallEdges.add(boundary.absoluteEdge(target.cluster().center()));
            }
        }
        return RoomClusterWallMap.authoredWallDeleteEdges(wallEdges, targetEdges);
    }

    private boolean upsertBoundary(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Map<Long, List<Cell>> roomCells,
            BoundaryKind resolvedKind,
            Edge edge
    ) {
        DungeonClusterBoundary candidate = GEOMETRY.boundaryForEdge(
                edge == null ? Set.of() : Set.copyOf(target.cellsAt(edge.from().level())),
                target.cluster().center(),
                target.cluster().clusterId(),
                edge,
                resolvedKind,
                null);
        if (candidate == null) {
            return false;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(candidate.absoluteEdge(target.cluster().center()));
        DungeonClusterBoundary existing = boundaries.get(key);
        return DOOR_RULES.upsertBoundaryIfAllowed(
                roomCells,
                boundaries,
                resolvedKind,
                edge,
                key,
                existing,
                candidate);
    }

    private boolean removeExistingBoundaryIfAllowed(
            List<Corridor> corridors,
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
                : deleteDoorBoundary(corridors, target, boundaries, resolvedKind, key, existing);
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
        DungeonClusterBoundary openBoundary = GEOMETRY.openBoundaryForEdge(
                Set.copyOf(target.cellsAt(edge.from().level())),
                target.cluster().center(),
                target.cluster().clusterId(),
                edge);
        if (openBoundary != null) {
            return false;
        }
        if (existing != null) {
            boundaries.remove(key);
            return true;
        }
        return false;
    }

    private boolean deleteDoorBoundary(
            List<Corridor> corridors,
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            DungeonClusterBoundary existing
    ) {
        if (!DOOR_RULES.removeBoundaryIfAllowed(corridors, target, boundaries, resolvedKind, key, existing)) {
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
        if (existing != null) {
            boundaries.put(key, DOOR_RULES.restoredWallBoundary(existing));
        }
    }

    record BoundaryEditResult(
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            boolean changed
    ) {
        BoundaryEditResult {
            boundariesByLevel = boundariesByLevel == null ? Map.of() : Map.copyOf(boundariesByLevel);
        }
    }
}
