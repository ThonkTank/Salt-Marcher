package features.world.quarantine.dungeonmap.runtime.ui;

import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorComponent;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonBaseGridViewport;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridSurface;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasBounds;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.canvas.viewport.DungeonViewportController;
import features.world.quarantine.dungeonmap.canvas.state.DungeonWorkspaceRenderState;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;

import java.util.function.Consumer;

public final class DungeonRuntimeSplitWorkspace extends BorderPane {

    private final DungeonViewportController host = new DungeonViewportController(32);
    private final DungeonBaseGridViewport gridPane = new DungeonBaseGridViewport(host.camera());

    private DungeonWorkspaceRenderState renderState;

    public DungeonRuntimeSplitWorkspace() {
        setCenter(gridPane);
        gridPane.setOnViewportPanStarted(this::beginPan);
        gridPane.setOnViewportPanned(this::updatePan);
        gridPane.setOnViewportZoomed(this::zoomAt);
        widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
    }

    public void showLayout(DungeonLayout layout, DungeonWorkspaceRenderState renderState, DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation) {
        boolean resetView = host.shouldResetView(layout);
        this.renderState = renderState;
        DungeonLayoutRenderData renderData = renderState == null ? null : renderState.renderData();
        DungeonCanvasBounds bounds = renderState == null ? DungeonCanvasBounds.defaultBounds() : renderState.bounds();
        host.updateState(layout, bounds);
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
        host.beginPan(point);
    }

    private void updatePan(Point2D point) {
        host.updatePan(point, gridPane::refreshViewport);
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        host.zoomAt(screenX, screenY, factor, gridPane::refreshViewport);
    }

    private void refreshViewport(boolean resetView) {
        host.refreshViewport(getWidth(), getHeight(), resetView, gridPane::refreshViewport);
    }
}
