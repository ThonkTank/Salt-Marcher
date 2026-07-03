package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeResultTranslator {
    private DungeonEditorRuntimeResultTranslator() {
    }

    static DungeonEditorRuntimeOperationResult fromSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        if (snapshot == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        List<DungeonEditorAction> actions = new ArrayList<>();
        actions.add(new DungeonEditorAction.SelectViewMode(viewMode(snapshot.viewMode())));
        actions.add(new DungeonEditorAction.SelectTool(tool(snapshot.selectedTool())));
        actions.add(new DungeonEditorAction.SetProjectionLevel(snapshot.projectionLevel()));
        actions.add(new DungeonEditorAction.SetOverlay(overlay(snapshot.overlaySettings())));
        actions.add(new DungeonEditorAction.SelectMap(mapId(snapshot.selectedMapId())));
        actions.add(new DungeonEditorAction.SetMapSummaries(mapSummaries(snapshot.maps())));
        actions.add(new DungeonEditorAction.SetSurfaceLoaded(snapshot.surface() != null));
        actions.add(new DungeonEditorAction.SetReachableLevels(reachableLevels(snapshot)));
        actions.add(new DungeonEditorAction.SetStatusText(snapshot.statusText()));
        return DungeonEditorRuntimeOperationResult.publish(actions);
    }

    static DungeonEditorRuntimeOperationResult fromPublication(
            ApplyDungeonEditorSessionEffectUseCase.PublicationResult publication
    ) {
        return fromPublication(null, publication);
    }

    static DungeonEditorRuntimeOperationResult fromPublication(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData fallbackSnapshot,
            ApplyDungeonEditorSessionEffectUseCase.PublicationResult publication
    ) {
        ApplyDungeonEditorSessionEffectUseCase.PublicationResult safePublication =
                Objects.requireNonNull(publication, "publication");
        return switch (safePublication.kind()) {
            case CONTROLS -> fromControls(safePublication.controls());
            case FULL_SNAPSHOT -> fromSnapshot(safePublication.snapshot());
            case NONE -> fromSnapshot(fallbackSnapshot);
        };
    }

    static DungeonEditorRuntimeOperationResult fromSessionFrame(
            DungeonEditorSessionSnapshot.@Nullable SessionFrameData frameData
    ) {
        if (frameData == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return fromControls(frameData.controlsData());
    }

    static DungeonEditorRuntimeOperationResult fromControls(
            DungeonEditorSessionSnapshot.@Nullable ControlsData controls
    ) {
        if (controls == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return DungeonEditorRuntimeOperationResult.publish(
                new DungeonEditorAction.SelectViewMode(viewMode(controls.viewMode())),
                new DungeonEditorAction.SelectTool(tool(controls.selectedTool())),
                new DungeonEditorAction.SetProjectionLevel(controls.projectionLevel()),
                new DungeonEditorAction.SetOverlay(overlay(controls.overlaySettings())),
                new DungeonEditorAction.SelectMap(mapId(controls.selectedMapId())),
                new DungeonEditorAction.SetStatusText(controls.statusText()));
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
                mapId(safeMap.mapId()),
                safeMap.mapName(),
                safeMap.revision());
    }

    private static DungeonMapId mapId(DungeonEditorWorkspaceValues.MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    private static DungeonEditorViewMode viewMode(DungeonEditorSessionValues.ViewMode viewMode) {
        return viewMode != null && "GRAPH".equals(viewMode.name())
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    private static DungeonEditorTool tool(DungeonEditorSessionValues.Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }

    private static DungeonOverlaySettings overlay(DungeonEditorSessionValues.OverlaySettings overlay) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }
}
