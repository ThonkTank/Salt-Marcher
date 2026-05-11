package src.domain.dungeoneditor.model.interaction.helper;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryClusterResolutionHelper {

    public long resolveBoundaryClusterId(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundaryTarget
    ) {
        if (snapshot == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells = touchingCells(boundaryTarget);
        return snapshot.areas().stream()
                .filter(area -> area.kind().isRoom() && DungeonEditorWorkspaceValues.hasId(area.clusterId()))
                .filter(area -> area.cells().stream()
                        .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                        .anyMatch(touchingCells::contains))
                .map(DungeonEditorWorkspaceValues.Area::clusterId)
                .findFirst()
                .orElse(0L);
    }

    public long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorBoundaryGraphHelper graphService
    ) {
        if (selection != null
                && DungeonEditorWorkspaceValues.hasId(selection.clusterId())
                && graphService.isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        long boundaryClusterId = resolveBoundaryClusterId(snapshot, input.boundaryTarget());
        if (DungeonEditorWorkspaceValues.hasId(boundaryClusterId)
                && graphService.isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode, graphService);
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
            Set<CellKey> cells = result.computeIfAbsent(area.clusterId(), ignored -> new LinkedHashSet<>());
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
            boolean deleteMode,
            DungeonEditorBoundaryGraphHelper graphService
    ) {
        return clusterCellsByCluster(snapshot, vertex.level()).entrySet().stream()
                .filter(entry -> graphService.isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode))
                .min(Comparator
                        .comparingDouble((Map.Entry<Long, Set<CellKey>> entry) -> centerDistance(entry.getValue(), vertex))
                        .thenComparingLong(Map.Entry::getKey))
                .map(Map.Entry::getKey)
                .orElse(0L);
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
        return DungeonEditorBoundaryRoomTouchSupportHelper.touchingCells(
                boundaryTarget.start().toWorkspaceCell(),
                boundaryTarget.end().toWorkspaceCell()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
    }
}
