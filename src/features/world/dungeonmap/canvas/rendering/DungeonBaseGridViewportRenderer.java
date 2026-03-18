package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonGeometry;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.view.model.DungeonSelection;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.shape.StrokeLineCap;

import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonBaseGridViewportRenderer implements DungeonBaseGridRenderer.RenderContext {

    private final DungeonCanvasCamera camera;
    private final DungeonGridScreenMath.ScreenPointResolver screenResolver;

    private DungeonLayout layout;
    private DungeonLayoutRenderData renderData;
    private DungeonSelection selectedTarget;
    private DungeonRuntimeLocation activeLocation;
    private double canvasWidth;
    private double canvasHeight;

    DungeonBaseGridViewportRenderer(DungeonCanvasCamera camera) {
        this.camera = camera;
        this.screenResolver = new DungeonGridScreenMath.ScreenPointResolver() {
            @Override
            public double screenX(double worldX) {
                return camera.toScreenX(worldX);
            }

            @Override
            public double screenY(double worldY) {
                return camera.toScreenY(worldY);
            }
        };
    }

    void update(
            DungeonLayout layout,
            DungeonLayoutRenderData renderData,
            DungeonSelection selectedTarget,
            DungeonRuntimeLocation activeLocation
    ) {
        this.layout = layout;
        this.renderData = renderData;
        this.selectedTarget = selectedTarget;
        this.activeLocation = activeLocation;
    }

    void render(GraphicsContext gc, double canvasWidth, double canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        DungeonBaseGridRenderer.renderBaseGrid(gc, this);
    }

    // --- DungeonBaseGridRenderer.RenderContext ---

    @Override
    public DungeonLayout layout() {
        return layout;
    }

    @Override
    public Iterable<DungeonRoomCluster> clusters() {
        return layout.clusters();
    }

    @Override
    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || renderData == null) {
            return null;
        }
        return renderData.corridorGeometry(corridor.corridorId());
    }

    @Override
    public void drawGrid(GraphicsContext gc) {
        DungeonGridRenderSupport.drawGrid(
                gc,
                camera.visibleMinWorldX(),
                camera.visibleMaxWorldX(),
                camera.visibleMinWorldY(),
                camera.visibleMaxWorldY(),
                canvasWidth,
                canvasHeight,
                screenResolver);
    }

    @Override
    public void drawCorridors(GraphicsContext gc, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        Set<Point2i> allCorridorCells = displayedCorridorCells();
        DungeonGridRenderSupport.drawRegion(
                gc,
                allCorridorCells,
                DungeonCanvasTheme.CORRIDOR,
                DungeonCanvasTheme.ROOM_STROKE,
                2,
                encodedOpenSegments,
                screenResolver);
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            if (!geometry.routable()) {
                gc.setStroke(strokeColor(corridor));
                gc.setLineWidth(isSelected(corridor) ? 4 : 3);
                strokeInvalidCorridorLink(gc, geometry);
                continue;
            }
            gc.setFill(fillColor(corridor));
            for (Point2i cell : geometry.cells()) {
                double x = screenResolver.screenX(cell.x());
                double y = screenResolver.screenY(cell.y());
                double width = screenResolver.screenX(cell.x() + 1) - x;
                double height = screenResolver.screenY(cell.y() + 1) - y;
                gc.fillRect(x, y, width, height);
            }
        }
    }

    @Override
    public void drawRoom(GraphicsContext gc, DungeonRoomCluster cluster, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        Set<Point2i> cells = clusterCellsFor(cluster);
        DungeonGridRenderSupport.drawRegion(
                gc,
                cells,
                DungeonCanvasTheme.ROOM_FILL,
                isSelected(cluster) ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE,
                2,
                encodedOpenSegments,
                screenResolver);
    }

    @Override
    public void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster) {
        ClusterAnchorLayout anchorLayout = ClusterAnchorLayout.forCluster(layout, cluster, DungeonRoomCluster::center, this::roomCenter);
        ClusterAnchorLayout.AnchorPosition clusterAnchor = DungeonGridRenderSupport.clusterAnchorPosition(anchorLayout, screenResolver);
        gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
        gc.fillOval(clusterAnchor.x() - DungeonCanvasTheme.ROOM_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.ROOM_ANCHOR_DIAMETER);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(DungeonCanvasTheme.ANCHOR_STROKE_WIDTH);
        gc.strokeOval(clusterAnchor.x() - DungeonCanvasTheme.ROOM_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.ROOM_ANCHOR_DIAMETER);

        for (DungeonRoom room : layout.roomsForCluster(cluster.clusterId())) {
            ClusterAnchorLayout.AnchorPosition roomAnchor = DungeonGridRenderSupport.roomAnchorPosition(
                    anchorLayout,
                    room,
                    screenResolver,
                    12,
                    12);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(roomAnchor.x() - 4, roomAnchor.y() - 4, 8, 8);
            gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
            gc.setLineWidth(1);
            gc.strokeOval(roomAnchor.x() - 4, roomAnchor.y() - 4, 8, 8);
            DungeonCanvasTheme.drawCenteredLabel(gc, room.name(), roomAnchor.x(), roomAnchor.y());
        }
    }

    @Override
    public void drawClusterEdges(GraphicsContext gc) {
        DungeonGridRenderSupport.drawClusterEdges(gc, layout, ignored -> screenResolver);
    }

    @Override
    public void drawDoors(GraphicsContext gc) {
        if (layout == null) {
            return;
        }
        gc.setLineWidth(3);
        gc.setLineCap(StrokeLineCap.ROUND);
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            gc.setStroke(doorColor(corridor));
            for (DoorSegment door : geometry.doors()) {
                gc.strokeLine(
                        screenResolver.screenX(door.start().x()),
                        screenResolver.screenY(door.start().y()),
                        screenResolver.screenX(door.end().x()),
                        screenResolver.screenY(door.end().y()));
            }
        }
        gc.setLineCap(StrokeLineCap.BUTT);
    }

    // --- Private helpers ---

    private Set<Point2i> displayedCorridorCells() {
        if (renderData == null || layout == null) {
            return Set.of();
        }
        Set<Point2i> cells = new LinkedHashSet<>();
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry != null && geometry.routable()) {
                cells.addAll(geometry.cells());
            }
        }
        return cells;
    }

    private Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return cluster == null || cluster.clusterId() == null ? Set.of() : layout.clusterCells(cluster.clusterId());
    }

    private boolean isSelected(DungeonRoomCluster cluster) {
        return cluster != null && cluster.clusterId() != null && selectedTarget != null && selectedTarget.selectsRoomCluster(cluster.clusterId());
    }

    private boolean isSelected(DungeonCorridor corridor) {
        return corridor != null && corridor.corridorId() != null && selectedTarget != null && selectedTarget.selectsCorridor(corridor.corridorId());
    }

    private boolean isActive(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || activeLocation == null) {
            return false;
        }
        if (activeLocation instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return renderData != null
                    && corridorComponent.componentId().equals(renderData.corridorComponentId(corridor.corridorId()));
        }
        return activeLocation.matchesCorridor(corridor.corridorId());
    }

    private Color strokeColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED;
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE;
        }
        return DungeonCanvasTheme.CORRIDOR;
    }

    private Color fillColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.CORRIDOR_ACTIVE.deriveColor(0, 1, 1, 0.25);
        }
        return DungeonCanvasTheme.CORRIDOR.deriveColor(0, 1, 1, 0.16);
    }

    private Color doorColor(DungeonCorridor corridor) {
        if (isSelected(corridor)) {
            return DungeonCanvasTheme.DOOR_SELECTED;
        }
        if (isActive(corridor)) {
            return DungeonCanvasTheme.DOOR_ACTIVE;
        }
        return DungeonCanvasTheme.DOOR;
    }

    private void strokeInvalidCorridorLink(GraphicsContext gc, CorridorGeometry geometry) {
        DungeonGridScreenMath.InvalidCorridorLink link = DungeonGridScreenMath.invalidCorridorLink(
                geometry,
                layout,
                renderData != null);
        if (link == null) {
            return;
        }
        Point2i fromCenter = roomCenter(link.from());
        Point2i toCenter = roomCenter(link.to());
        gc.strokeLine(
                screenResolver.screenX(fromCenter.x() + 0.5),
                screenResolver.screenY(fromCenter.y() + 0.5),
                screenResolver.screenX(toCenter.x() + 0.5),
                screenResolver.screenY(toCenter.y() + 0.5));
    }

    private Point2i roomCenter(DungeonRoom room) {
        if (room == null || layout == null) {
            return new Point2i(0, 0);
        }
        return DungeonGeometry.roomCenter(layout, room);
    }
}
