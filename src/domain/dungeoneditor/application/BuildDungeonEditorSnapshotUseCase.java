package src.domain.dungeoneditor.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DescribeDungeonSelectionQuery;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.PreviewDungeonEditorOperationQuery;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;

final class BuildDungeonEditorSnapshotUseCase {

    record State(
            @Nullable DungeonMapId selectedMapId,
            DungeonEditorSession.ViewMode viewMode,
            DungeonEditorSession.Tool selectedTool,
            int projectionLevel,
            ApplyDungeonEditorSessionUseCase.OverlayData overlaySettings,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            ApplyDungeonEditorSessionUseCase.PreviewData preview,
            String statusText
    ) {
        State {
            viewMode = viewMode == null ? DungeonEditorSession.ViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSession.Tool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null
                    ? ApplyDungeonEditorSessionUseCase.OverlayData.defaults()
                    : overlaySettings;
            selection = selection == null ? ApplyDungeonEditorSessionUseCase.SelectionData.empty() : selection;
            preview = preview == null ? ApplyDungeonEditorSessionUseCase.PreviewData.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private final Function<SearchMapsQuery, SearchMapsResult> searchMaps;
    private final Function<PreviewDungeonEditorOperationQuery, DungeonOperationResult> previewOperation;
    private final Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection;
    private final Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot;

    BuildDungeonEditorSnapshotUseCase(
            Function<SearchMapsQuery, SearchMapsResult> searchMaps,
            Function<PreviewDungeonEditorOperationQuery, DungeonOperationResult> previewOperation,
            Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection,
            Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot
    ) {
        this.searchMaps = searchMaps;
        this.previewOperation = previewOperation;
        this.describeSelection = describeSelection;
        this.loadSnapshot = loadSnapshot;
    }

    ApplyDungeonEditorSessionUseCase.SnapshotData execute(State state) {
        State safeState = state == null
                ? new State(
                null,
                DungeonEditorSession.ViewMode.GRID,
                DungeonEditorSession.Tool.SELECT,
                0,
                ApplyDungeonEditorSessionUseCase.OverlayData.defaults(),
                ApplyDungeonEditorSessionUseCase.SelectionData.empty(),
                ApplyDungeonEditorSessionUseCase.PreviewData.none(),
                "")
                : state;
        SearchMapsResult mapsResult = searchMaps.apply(new SearchMapsQuery(""));
        List<DungeonMapSummary> maps = mapsResult == null ? List.of() : mapsResult.maps();
        DungeonMapId resolvedMapId = resolveSelectedMapId(safeState.selectedMapId(), maps);
        ApplyDungeonEditorSessionUseCase.SurfaceData surface = loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        int clampedProjectionLevel = clampProjectionLevel(surface, safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? ApplyDungeonEditorSessionUseCase.statusFromMessages(previewMessages(resolvedMapId, safeState.preview()))
                : safeState.statusText();
        return new ApplyDungeonEditorSessionUseCase.SnapshotData(
                maps,
                resolvedMapId,
                safeState.viewMode(),
                safeState.selectedTool(),
                clampedProjectionLevel,
                safeState.overlaySettings(),
                safeState.selection(),
                surface,
                safeState.preview(),
                nextStatus);
    }

    @Nullable DungeonSnapshot loadCommittedSnapshot(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            return null;
        }
        return loadSnapshot.apply(new LoadDungeonSnapshotQuery(mapId));
    }

    private ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData loadCurrentSurface(
            @Nullable DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.SelectionData selection,
            ApplyDungeonEditorSessionUseCase.PreviewData preview
    ) {
        if (mapId == null) {
            return null;
        }
        DungeonSnapshot committed = loadCommittedSnapshot(mapId);
        if (committed == null) {
            return null;
        }
        DungeonInspectorSnapshot inspector = loadInspector(mapId, selection);
        DungeonOperationResult previewResult = previewMessages(mapId, preview);
        DungeonSnapshot previewSnapshot = previewResult == null ? null : previewResult.snapshot();
        DungeonMapSnapshot previewMap = previewSnapshot == null ? null : previewSnapshot.map();
        return new ApplyDungeonEditorSessionUseCase.SurfaceData(
                committed.mapName(),
                committed.revision(),
                committed.map(),
                previewMap != null && previewMap.equals(committed.map()) ? null : previewMap,
                inspector);
    }

    private @Nullable DungeonOperationResult previewMessages(
            @Nullable DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.PreviewData preview
    ) {
        if (mapId == null) {
            return null;
        }
        return previewQuery(mapId, preview);
    }

    private @Nullable DungeonOperationResult previewQuery(
            DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.PreviewData preview
    ) {
        DungeonEditorOperation operation = DungeonEditorSessionBridge.toDungeonOperation(preview);
        if (operation == null) {
            return null;
        }
        return previewOperation.apply(new PreviewDungeonEditorOperationQuery(mapId, operation));
    }

    private @Nullable DungeonInspectorSnapshot loadInspector(
            DungeonMapId mapId,
            ApplyDungeonEditorSessionUseCase.SelectionData selection
    ) {
        if (selection.topologyRef().equals(DungeonTopologyElementRef.empty()) && !selection.clusterSelection()) {
            return null;
        }
        return describeSelection.apply(new DescribeDungeonSelectionQuery(
                mapId,
                selection.topologyRef(),
                selection.clusterId(),
                selection.clusterSelection()));
    }

    private static @Nullable DungeonMapId resolveSelectedMapId(
            @Nullable DungeonMapId requestedMapId,
            List<DungeonMapSummary> maps
    ) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    private static int clampProjectionLevel(
            ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            ApplyDungeonEditorSessionUseCase.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        TreeSet<Integer> levels = new TreeSet<>();
        if (surface != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (DungeonFeatureSnapshot feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (DungeonFeatureSnapshot feature : surface.previewMap().features()) {
                    addCellLevels(levels, feature.cells());
                }
                surface.previewMap().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            }
        }
        if (levels.isEmpty()) {
            levels.add(fallbackLevel);
        }
        return new ArrayList<>(levels);
    }

    private static void addCellLevels(Set<Integer> levels, List<DungeonCellRef> cells) {
        for (DungeonCellRef cell : cells == null ? List.<DungeonCellRef>of() : cells) {
            levels.add(cell.level());
        }
    }
}
