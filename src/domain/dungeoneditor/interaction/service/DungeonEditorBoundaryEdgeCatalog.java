package src.domain.dungeoneditor.interaction.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryEdgeCatalog {
    public Set<EdgeKey> internalClusterEdges(DungeonEditorWorkspaceValues.MapSnapshot snapshot, long clusterId, int level) {
        DungeonEditorBoundaryClusterResolver clusterResolver = new DungeonEditorBoundaryClusterResolver();
        Set<CellKey> cells = clusterResolver.clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
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
        DungeonEditorBoundaryClusterResolver clusterResolver = new DungeonEditorBoundaryClusterResolver();
        Set<CellKey> cells = clusterResolver.clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
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

    private static boolean boundaryKindMatches(
            DungeonEditorWorkspaceValues.Boundary boundary,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        return boundary.kind() == kind;
    }
}
