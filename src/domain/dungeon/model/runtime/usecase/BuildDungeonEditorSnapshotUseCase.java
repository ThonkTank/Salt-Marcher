package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSnapshotProjectionLevelProjectionHelper;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSnapshotStateProjectionHelper;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSession;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public final class BuildDungeonEditorSnapshotUseCase {
    private final SearchDungeonEditorMapCatalogUseCase searchMapsUseCase;
    private final LoadDungeonEditorAuthoredMapUseCase loadMapUseCase;
    private final PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase;
    private final CurrentDungeonFacts currentDungeonFacts;
    private final CommittedDungeonFacts committedDungeonFacts;

    public BuildDungeonEditorSnapshotUseCase(
            SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
            LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
            PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
            DungeonEditorDungeonState dungeonState
    ) {
        this.searchMapsUseCase = Objects.requireNonNull(searchMapsUseCase, "searchMapsUseCase");
        this.loadMapUseCase = Objects.requireNonNull(loadMapUseCase, "loadMapUseCase");
        this.previewOperationUseCase = Objects.requireNonNull(previewOperationUseCase, "previewOperationUseCase");
        DungeonEditorDungeonState safeDungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        currentDungeonFacts = safeDungeonState::currentFacts;
        committedDungeonFacts = safeDungeonState::committedFacts;
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        searchMapsUseCase.execute("");
        List<MapSummary> maps = currentDungeonFacts.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
        refreshAuthoredSurface(resolvedMapId, safeState);
        DungeonEditorDungeonFacts surfaceFacts = currentDungeonFacts.currentFacts(
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
        return committedDungeonFacts.committedFacts(mapId).committedSnapshot();
    }

    private void refreshAuthoredSurface(@Nullable MapId mapId, DungeonEditorSession state) {
        if (mapId == null) {
            return;
        }
        DungeonEditorSessionValues.Selection selection = state.selection();
        if (hasSelectionForInspector(selection)) {
            loadMapUseCase.executeWithSelection(
                    mapId,
                    selection.topologyRef(),
                    selection.clusterId(),
                    selection.clusterSelection());
        } else {
            loadMapUseCase.execute(mapId);
        }
        previewOperationUseCase.execute(mapId, state.preview());
    }

    private static boolean hasSelectionForInspector(DungeonEditorSessionValues.Selection selection) {
        return !selection.topologyRef().equals(DungeonTopologyRef.empty())
                || selection.clusterSelection();
    }

    private static @Nullable MapId resolveSelectedMapId(DungeonEditorSession state, List<MapSummary> maps) {
        @Nullable MapId requestedMapId = state.selectedMapId();
        if (requestedMapId == null && state.statusText().isBlank()) {
            return null;
        }
        if (requestedMapId == null) {
            return maps.isEmpty() ? null : maps.getFirst().mapId();
        }
        for (MapSummary summary : maps) {
            if (requestedMapId.equals(summary.mapId())) {
                return requestedMapId;
            }
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    @FunctionalInterface
    private interface CurrentDungeonFacts {
        DungeonEditorDungeonFacts currentFacts(
                @Nullable MapId mapId,
                DungeonEditorSessionValues.Selection selection,
                DungeonEditorSessionValues.Preview preview);
    }

    @FunctionalInterface
    private interface CommittedDungeonFacts {
        DungeonEditorDungeonFacts committedFacts(@Nullable MapId mapId);
    }
}
