package src.domain.dungeon.model.editor.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorSnapshotProjectionLevelProjectionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorSnapshotSelectionProjectionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorSnapshotStateProjectionHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class BuildDungeonEditorSnapshotUseCase {
    private final SearchDungeonEditorMapCatalogUseCase searchMapsUseCase;
    private final LoadDungeonEditorAuthoredMapUseCase loadMapUseCase;
    private final DescribeDungeonEditorAuthoredSelectionUseCase describeSelectionUseCase;
    private final PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase;
    private final DungeonEditorDungeonState dungeonState;

    public BuildDungeonEditorSnapshotUseCase(
            SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
            LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
            DescribeDungeonEditorAuthoredSelectionUseCase describeSelectionUseCase,
            PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
            DungeonEditorDungeonState dungeonState
    ) {
        this.searchMapsUseCase = searchMapsUseCase;
        this.loadMapUseCase = loadMapUseCase;
        this.describeSelectionUseCase = describeSelectionUseCase;
        this.previewOperationUseCase = previewOperationUseCase;
        this.dungeonState = dungeonState;
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        searchMapsUseCase.execute("");
        List<MapSummary> maps = dungeonState.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = DungeonEditorSnapshotSelectionProjectionHelper.resolveSelectedMapId(
                safeState.selectedMapId(),
                maps);
        refreshAuthoredSurface(resolvedMapId, safeState);
        DungeonEditorDungeonFacts surfaceFacts = dungeonState.currentFacts(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        DungeonEditorSessionSnapshot.SurfaceData surface = surfaceFacts.surface();
        int clampedProjectionLevel = DungeonEditorSnapshotProjectionLevelProjectionHelper.clampProjectionLevel(
                surface,
                safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? surfaceFacts.previewStatusText()
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

    public @Nullable MapSnapshot loadCommittedSnapshot(
            @Nullable MapId mapId
    ) {
        if (mapId != null) {
            loadMapUseCase.execute(mapId);
        }
        return dungeonState.committedFacts(mapId).committedSnapshot();
    }

    private void refreshAuthoredSurface(@Nullable MapId mapId, DungeonEditorSession state) {
        if (mapId == null) {
            return;
        }
        refreshAuthoredSnapshot(mapId);
        refreshAuthoredSelectionInspector(mapId, state);
        previewAuthoredOperation(mapId, state);
    }

    private void refreshAuthoredSnapshot(MapId mapId) {
        loadMapUseCase.execute(mapId);
    }

    private void refreshAuthoredSelectionInspector(MapId mapId, DungeonEditorSession state) {
        if (!hasSelectionForInspector(state)) {
            return;
        }
        describeSelectionUseCase.execute(
                mapId,
                state.selection().topologyRef(),
                state.selection().clusterId(),
                state.selection().clusterSelection());
    }

    private void previewAuthoredOperation(MapId mapId, DungeonEditorSession state) {
        previewOperationUseCase.execute(mapId, state.preview());
    }

    private static boolean hasSelectionForInspector(DungeonEditorSession state) {
        return !state.selection().topologyRef().equals(DungeonTopologyRef.empty())
                || state.selection().clusterSelection();
    }

}
