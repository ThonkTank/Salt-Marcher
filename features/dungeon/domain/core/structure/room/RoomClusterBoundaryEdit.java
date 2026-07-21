package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundarySegment;

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
import features.dungeon.domain.core.component.boundary.BoundaryKind;

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
        Map<DungeonBoundaryKey, BoundarySegment> boundaries =
                new LinkedHashMap<>(target.cluster().boundaryMap());
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

    private static List<BoundarySegment> flattenOrderedBoundaries(Iterable<BoundarySegment> boundaries) {
        List<BoundarySegment> result = new ArrayList<>();
        for (List<BoundarySegment> boundariesAtLevel : BoundarySegment.orderedByLevel(boundaries).values()) {
            for (BoundarySegment boundary : boundariesAtLevel) {
                if (boundary != null) {
                    result.add(boundary);
                }
            }
        }
        return List.copyOf(result);
    }

    private List<Edge> authoredWallDeleteEdges(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            List<Edge> targetEdges
    ) {
        List<Edge> wallEdges = new ArrayList<>();
        for (BoundarySegment boundary : boundaries.values()) {
            if (boundary != null && boundary.kind() == BoundaryKind.WALL) {
                wallEdges.add(boundary.edge());
            }
        }
        return RoomClusterWallDeleteResolver.authored(wallEdges).deleteEdges(targetEdges);
    }

    private boolean upsertBoundary(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            Map<Long, List<Cell>> roomCells,
            BoundaryKind resolvedKind,
            Edge edge
    ) {
        BoundarySegment candidate = GEOMETRY.boundaryForEdge(
                edge == null ? Set.of() : Set.copyOf(target.cellsAt(edge.from().level())),
                edge,
                resolvedKind,
                null);
        if (candidate == null) {
            return false;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(candidate.edge());
        BoundarySegment existing = boundaries.get(key);
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
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            BoundaryKind resolvedKind,
            Edge edge
    ) {
        if (!validBoundaryEdge(edge)) {
            return false;
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        BoundarySegment existing = boundaries.get(key);
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
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            Edge edge,
            DungeonBoundaryKey key,
            BoundarySegment existing
    ) {
        if (existing != null && existing.kind() == BoundaryKind.DOOR) {
            return false;
        }
        BoundarySegment openBoundary = GEOMETRY.openBoundaryForEdge(
                Set.copyOf(target.cellsAt(edge.from().level())),
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
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            BoundaryKind resolvedKind,
            DungeonBoundaryKey key,
            BoundarySegment existing
    ) {
        if (!DOOR_RULES.removeBoundaryIfAllowed(corridors, target, boundaries, resolvedKind, key, existing)) {
            return false;
        }
        insertWallBoundaryAfterDoorDelete(boundaries, key, existing);
        return true;
    }

    private void insertWallBoundaryAfterDoorDelete(
            Map<DungeonBoundaryKey, BoundarySegment> boundaries,
            DungeonBoundaryKey key,
            BoundarySegment existing
    ) {
        if (existing != null) {
            boundaries.put(key, DOOR_RULES.restoredWallBoundary(existing));
        }
    }

    static final class BoundaryEditResult {

        private final List<BoundarySegment> editedBoundaries;
        private final boolean changed;

        BoundaryEditResult(List<BoundarySegment> editedBoundaries, boolean changed) {
            this.editedBoundaries = copyEditedBoundaries(editedBoundaries);
            this.changed = changed;
        }

        boolean changed() {
            return changed;
        }

        List<RoomRegion> partitionEditedRooms(
                DungeonRoomTopologyClusterWork target,
                RoomTopologyWorkCatalog.ReservedIdentities ids
        ) {
            return new DungeonRoomBoundaryPartition()
                    .roomsForBoundaryEdit(target, groupedBoundaries(), ids);
        }

        RoomCluster rebuiltEditedCluster(DungeonRoomTopologyClusterWork target) {
            return new RoomTopologyRebuilder()
                    .clusterWithBoundaries(target, groupedBoundaries());
        }

        private Map<Integer, List<BoundarySegment>> groupedBoundaries() {
            if (editedBoundaries.isEmpty()) {
                return Map.of();
            }
            Map<Integer, List<BoundarySegment>> mutable = new LinkedHashMap<>();
            for (BoundarySegment boundary : editedBoundaries) {
                if (boundary != null) {
                    mutable.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
                }
            }
            Map<Integer, List<BoundarySegment>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, List<BoundarySegment>> entry : mutable.entrySet()) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            return Collections.unmodifiableMap(result);
        }

        private static List<BoundarySegment> copyEditedBoundaries(List<BoundarySegment> source) {
            if (source == null || source.isEmpty()) {
                return List.of();
            }
            List<BoundarySegment> result = new ArrayList<>();
            for (BoundarySegment boundary : source) {
                if (boundary != null) {
                    result.add(boundary);
                }
            }
            return List.copyOf(result);
        }
    }
}
