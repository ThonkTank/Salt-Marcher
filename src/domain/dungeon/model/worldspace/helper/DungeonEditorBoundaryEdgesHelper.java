package src.domain.dungeon.model.worldspace.helper;

import java.util.LinkedHashSet;
import java.util.Set;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.worldspace.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryEdgesHelper {
    public Set<EdgeKey> internal(Set<CellKey> cells) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            addInteriorEdges(result, cell, cells);
        }
        return Set.copyOf(result);
    }

    public Set<EdgeKey> existingInternal(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<EdgeKey> internalEdges,
            int level,
            DungeonEditorWorkspaceValues.BoundaryKind kind
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

    public Set<EdgeKey> outer(Set<CellKey> cells) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            addOuterEdges(result, cell, cells);
        }
        return Set.copyOf(result);
    }

    public static boolean touchesAny(Set<EdgeKey> edges, VertexKey vertex) {
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
            DungeonEditorWorkspaceValues.BoundaryKind kind
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
