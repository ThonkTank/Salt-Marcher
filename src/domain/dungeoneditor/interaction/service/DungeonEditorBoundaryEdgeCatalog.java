package src.domain.dungeoneditor.interaction.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.EdgeKey;

public final class DungeonEditorBoundaryEdgeCatalog {
    private final DungeonEditorBoundaryClusterResolver clusterResolver = new DungeonEditorBoundaryClusterResolver();

    public Set<EdgeKey> internalClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
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
            DungeonSnapshot snapshot,
            long clusterId,
            int level,
            DungeonBoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (DungeonBoundarySnapshot boundary : boundaries(snapshot)) {
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

    public Set<EdgeKey> outerClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
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

    private static List<DungeonBoundarySnapshot> boundaries(DungeonSnapshot snapshot) {
        return snapshot == null || snapshot.map() == null ? List.of() : snapshot.map().boundaries();
    }

    private static boolean boundaryKindMatches(DungeonBoundarySnapshot boundary, DungeonBoundaryKind kind) {
        if (kind == DungeonBoundaryKind.DOOR) {
            return "door".equalsIgnoreCase(boundary.kind());
        }
        return !"door".equalsIgnoreCase(boundary.kind());
    }
}
