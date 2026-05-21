package src.domain.dungeon.model.editor.helper;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryEdgeCatalogHelper {
    public Set<EdgeKey> internalClusterEdges(DungeonEditorWorkspaceValues.MapSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCells(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (TravelHeading direction : TravelHeading.values()) {
                CellKey neighbor = cell.neighbor(direction);
                if (cells.contains(neighbor)) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    public Set<EdgeKey> existingInternalBoundaryEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Boundary boundary : boundaries(snapshot)) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || boundary.edge().from().level() != level
                    || !boundaryKindMatches(boundary, kind)) {
                continue;
            }
            EdgeKey edge = EdgeKey.from(boundary.edge());
            if (internalEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    public Set<EdgeKey> outerClusterEdges(DungeonEditorWorkspaceValues.MapSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCells(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (TravelHeading direction : TravelHeading.values()) {
                if (!cells.contains(cell.neighbor(direction))) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Boundary> boundaries(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        return snapshot == null ? List.of() : snapshot.boundaries();
    }

    private static Set<CellKey> clusterCells(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        if (snapshot == null || !DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return Set.of();
        }
        Set<CellKey> result = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static boolean boundaryKindMatches(
            DungeonEditorWorkspaceValues.Boundary boundary,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        return boundary.kind() == kind;
    }
}
