package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
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
    private final CatalogRefresher catalogRefresher;
    private final AuthoredSurfaceLoader authoredSurfaceLoader;
    private final AuthoredPreviewRefresher authoredPreviewRefresher;
    private final CurrentDungeonFacts currentDungeonFacts;
    private final CommittedDungeonFacts committedDungeonFacts;

    public BuildDungeonEditorSnapshotUseCase(
            CatalogRefresher catalogRefresher,
            AuthoredSurfaceLoader authoredSurfaceLoader,
            AuthoredPreviewRefresher authoredPreviewRefresher,
            DungeonEditorDungeonState dungeonState
    ) {
        this.catalogRefresher = Objects.requireNonNull(catalogRefresher, "catalogRefresher");
        this.authoredSurfaceLoader = Objects.requireNonNull(authoredSurfaceLoader, "authoredSurfaceLoader");
        this.authoredPreviewRefresher =
                Objects.requireNonNull(authoredPreviewRefresher, "authoredPreviewRefresher");
        DungeonEditorDungeonState safeDungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        currentDungeonFacts = safeDungeonState::currentFacts;
        committedDungeonFacts = safeDungeonState::committedFacts;
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        List<MapSummary> maps = currentDungeonFacts.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
        return snapshotData(safeState, maps, resolvedMapId);
    }

    public void refreshAuthoredSnapshot(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        refreshCatalog();
        List<MapSummary> maps = currentDungeonFacts.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
        refreshAuthoredSurface(resolvedMapId, safeState.selectedMapId(), safeState);
    }

    public void refreshCatalog() {
        catalogRefresher.refresh("");
    }

    public InMemoryPreviewRefresh refreshInMemoryPreview(@Nullable DungeonEditorSession state) {
        DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
        List<MapSummary> maps = currentDungeonFacts.currentFacts(null, safeState.selection(), safeState.preview()).maps();
        @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
        DungeonEditorDungeonFacts committedFacts = currentDungeonFacts.currentFacts(
                resolvedMapId,
                safeState.selection(),
                DungeonEditorSessionValues.Preview.none());
        if (authoredPreviewRefresher.refreshAuthoredDragPreview(safeState.selectedMapId(), safeState.preview())) {
            return InMemoryPreviewRefresh.DIRECT_AUTHORED_DRAG_PREVIEW;
        }
        authoredPreviewRefresher.refreshInMemory(committedFacts.surface(), safeState.preview());
        return InMemoryPreviewRefresh.IN_MEMORY_PREVIEW;
    }

    private DungeonEditorSessionSnapshot.SnapshotData snapshotData(
            DungeonEditorSession safeState,
            List<MapSummary> maps,
            @Nullable MapId resolvedMapId
    ) {
        DungeonEditorDungeonFacts surfaceFacts = currentDungeonFacts.currentFacts(
                resolvedMapId,
                safeState.selection(),
                safeState.preview());
        DungeonEditorSessionSnapshot.SurfaceData surface = surfaceFacts.surface();
        String nextStatus = safeState.statusText().isBlank()
                ? surfaceFacts.previewStatusText()
                : safeState.statusText();
        return new DungeonEditorSessionSnapshot.SnapshotData(
                maps,
                resolvedMapId,
                safeState.viewMode(),
                safeState.selectedTool(),
                safeState.projectionLevel(),
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
            authoredSurfaceLoader.load(mapId);
        }
        return committedDungeonFacts.committedFacts(mapId).committedSnapshot();
    }

    private void refreshAuthoredSurface(
            @Nullable MapId readbackMapId,
            @Nullable MapId authoredPreviewMapId,
            DungeonEditorSession state
    ) {
        if (readbackMapId == null) {
            return;
        }
        DungeonEditorSessionValues.Selection selection = state.selection();
        if (hasSelectionForInspector(selection)) {
            authoredSurfaceLoader.loadWithSelection(
                    readbackMapId,
                    selection.topologyRef(),
                    selection.clusterId(),
                    selection.clusterSelection());
        } else {
            authoredSurfaceLoader.load(readbackMapId);
        }
        authoredPreviewRefresher.refresh(authoredPreviewMapId, state.preview());
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
    public interface CatalogRefresher {
        void refresh(String query);
    }

    public interface AuthoredSurfaceLoader {
        void load(@Nullable MapId mapId);

        void loadWithSelection(
                @Nullable MapId mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection);
    }

    public interface AuthoredPreviewRefresher {
        boolean refreshAuthoredDragPreview(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview);

        void refreshInMemory(
                DungeonEditorSessionSnapshot.SurfaceData surface,
                DungeonEditorSessionValues.Preview preview);

        void refresh(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview);
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

    public enum InMemoryPreviewRefresh {
        DIRECT_AUTHORED_DRAG_PREVIEW(true),
        IN_MEMORY_PREVIEW(false);

        private final boolean directAuthoredDragPreview;

        InMemoryPreviewRefresh(boolean directAuthoredDragPreview) {
            this.directAuthoredDragPreview = directAuthoredDragPreview;
        }

        boolean directAuthoredDragPreview() {
            return directAuthoredDragPreview;
        }
    }
}
