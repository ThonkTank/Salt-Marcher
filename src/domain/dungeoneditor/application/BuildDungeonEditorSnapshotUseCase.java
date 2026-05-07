package src.domain.dungeoneditor.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Feature;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSummary;

final class BuildDungeonEditorSnapshotUseCase {

    record State(
            @Nullable MapId selectedMapId,
            DungeonEditorSessionValues.ViewMode viewMode,
            DungeonEditorSessionValues.Tool selectedTool,
            int projectionLevel,
            DungeonEditorSessionValues.OverlaySettings overlaySettings,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            String statusText
    ) {
        State {
            viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.GRID : viewMode;
            selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.SELECT : selectedTool;
            overlaySettings = overlaySettings == null
                    ? DungeonEditorSessionValues.OverlaySettings.defaults()
                    : overlaySettings;
            selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored;

    BuildDungeonEditorSnapshotUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.mutateAuthored = mutateAuthored;
        this.loadAuthored = loadAuthored;
    }

    DungeonEditorSessionSnapshot.SnapshotData execute(State state) {
        State safeState = state == null
                ? new State(
                        null,
                        DungeonEditorSessionValues.ViewMode.GRID,
                        DungeonEditorSessionValues.Tool.SELECT,
                        0,
                        DungeonEditorSessionValues.OverlaySettings.defaults(),
                        DungeonEditorSessionValues.Selection.empty(),
                        DungeonEditorSessionValues.Preview.none(),
                        "")
                : state;
        List<MapSummary> maps =
                mapSummaries(catalog.apply(new DungeonMapCatalogCommand.Search("")));
        @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState.selectedMapId(), maps);
        DungeonEditorSessionSnapshot.SurfaceData surface = loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        int clampedProjectionLevel = clampProjectionLevel(surface, safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? ApplyDungeonEditorSessionUseCase.statusFromMessages(previewMessages(resolvedMapId, safeState.preview()))
                : safeState.statusText();
        return new DungeonEditorSessionSnapshot.SnapshotData(
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

    @Nullable MapSnapshot loadCommittedSnapshot(
            @Nullable MapId mapId
    ) {
        DungeonSnapshot snapshot = loadCommittedSnapshotRecord(mapId);
        return snapshot == null ? null : DungeonEditorWorkspaceBoundaryTranslator.toWorkspaceMapSnapshot(snapshot.map());
    }

    private DungeonEditorSessionSnapshot.@Nullable SurfaceData loadCurrentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonSnapshot committedSnapshot = loadCommittedSnapshotRecord(mapId);
        if (committedSnapshot == null) {
            return null;
        }
        MapSnapshot committedMap =
                DungeonEditorWorkspaceBoundaryTranslator.toWorkspaceMapSnapshot(committedSnapshot.map());
        @Nullable Inspector inspector = loadInspector(mapId, selection);
        DungeonOperationResult previewResult = previewMessages(mapId, preview);
        DungeonSnapshot previewSnapshot = previewResult == null ? null : previewResult.snapshot();
        @Nullable MapSnapshot previewMap =
                DungeonEditorWorkspaceBoundaryTranslator.toWorkspacePreviewMap(previewSnapshot);
        return new DungeonEditorSessionSnapshot.SurfaceData(
                committedSnapshot.mapName(),
                committedSnapshot.revision(),
                committedMap,
                previewMap != null && previewMap.equals(committedMap) ? null : previewMap,
                inspector);
    }

    private @Nullable DungeonOperationResult previewMessages(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Preview preview
    ) {
        if (mapId == null) {
            return null;
        }
        return previewQuery(mapId, preview);
    }

    private @Nullable DungeonOperationResult previewQuery(
            MapId mapId,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonEditorOperation operation = DungeonEditorSessionBridge.toDungeonOperation(preview);
        if (operation == null) {
            return null;
        }
        return ApplyDungeonEditorSessionUseCase.requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.PreviewOperation(
                        Objects.requireNonNull(DungeonEditorWorkspaceBoundaryTranslator.toDomainMapId(mapId)),
                        operation)));
    }

    private @Nullable Inspector loadInspector(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (mapId == null
                || (selection.topologyRef().equals(DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                && !selection.clusterSelection())) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadQuery.DescribeSelection(
                Objects.requireNonNull(DungeonEditorWorkspaceBoundaryTranslator.toDomainMapId(mapId)),
                DungeonEditorWorkspaceBoundaryTranslator.toDomainTopologyRef(selection.topologyRef()),
                selection.clusterId(),
                selection.clusterSelection()));
        if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            return DungeonEditorWorkspaceBoundaryTranslator.toWorkspaceInspector(selectionInspector.inspector());
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Inspektor.");
    }

    private @Nullable DungeonSnapshot loadCommittedSnapshotRecord(
            @Nullable MapId mapId
    ) {
        if (mapId == null) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadQuery.LoadSnapshot(
                Objects.requireNonNull(DungeonEditorWorkspaceBoundaryTranslator.toDomainMapId(mapId))));
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            return committedSnapshot.snapshot();
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Snapshot.");
    }

    private static @Nullable MapId resolveSelectedMapId(
            @Nullable MapId requestedMapId,
            List<MapSummary> maps
    ) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    private static int clampProjectionLevel(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int projectionLevel
    ) {
        List<Integer> levels = levelsFrom(surface, projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static List<Integer> levelsFrom(
            DungeonEditorSessionSnapshot.@Nullable SurfaceData surface,
            int fallbackLevel
    ) {
        TreeSet<Integer> levels = new TreeSet<>();
        if (surface != null) {
            surface.map().areas().forEach(area -> addCellLevels(levels, area.cells()));
            for (Feature feature : surface.map().features()) {
                addCellLevels(levels, feature.cells());
            }
            surface.map().editorHandles().forEach(handle -> levels.add(handle.cell().level()));
            if (surface.previewMap() != null) {
                surface.previewMap().areas().forEach(area -> addCellLevels(levels, area.cells()));
                for (Feature feature : surface.previewMap().features()) {
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

    private static void addCellLevels(Set<Integer> levels, List<Cell> cells) {
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static List<MapSummary> mapSummaries(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapList mapList) {
            return mapList.maps().stream()
                    .map(DungeonEditorWorkspaceBoundaryTranslator::toWorkspaceMapSummary)
                    .toList();
        }
        return List.of();
    }
}
