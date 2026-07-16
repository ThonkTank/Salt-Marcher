package features.dungeon.domain.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind;

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
        return new BoundaryEditResult(flattenOrderedBoundaries(boundaries.values()), changed);
    }

    private static List<DungeonClusterBoundary> flattenOrderedBoundaries(Iterable<DungeonClusterBoundary> boundaries) {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundariesAtLevel : DungeonClusterBoundary.orderedByLevel(boundaries).values()) {
            for (DungeonClusterBoundary boundary : boundariesAtLevel) {
                if (boundary != null) {
                    result.add(boundary);
                }
            }
        }
        return List.copyOf(result);
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

    static final class BoundaryEditResult {

        private final List<DungeonClusterBoundary> editedBoundaries;
        private final boolean changed;

        BoundaryEditResult(List<DungeonClusterBoundary> editedBoundaries, boolean changed) {
            this.editedBoundaries = copyEditedBoundaries(editedBoundaries);
            this.changed = changed;
        }

        boolean changed() {
            return changed;
        }

        List<DungeonRoom> partitionEditedRooms(
                DungeonRoomTopologyClusterWork target,
                RoomTopologyWorkCatalog.IdAllocation ids
        ) {
            return new DungeonRoomBoundaryPartition()
                    .roomsForBoundaryEdit(target, groupedCompatibilityBoundaries(), ids);
        }

        DungeonRoomCluster rebuiltEditedCluster(DungeonRoomTopologyClusterWork target) {
            return new RoomTopologyRebuilder()
                    .clusterWithBoundaries(target, groupedCompatibilityBoundaries());
        }

        private Map<Integer, List<DungeonClusterBoundary>> groupedCompatibilityBoundaries() {
            if (editedBoundaries.isEmpty()) {
                return Map.of();
            }
            Map<Integer, List<DungeonClusterBoundary>> mutable = new LinkedHashMap<>();
            for (DungeonClusterBoundary boundary : editedBoundaries) {
                if (boundary != null) {
                    mutable.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
                }
            }
            Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : mutable.entrySet()) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            return Collections.unmodifiableMap(result);
        }

        private static List<DungeonClusterBoundary> copyEditedBoundaries(List<DungeonClusterBoundary> source) {
            if (source == null || source.isEmpty()) {
                return List.of();
            }
            List<DungeonClusterBoundary> result = new ArrayList<>();
            for (DungeonClusterBoundary boundary : source) {
                if (boundary != null) {
                    result.add(boundary);
                }
            }
            return List.copyOf(result);
        }
    }
}
