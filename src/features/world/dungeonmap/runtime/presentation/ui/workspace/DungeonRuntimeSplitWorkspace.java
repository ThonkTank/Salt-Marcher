package features.world.dungeonmap.runtime.presentation.ui.workspace;

import features.world.dungeonmap.corridors.model.CorridorComponent;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.canvas.rendering.DungeonBaseGridViewport;
import features.world.dungeonmap.canvas.rendering.DungeonGridSurface;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasBounds;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.rendering.DungeonLayoutRenderData;
import features.world.dungeonmap.canvas.rendering.DungeonViewportController;
import features.world.dungeonmap.canvas.rendering.DungeonWorkspaceRenderState;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;

import java.util.function.Consumer;

public final class DungeonRuntimeSplitWorkspace extends BorderPane {

    private final DungeonCanvasCamera camera = new DungeonCanvasCamera(32);
    private final DungeonViewportController viewport = new DungeonViewportController(camera);
    private final DungeonBaseGridViewport gridPane = new DungeonBaseGridViewport(camera);

    private DungeonWorkspaceRenderState renderState;

    public DungeonRuntimeSplitWorkspace() {
        setCenter(gridPane);
        gridPane.setOnViewportPanStarted(this::beginPan);
        gridPane.setOnViewportPanned(this::updatePan);
        gridPane.setOnViewportZoomed(this::zoomAt);
        widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
    }

    public void showLayout(DungeonLayout layout, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        boolean resetView = viewport.shouldResetView(layout);
        this.renderState = DungeonWorkspaceRenderState.from(layout, renderState);
        DungeonLayoutRenderData renderData = renderState == null ? null : renderState.renderData();
        DungeonCanvasBounds bounds = renderState == null ? DungeonCanvasBounds.defaultBounds() : renderState.bounds();
        viewport.updateState(layout, bounds);
        gridPane.showLayout(layout, renderData, selectedTarget, activeLocation, false);
        refreshViewport(resetView);
    }

    public void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        gridPane.updateSelection(selectedTarget, activeLocation, true);
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        gridPane.setOnRoomSelected(onRoomSelected);
    }

    public void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        gridPane.setOnClusterSelected(onClusterSelected);
    }

    public void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        gridPane.setOnCorridorSelected(onCorridorSelected);
    }

    public DungeonGridSurface gridSurface() {
        return gridPane;
    }

    public CorridorComponent corridorComponentFor(long corridorId) {
        if (renderState == null || renderState.renderData() == null) {
            return null;
        }
        return renderState.renderData().corridorTopology().componentForCorridor(corridorId);
    }

    public CorridorComponent corridorComponentById(String componentId) {
        if (renderState == null || renderState.renderData() == null) {
            return null;
        }
        return renderState.renderData().corridorTopology().componentById(componentId);
    }

    private void beginPan(Point2D point) {
        viewport.beginPan(point);
    }

    private void updatePan(Point2D point) {
        viewport.updatePan(point, gridPane::refreshViewport);
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        viewport.zoomAt(screenX, screenY, factor, gridPane::refreshViewport);
    }

    private void refreshViewport(boolean resetView) {
        viewport.refreshViewport(getWidth(), getHeight(), resetView, gridPane::refreshViewport);
    }
}
