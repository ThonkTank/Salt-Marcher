package features.world.dungeonmap.ui.shared.workspace;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.shared.render.DungeonCanvasBounds;
import features.world.dungeonmap.ui.shared.render.DungeonCanvasCamera;
import features.world.dungeonmap.ui.shared.render.DungeonGraphPane;
import features.world.dungeonmap.ui.shared.render.DungeonGridPane;
import features.world.dungeonmap.ui.shared.render.DungeonLayoutRenderData;
import javafx.geometry.Point2D;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.StackPane;

import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonSplitWorkspace extends BorderPane {

    private final DungeonCanvasCamera camera = new DungeonCanvasCamera(32);
    private final DungeonGridPane gridPane = new DungeonGridPane(camera);
    private final DungeonGraphPane graphPane = new DungeonGraphPane(camera);
    private final StackPane workspacePane = new StackPane(gridPane, graphPane);
    private DungeonViewMode viewMode = DungeonViewMode.GRID;
    private DungeonLayout layout;
    private DungeonLayoutRenderData renderData;
    private DungeonCanvasBounds bounds = DungeonCanvasBounds.defaultBounds();
    private Long selectedRoomId;
    private Long activeRoomId;

    public DungeonSplitWorkspace(boolean editable) {
        setCenter(workspacePane);
        gridPane.setEditable(editable);
        graphPane.setEditable(editable);
        gridPane.setOnViewportPanStarted(this::beginPan);
        graphPane.setOnViewportPanStarted(this::beginPan);
        gridPane.setOnViewportPanned(this::updatePan);
        graphPane.setOnViewportPanned(this::updatePan);
        gridPane.setOnViewportZoomed(this::zoomAt);
        graphPane.setOnViewportZoomed(this::zoomAt);
        workspacePane.widthProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        workspacePane.heightProperty().addListener((obs, oldValue, newValue) -> refreshViewport(false));
        applyViewMode();
    }

    public void showLayout(DungeonLayout layout, Long selectedRoomId, Long activeRoomId) {
        boolean resetView = shouldResetView(layout);
        this.layout = layout;
        this.renderData = DungeonLayoutRenderData.from(layout);
        this.bounds = DungeonCanvasBounds.forLayout(layout);
        this.selectedRoomId = selectedRoomId;
        this.activeRoomId = activeRoomId;
        gridPane.showLayout(layout, renderData, selectedRoomId, activeRoomId, false);
        graphPane.showLayout(layout, renderData, selectedRoomId, activeRoomId, false);
        refreshViewport(resetView);
    }

    public void updateSelection(Long selectedRoomId, Long activeRoomId) {
        this.selectedRoomId = selectedRoomId;
        this.activeRoomId = activeRoomId;
        gridPane.updateSelection(selectedRoomId, activeRoomId, viewMode == DungeonViewMode.GRID);
        graphPane.updateSelection(selectedRoomId, activeRoomId, viewMode == DungeonViewMode.GRAPH);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (this.viewMode == nextViewMode) {
            return;
        }
        this.viewMode = nextViewMode;
        applyViewMode();
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        gridPane.setOnRoomSelected(onRoomSelected);
        graphPane.setOnRoomSelected(onRoomSelected);
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        gridPane.setOnRoomMoved(onRoomMoved);
        graphPane.setOnRoomMoved(onRoomMoved);
    }

    private void applyViewMode() {
        // Grid and graph are two projections of the same room anchor coordinates.
        // They must never drift into separate positioning states.
        boolean showGrid = viewMode == DungeonViewMode.GRID;
        gridPane.setVisible(showGrid);
        gridPane.setManaged(showGrid);
        graphPane.setVisible(!showGrid);
        graphPane.setManaged(!showGrid);
        if (showGrid) {
            gridPane.toFront();
            gridPane.updateSelection(selectedRoomId, activeRoomId, true);
        } else {
            graphPane.toFront();
            graphPane.updateSelection(selectedRoomId, activeRoomId, true);
        }
    }

    private void beginPan(Point2D point) {
        camera.beginPan(point.getX(), point.getY());
    }

    private void updatePan(Point2D point) {
        camera.updatePan(point.getX(), point.getY());
        refreshPanes();
    }

    private void zoomAt(double screenX, double screenY, double factor) {
        camera.zoomAt(screenX, screenY, factor);
        refreshPanes();
    }

    private void refreshViewport(boolean resetView) {
        camera.showBounds(bounds, Math.max(160, workspacePane.getWidth()), Math.max(160, workspacePane.getHeight()), resetView);
        refreshPanes();
    }

    private void refreshPanes() {
        if (viewMode == DungeonViewMode.GRID) {
            gridPane.refreshViewport();
        } else {
            graphPane.refreshViewport();
        }
    }

    private boolean shouldResetView(DungeonLayout nextLayout) {
        if (layout == null || layout.map() == null) {
            return nextLayout != null;
        }
        if (nextLayout == null || nextLayout.map() == null) {
            return true;
        }
        return !Objects.equals(layout.map().mapId(), nextLayout.map().mapId());
    }
}
