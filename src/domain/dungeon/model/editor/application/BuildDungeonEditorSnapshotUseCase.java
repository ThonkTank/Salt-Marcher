package src.domain.dungeon.model.editor.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.helper.DungeonEditorSnapshotProjectionLevelProjectionHelper;
import src.domain.dungeon.model.editor.model.session.helper.DungeonEditorSnapshotSelectionProjectionHelper;
import src.domain.dungeon.model.editor.model.session.helper.DungeonEditorSnapshotStateProjectionHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSession;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.model.session.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

final class BuildDungeonEditorSnapshotUseCase {
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;

    BuildDungeonEditorSnapshotUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort
    ) {
        this.dungeonRepository = dungeonRepository;
        this.dungeonPort = dungeonPort;
    }

    DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        dungeonRepository.searchMaps("");
        List<MapSummary> maps = dungeonPort.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = DungeonEditorSnapshotSelectionProjectionHelper.resolveSelectedMapId(
                safeState.selectedMapId(),
                maps);
        requestSurfaceFacts(resolvedMapId, safeState);
        DungeonEditorDungeonFacts surfaceFacts = dungeonPort.currentFacts(
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

    @Nullable MapSnapshot loadCommittedSnapshot(
            @Nullable MapId mapId
    ) {
        dungeonRepository.loadMap(mapId);
        return dungeonPort.committedFacts(mapId).committedSnapshot();
    }

    private void requestSurfaceFacts(@Nullable MapId mapId, DungeonEditorSession state) {
        dungeonRepository.loadMap(mapId);
        if (mapId != null) {
            dungeonRepository.describeSelection(
                    mapId,
                    state.selection().topologyRef(),
                    state.selection().clusterId(),
                    state.selection().clusterSelection());
            dungeonRepository.previewOperation(mapId, state.preview());
        }
    }
}
