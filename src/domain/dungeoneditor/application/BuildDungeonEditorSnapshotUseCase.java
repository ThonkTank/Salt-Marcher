package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSnapshotProjectionLevelProjectionHelper;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSnapshotSelectionProjectionHelper;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSnapshotStateProjectionHelper;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorSnapshotSurfaceRuntimeReaderHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;

final class BuildDungeonEditorSnapshotUseCase {
    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final DungeonEditorSnapshotSurfaceRuntimeReaderHelper surfaceRuntimeAccess;

    BuildDungeonEditorSnapshotUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.surfaceRuntimeAccess = new DungeonEditorSnapshotSurfaceRuntimeReaderHelper(mutateAuthored, loadAuthored);
    }

    DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        List<MapSummary> maps = DungeonEditorSnapshotSelectionProjectionHelper.mapSummaries(
                catalog.apply(new DungeonMapCatalogCommand.Search("")));
        @Nullable MapId resolvedMapId = DungeonEditorSnapshotSelectionProjectionHelper.resolveSelectedMapId(
                safeState.selectedMapId(),
                maps);
        DungeonEditorSessionSnapshot.SurfaceData surface = surfaceRuntimeAccess.loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        int clampedProjectionLevel = DungeonEditorSnapshotProjectionLevelProjectionHelper.clampProjectionLevel(
                surface,
                safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? ApplyDungeonEditorSessionUseCase.statusFromMessages(surfaceRuntimeAccess.previewMessages(
                        resolvedMapId,
                        safeState.preview()))
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
        return surfaceRuntimeAccess.loadCommittedSnapshot(mapId);
    }
}
