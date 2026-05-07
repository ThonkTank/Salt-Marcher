package src.domain.dungeoneditor.application;

import java.util.List;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSummary;

final class BuildDungeonEditorSnapshotUseCase {
    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final DungeonEditorSnapshotSurfaceLoader surfaceLoader;

    BuildDungeonEditorSnapshotUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.surfaceLoader = new DungeonEditorSnapshotSurfaceLoader(mutateAuthored, loadAuthored);
    }

    DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateSupport.safeState(state);
        List<MapSummary> maps = DungeonEditorSnapshotSelectionSupport.mapSummaries(
                catalog.apply(new DungeonMapCatalogCommand.Search("")));
        @Nullable MapId resolvedMapId = DungeonEditorSnapshotSelectionSupport.resolveSelectedMapId(
                safeState.selectedMapId(),
                maps);
        DungeonEditorSessionSnapshot.SurfaceData surface = surfaceLoader.loadCurrentSurface(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        int clampedProjectionLevel = DungeonEditorSnapshotProjectionLevelSupport.clampProjectionLevel(
                surface,
                safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? ApplyDungeonEditorSessionUseCase.statusFromMessages(surfaceLoader.previewMessages(
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
        return surfaceLoader.loadCommittedSnapshot(mapId);
    }
}
