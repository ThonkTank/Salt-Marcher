package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryClusterResolutionHelper {

    public long resolveBoundaryClusterId(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundaryTarget
    ) {
        if (snapshot == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells = touchingCells(boundaryTarget);
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || !DungeonEditorWorkspaceValues.hasId(area.clusterId())) {
                continue;
            }
            if (areaTouchesCells(area, touchingCells)) {
                return area.clusterId();
            }
        }
        return 0L;
    }

    public long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (selection != null
                && DungeonEditorWorkspaceValues.hasId(selection.clusterId())
                && isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        long boundaryClusterId = resolveBoundaryClusterId(snapshot, input.boundaryTarget());
        if (DungeonEditorWorkspaceValues.hasId(boundaryClusterId)
                && isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode);
    }

    public Map<Long, Set<CellKey>> clusterCellsByCluster(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            int level
    ) {
        Map<Long, Set<CellKey>> result = new LinkedHashMap<>();
        if (snapshot == null) {
            return Map.of();
        }
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || !DungeonEditorWorkspaceValues.hasId(area.clusterId())) {
                continue;
            }
            Set<CellKey> cells = result.get(area.clusterId());
            if (cells == null) {
                cells = new LinkedHashSet<>();
                result.put(area.clusterId(), cells);
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    cells.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        Map<Long, Set<CellKey>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<CellKey>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private long nearestEditableCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        long bestClusterId = 0L;
        double bestDistance = Double.MAX_VALUE;
        for (Map.Entry<Long, Set<CellKey>> entry : clusterCellsByCluster(snapshot, vertex.level()).entrySet()) {
            if (!isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode)) {
                continue;
            }
            double distance = centerDistance(entry.getValue(), vertex);
            if (bestClusterId == 0L || distance < bestDistance
                    || distance == bestDistance && entry.getKey() < bestClusterId) {
                bestClusterId = entry.getKey();
                bestDistance = distance;
            }
        }
        return bestClusterId;
    }

    private boolean isEditableVertex(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode
    ) {
        Set<EdgeKey> edges = deleteMode
                ? existingInternalBoundaryEdges(snapshot, clusterId, vertex.level(), DungeonEditorWorkspaceValues.BoundaryKind.WALL)
                : internalClusterEdges(snapshot, clusterId, vertex.level());
        src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexKey key =
                new src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexKey(
                        vertex.q(),
                        vertex.r(),
                        vertex.level());
        for (EdgeKey edge : edges) {
            if (edge.touches(key)) {
                return true;
            }
        }
        return false;
    }

    private Set<EdgeKey> internalClusterEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level
    ) {
        Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading direction
                    : src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading.values()) {
                CellKey neighbor = cell.neighbor(direction);
                if (cells.contains(neighbor)) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private Set<EdgeKey> existingInternalBoundaryEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level,
            DungeonEditorWorkspaceValues.BoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new LinkedHashSet<>();
        if (snapshot == null) {
            return Set.of();
        }
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || boundary.edge().from().level() != level
                    || boundary.kind() != kind) {
                continue;
            }
            EdgeKey edge = EdgeKey.from(boundary.edge());
            if (internalEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private static double centerDistance(Set<CellKey> cells, VertexTarget vertex) {
        double q = 0.0;
        double r = 0.0;
        for (CellKey cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return Math.hypot(q / count - vertex.q(), r / count - vertex.r());
    }

    private static List<CellKey> touchingCells(BoundaryTarget boundaryTarget) {
        List<CellKey> result = new ArrayList<>();
        DungeonEditorWorkspaceValues.Cell start = boundaryTarget.start().toWorkspaceCell();
        DungeonEditorWorkspaceValues.Cell end = boundaryTarget.end().toWorkspaceCell();
        if (start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            for (int q = Math.min(start.q(), end.q()); q < Math.max(start.q(), end.q()); q++) {
                result.add(new CellKey(q, start.r() - 1, start.level()));
                result.add(new CellKey(q, start.r(), start.level()));
            }
        } else if (start.q() == end.q()) {
            for (int r = Math.min(start.r(), end.r()); r < Math.max(start.r(), end.r()); r++) {
                result.add(new CellKey(start.q() - 1, r, start.level()));
                result.add(new CellKey(start.q(), r, start.level()));
            }
        }
        return List.copyOf(result);
    }

    private static boolean areaTouchesCells(DungeonEditorWorkspaceValues.Area area, List<CellKey> touchingCells) {
        for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
            if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                return true;
            }
        }
        return false;
    }
}
