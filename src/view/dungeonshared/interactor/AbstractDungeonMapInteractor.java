package src.view.dungeonshared.interactor;

import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.Viewport;
import src.view.mapshared.View.MapWorkspaceView;

/**
 * Shared map-list workflow for dungeon editor and travel tabs.
 */
public abstract class AbstractDungeonMapInteractor {

    private final MapWorkspaceView workspaceView = new MapWorkspaceView();
    private final DungeonMapPresentation presentation;
    private final DungeonMapSurfaceController mapController;

    protected AbstractDungeonMapInteractor(DungeonMapPresentation presentation, DungeonMapSurfaceController mapController) {
        this.presentation = presentation;
        this.mapController = mapController;
        this.mapController.addListener(this::refreshWorkspace);
    }

    protected final void finishInitialization() {
        mapController.refreshMaps();
        refreshWorkspace();
    }

    public final Node workspace() {
        return workspaceView;
    }

    protected final MapWorkspaceView workspaceView() {
        return workspaceView;
    }

    protected final @Nullable BaseMapSnapshot loadedSnapshot() {
        return mapController.loadedSnapshot();
    }

    protected final DungeonMapSurfaceController mapController() {
        return mapController;
    }

    protected final Viewport currentViewport() {
        var viewport = workspaceView.currentViewport();
        return new Viewport(
                viewport.centerX(),
                viewport.centerY(),
                viewport.canvasWidth(),
                viewport.canvasHeight(),
                viewport.zoom());
    }

    private void refreshWorkspace() {
        BaseMapSnapshot snapshot = mapController.loadedSnapshot();
        workspaceView.show(snapshot == null
                ? presentation.placeholderRenderModel().get()
                : presentation.loadedRenderModel().apply(snapshot));
        onSnapshotChanged();
    }

    protected void onSnapshotChanged() {
    }
}
