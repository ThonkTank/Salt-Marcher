package features.world.quarantine.dungeonmap.canvas.viewport;

import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridHitTester;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridViewportRenderer;
import features.world.quarantine.dungeonmap.canvas.grid.ViewportRenderSnapshot;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridSurface;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonGeometry;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;

import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

public final class DungeonBaseGridViewport extends StackPane implements DungeonGridSurface {

    private final Canvas canvas = new Canvas();
    private final DungeonCanvasCamera camera;
    private final DungeonBaseGridViewportRenderer renderer;
    private final DungeonGridScreenMath.ScreenPointResolver screenResolver = new DungeonGridScreenMath.ScreenPointResolver() {
        @Override
        public double screenX(double worldX) {
            return camera.toScreenX(worldX);
        }

        @Override
        public double screenY(double worldY) {
            return camera.toScreenY(worldY);
        }
    };
    private final DungeonBaseGridHitTester.LookupContext lookupContext = new BaseLookupContext();

    private DungeonLayout layout;
    private DungeonLayoutRenderData renderData;
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;

    private Consumer<DungeonRoom> onRoomSelected = room -> { };
    private Consumer<DungeonRoomCluster> onClusterSelected = cluster -> { };
    private Consumer<DungeonCorridor> onCorridorSelected = corridor -> { };
    private Consumer<Point2D> onViewportPanStarted = point -> { };
    private Consumer<Point2D> onViewportPanned = point -> { };
    private DungeonViewportZoomHandler onViewportZoomed = (screenX, screenY, factor) -> { };

    private boolean panning;

    public DungeonBaseGridViewport(DungeonCanvasCamera camera) {
        this.camera = camera;
        this.renderer = new DungeonBaseGridViewportRenderer();
        setFocusTraversable(true);
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = onRoomSelected == null ? room -> { } : onRoomSelected;
    }

    public void setOnClusterSelected(Consumer<DungeonRoomCluster> onClusterSelected) {
        this.onClusterSelected = onClusterSelected == null ? cluster -> { } : onClusterSelected;
    }

    public void setOnCorridorSelected(Consumer<DungeonCorridor> onCorridorSelected) {
        this.onCorridorSelected = onCorridorSelected == null ? corridor -> { } : onCorridorSelected;
    }

    public void setOnViewportPanStarted(Consumer<Point2D> onViewportPanStarted) {
        this.onViewportPanStarted = onViewportPanStarted == null ? point -> { } : onViewportPanStarted;
    }

    public void setOnViewportPanned(Consumer<Point2D> onViewportPanned) {
        this.onViewportPanned = onViewportPanned == null ? point -> { } : onViewportPanned;
    }

    public void setOnViewportZoomed(DungeonViewportZoomHandler onViewportZoomed) {
        this.onViewportZoomed = onViewportZoomed == null ? (screenX, screenY, factor) -> { } : onViewportZoomed;
    }

    public void showLayout(
            DungeonLayout layout,
            DungeonLayoutRenderData renderData,
            DungeonSelection selectedTarget,
            DungeonRuntimeLocation activeLocation,
            boolean renderNow
    ) {
        this.layout = layout;
        this.renderData = renderData;
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        renderer.setSnapshot(new ViewportRenderSnapshot(layout, renderData, camera, selectedTarget, activeLocation, null));
        if (renderNow) {
            render();
        }
    }

    public void updateSelection(DungeonSelection selectedTarget, DungeonRuntimeLocation activeLocation, boolean renderNow) {
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
        renderer.setSnapshot(new ViewportRenderSnapshot(layout, renderData, camera, selectedTarget, activeLocation, null));
        if (renderNow) {
            render();
        }
    }

    public void refreshViewport() {
        render();
    }

    @Override
    public void renderGrid(GraphicsContext gc, DungeonLayout layout, DungeonCanvasCamera camera) {
        render();
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.floor(camera.toWorldX(screenX));
        int y = (int) Math.floor(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    public DungeonRoomCluster findClusterAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findClusterAt(lookupContext, screenX, screenY);
    }

    public DungeonRoom findRoomAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findRoomAt(lookupContext, screenX, screenY);
    }

    public DungeonCorridor findCorridorAt(double screenX, double screenY) {
        return DungeonBaseGridHitTester.findCorridorAt(lookupContext, screenX, screenY);
    }

    private void handleMousePressed(MouseEvent event) {
        requestFocus();
        if (event.getButton() == MouseButton.SECONDARY) {
            panning = true;
            onViewportPanStarted.accept(new Point2D(event.getX(), event.getY()));
            return;
        }
        if (event.getButton() != MouseButton.PRIMARY || layout == null) {
            return;
        }
        DungeonCorridor corridor = findCorridorAt(event.getX(), event.getY());
        if (corridor != null) {
            onCorridorSelected.accept(corridor);
            return;
        }
        DungeonRoomCluster cluster = findClusterAt(event.getX(), event.getY());
        if (cluster != null) {
            onClusterSelected.accept(cluster);
            return;
        }
        DungeonRoom room = findRoomAt(event.getX(), event.getY());
        if (room != null) {
            onRoomSelected.accept(room);
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (!panning) {
            return;
        }
        onViewportPanned.accept(new Point2D(event.getX(), event.getY()));
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.SECONDARY) {
            panning = false;
        }
    }

    private void handleScroll(ScrollEvent event) {
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        onViewportZoomed.handle(event.getX(), event.getY(), factor);
    }

    private void resizeCanvas() {
        canvas.setWidth(Math.max(DungeonCanvasTheme.MIN_VIEWPORT_SIZE, getWidth()));
        canvas.setHeight(Math.max(DungeonCanvasTheme.MIN_VIEWPORT_SIZE, getHeight()));
        render();
    }

    private void render() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        DungeonCanvasTheme.paintBackground(gc, canvas.getWidth(), canvas.getHeight());
        if (layout == null) {
            return;
        }
        renderer.render(gc, canvas.getWidth(), canvas.getHeight());
    }

    private Set<Point2i> roomCellsFor(DungeonRoom room) {
        return room == null ? Set.of() : layout.roomCells(room.roomId());
    }

    private Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return cluster == null || cluster.clusterId() == null ? Set.of() : layout.clusterCells(cluster.clusterId());
    }

    private CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || renderData == null) {
            return null;
        }
        return renderData.corridorGeometry(corridor.corridorId());
    }

    private Point2i roomCenter(DungeonRoom room) {
        if (room == null || layout == null) {
            return new Point2i(0, 0);
        }
        return DungeonGeometry.roomCenter(layout, room);
    }

    private double distanceToDoor(double screenX, double screenY, DoorSegment door) {
        return DungeonGridScreenMath.distanceToDoor(new ScreenPoint(screenX, screenY), door, screenResolver);
    }

    private double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
        return DungeonGridScreenMath.distanceToInvalidCorridorLink(
                new ScreenPoint(screenX, screenY),
                geometry,
                layout,
                renderData != null,
                this::roomCenter,
                screenResolver);
    }

    private final class BaseLookupContext implements DungeonBaseGridHitTester.LookupContext {
        @Override
        public DungeonLayout layout() {
            return layout;
        }

        @Override
        public Point2i worldPointAt(double screenX, double screenY) {
            return DungeonBaseGridViewport.this.worldPointAt(screenX, screenY);
        }

        @Override
        public DungeonRoomCluster clusterAtCell(Point2i cell) {
            return renderData == null ? null : renderData.clusterAtCell(cell);
        }

        @Override
        public DungeonRoom roomAtCell(Point2i cell) {
            return renderData == null ? null : renderData.roomAtCell(cell);
        }

        @Override
        public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
            return DungeonBaseGridViewport.this.clusterCellsFor(cluster);
        }

        @Override
        public Set<Point2i> roomCellsFor(DungeonRoom room) {
            return DungeonBaseGridViewport.this.roomCellsFor(room);
        }

        @Override
        public List<Long> corridorIdsAtCell(Point2i cell) {
            return renderData == null ? List.of() : renderData.corridorIdsAtCell(cell);
        }

        @Override
        public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
            return DungeonBaseGridViewport.this.corridorGeometryForDisplay(corridor);
        }

        @Override
        public double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
            return DungeonBaseGridViewport.this.distanceToInvalidCorridorLink(screenX, screenY, geometry);
        }

        @Override
        public double distanceToDoor(double screenX, double screenY, DoorSegment door) {
            return DungeonBaseGridViewport.this.distanceToDoor(screenX, screenY, door);
        }
    }
}
