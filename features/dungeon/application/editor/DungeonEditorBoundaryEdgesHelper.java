package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.TravelHeading;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorBoundaryEdgesHelper {
    Set<EdgeKey> internal(Set<CellKey> cells) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            addInteriorEdges(result, cell, cells);
        }
        return Set.copyOf(result);
    }

    Set<EdgeKey> existingInternal(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<EdgeKey> internalEdges,
            int level,
            features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind kind
    ) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        if (snapshot == null) {
            return Set.of();
        }
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            addMatchingBoundary(result, internalEdges, boundary, level, kind);
        }
        return Set.copyOf(result);
    }

    Set<EdgeKey> existingWithinCells(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<CellKey> cells,
            int level,
            features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind kind
    ) {
        return existingInternal(snapshot, internal(cells), level, kind);
    }

    Set<EdgeKey> existingAlongClusterBoundary(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<CellKey> cells,
            int level,
            features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind kind
    ) {
        Set<EdgeKey> clusterEdges = new LinkedHashSet<>(internal(cells));
        clusterEdges.addAll(outer(cells));
        return existingInternal(snapshot, clusterEdges, level, kind);
    }

    Set<EdgeKey> outer(Set<CellKey> cells) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            addOuterEdges(result, cell, cells);
        }
        return Set.copyOf(result);
    }

    static boolean touchesAny(Set<EdgeKey> edges, VertexKey vertex) {
        for (EdgeKey edge : edges) {
            if (edge.touches(vertex)) {
                return true;
            }
        }
        return false;
    }

    private static void addInteriorEdges(Set<EdgeKey> result, CellKey cell, Set<CellKey> cells) {
        for (TravelHeading direction : TravelHeading.values()) {
            if (cells.contains(cell.neighbor(direction))) {
                result.add(EdgeKey.sideOf(cell, direction));
            }
        }
    }

    private static void addOuterEdges(Set<EdgeKey> result, CellKey cell, Set<CellKey> cells) {
        for (TravelHeading direction : TravelHeading.values()) {
            if (!cells.contains(cell.neighbor(direction))) {
                result.add(EdgeKey.sideOf(cell, direction));
            }
        }
    }

    private static void addMatchingBoundary(
            Set<EdgeKey> result,
            Set<EdgeKey> internalEdges,
            DungeonEditorWorkspaceValues.Boundary boundary,
            int level,
            features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind kind
    ) {
        if (boundary.edge() == null
                || boundary.edge().from() == null
                || boundary.edge().to() == null
                || boundary.edge().from().level() != level
                || boundary.kind() != kind) {
            return;
        }
        EdgeKey edge = EdgeKey.from(boundary.edge());
        if (internalEdges.contains(edge)) {
            result.add(edge);
        }
    }

}
