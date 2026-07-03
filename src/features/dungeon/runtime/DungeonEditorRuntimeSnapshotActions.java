package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonMapSummary;

final class DungeonEditorRuntimeSnapshotActions {
    private DungeonEditorRuntimeSnapshotActions() {
    }

    static DungeonEditorRuntimeOperationResult fromSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData snapshot
    ) {
        List<DungeonEditorAction> actions = new ArrayList<>();
        actions.add(new DungeonEditorAction.SelectViewMode(DungeonEditorRuntimeControlValues.viewMode(snapshot.viewMode())));
        actions.add(new DungeonEditorAction.SelectTool(DungeonEditorRuntimeControlValues.tool(snapshot.selectedTool())));
        actions.add(new DungeonEditorAction.SetProjectionLevel(snapshot.projectionLevel()));
        actions.add(new DungeonEditorAction.SetOverlay(DungeonEditorRuntimeControlValues.overlay(snapshot.overlaySettings())));
        actions.add(new DungeonEditorAction.SelectMap(DungeonEditorRuntimeControlValues.mapId(snapshot.selectedMapId())));
        actions.add(new DungeonEditorAction.SetMapSummaries(mapSummaries(snapshot.maps())));
        actions.add(new DungeonEditorAction.SetSurfaceLoaded(snapshot.surface() != null));
        actions.add(new DungeonEditorAction.SetReachableLevels(reachableLevels(snapshot)));
        actions.add(new DungeonEditorAction.SetStatusText(snapshot.statusText()));
        return DungeonEditorRuntimeOperationResult.publish(actions);
    }

    private static List<Integer> reachableLevels(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        SortedSet<Integer> levels = new TreeSet<>();
        DungeonEditorSessionSnapshot.SurfaceData surface = snapshot.surface();
        if (surface != null && surface.map() != null) {
            addMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(snapshot.projectionLevel());
        }
        return List.copyOf(levels);
    }

    private static void addMapLevels(
            SortedSet<Integer> levels,
            DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
            addCellLevels(levels, area.cells());
        }
        for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            addCellLevels(levels, feature.cells());
        }
        for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            levels.add(handle.cell().level());
        }
    }

    private static void addCellLevels(
            SortedSet<Integer> levels,
            List<DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static List<DungeonMapSummary> mapSummaries(List<DungeonEditorWorkspaceValues.MapSummary> maps) {
        List<DungeonMapSummary> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.MapSummary map
                : maps == null ? List.<DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
            result.add(mapSummary(map));
        }
        return List.copyOf(result);
    }

    private static DungeonMapSummary mapSummary(DungeonEditorWorkspaceValues.MapSummary map) {
        DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(
                        new DungeonEditorWorkspaceValues.MapId(1L),
                        "Dungeon Map",
                        0L)
                : map;
        return new DungeonMapSummary(
                DungeonEditorRuntimeControlValues.mapId(safeMap.mapId()),
                safeMap.mapName(),
                safeMap.revision());
    }
}
