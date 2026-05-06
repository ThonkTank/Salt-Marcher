package src.domain.dungeoneditor.interaction.service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeoneditor.interaction.value.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public final class DungeonEditorBoundaryClusterResolver {

    public long resolveBoundaryClusterId(@Nullable DungeonSnapshot snapshot, @Nullable BoundaryTarget boundaryTarget) {
        if (snapshot == null || snapshot.map() == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells = touchingCells(boundaryTarget);
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() > 0L)
                .filter(area -> area.cells().stream()
                        .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                        .anyMatch(touchingCells::contains))
                .map(DungeonAreaSnapshot::clusterId)
                .findFirst()
                .orElse(0L);
    }

    public long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorBoundaryGraphService graphService
    ) {
        if (selection != null
                && selection.clusterId() > 0L
                && graphService.isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        long boundaryClusterId = resolveBoundaryClusterId(snapshot, input.boundaryTarget());
        if (boundaryClusterId > 0L && graphService.isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode, graphService);
    }

    public Map<Long, Set<CellKey>> clusterCellsByCluster(@Nullable DungeonSnapshot snapshot, int level) {
        Map<Long, Set<CellKey>> result = new LinkedHashMap<>();
        if (snapshot == null || snapshot.map() == null) {
            return Map.of();
        }
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() <= 0L) {
                continue;
            }
            Set<CellKey> cells = result.computeIfAbsent(area.clusterId(), ignored -> new LinkedHashSet<>());
            for (DungeonCellRef cell : area.cells()) {
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
            DungeonSnapshot snapshot,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonEditorBoundaryGraphService graphService
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
        return DungeonEditorBoundaryRoomTouchSupport.touchingCells(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
    }
}
