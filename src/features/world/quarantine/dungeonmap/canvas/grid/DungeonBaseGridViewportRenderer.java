package features.world.quarantine.dungeonmap.canvas.grid;

import features.world.quarantine.dungeonmap.canvas.CorridorColorResolver;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.state.ClusterAnchorLayout;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
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
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.shape.StrokeLineCap;

import java.util.LinkedHashSet;
import java.util.Set;

public final class DungeonBaseGridViewportRenderer implements DungeonBaseGridRenderer.RenderContext {

    private final DungeonGridScreenMath.ScreenPointResolver screenResolver;

    private ViewportRenderSnapshot snapshot;
    private double canvasWidth;
    private double canvasHeight;

    public DungeonBaseGridViewportRenderer() {
        this.screenResolver = new DungeonGridScreenMath.ScreenPointResolver() {
            @Override
            public double screenX(double worldX) {
                return snapshot.camera().toScreenX(worldX);
            }

            @Override
            public double screenY(double worldY) {
                return snapshot.camera().toScreenY(worldY);
            }
        };
    }

    public void setSnapshot(ViewportRenderSnapshot snapshot) {
        this.snapshot = snapshot;
    }

    public void render(GraphicsContext gc, double canvasWidth, double canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        DungeonBaseGridRenderer.renderBaseGrid(gc, this);
    }

    // --- DungeonBaseGridRenderer.RenderContext ---

    @Override
    public DungeonLayout layout() {
        return snapshot.layout();
    }

    @Override
    public Iterable<DungeonRoomCluster> clusters() {
        return snapshot.layout().clusters();
    }

    @Override
    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || snapshot.renderData() == null) {
            return null;
        }
        return snapshot.renderData().corridorGeometry(corridor.corridorId());
    }

    @Override
    public void drawGrid(GraphicsContext gc) {
        DungeonGridRenderer.drawGrid(
                gc,
                snapshot.camera().visibleMinWorldX(),
                snapshot.camera().visibleMaxWorldX(),
                snapshot.camera().visibleMinWorldY(),
                snapshot.camera().visibleMaxWorldY(),
                canvasWidth,
                canvasHeight,
                screenResolver);
    }

    @Override
    public void drawCorridors(GraphicsContext gc, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        Set<Point2i> allCorridorCells = displayedCorridorCells();
        DungeonGridRenderer.drawRegion(
                gc,
                allCorridorCells,
                DungeonCanvasTheme.Corridor.CORRIDOR,
                DungeonCanvasTheme.ROOM_STROKE,
                2,
                encodedOpenSegments,
                screenResolver);
        for (DungeonCorridor corridor : snapshot.layout().corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            if (!geometry.routable()) {
                gc.setStroke(CorridorColorResolver.strokeColor(corridor.corridorId(), selectedCorridorId(), isActive(corridor) ? corridor.corridorId() : null));
                gc.setLineWidth(isSelected(corridor) ? 4 : 3);
                strokeInvalidCorridorLink(gc, geometry);
                continue;
            }
            gc.setFill(CorridorColorResolver.fillColor(corridor.corridorId(), selectedCorridorId(), isActive(corridor) ? corridor.corridorId() : null));
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
        DungeonGridRenderer.drawRegion(
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
        ClusterAnchorLayout anchorLayout = ClusterAnchorLayout.forCluster(snapshot.layout(), cluster, DungeonRoomCluster::center, this::roomCenter);
        ClusterAnchorLayout.AnchorPosition clusterAnchor = DungeonGridRenderer.clusterAnchorPosition(anchorLayout, screenResolver);
        gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
        gc.fillOval(clusterAnchor.x() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(DungeonCanvasTheme.Corridor.ANCHOR_STROKE_WIDTH);
        gc.strokeOval(clusterAnchor.x() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER);

        for (DungeonRoom room : snapshot.layout().roomsForCluster(cluster.clusterId())) {
            ClusterAnchorLayout.AnchorPosition roomAnchor = DungeonGridRenderer.roomAnchorPosition(
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
            DungeonCanvasTheme.Label.drawCenteredLabel(gc, room.name(), roomAnchor.x(), roomAnchor.y());
        }
    }

    @Override
    public void drawClusterEdges(GraphicsContext gc) {
        DungeonGridRenderer.drawClusterEdges(gc, snapshot.layout(), ignored -> screenResolver);
    }

    @Override
    public void drawDoors(GraphicsContext gc) {
        if (snapshot == null || snapshot.layout() == null) {
            return;
        }
        gc.setLineWidth(3);
        gc.setLineCap(StrokeLineCap.ROUND);
        for (DungeonCorridor corridor : snapshot.layout().corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            gc.setStroke(CorridorColorResolver.doorColor(corridor.corridorId(), selectedCorridorId(), isActive(corridor) ? corridor.corridorId() : null));
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
        if (snapshot == null || snapshot.renderData() == null || snapshot.layout() == null) {
            return Set.of();
        }
        Set<Point2i> cells = new LinkedHashSet<>();
        for (DungeonCorridor corridor : snapshot.layout().corridors()) {
            CorridorGeometry geometry = corridorGeometryForDisplay(corridor);
            if (geometry != null && geometry.routable()) {
                cells.addAll(geometry.cells());
            }
        }
        return cells;
    }

    private Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return cluster == null || cluster.clusterId() == null ? Set.of() : snapshot.layout().clusterCells(cluster.clusterId());
    }

    private boolean isSelected(DungeonRoomCluster cluster) {
        return cluster != null && cluster.clusterId() != null && snapshot.selection() != null && snapshot.selection().selectsRoomCluster(cluster.clusterId());
    }

    private boolean isSelected(DungeonCorridor corridor) {
        return corridor != null && corridor.corridorId() != null && snapshot.selection() != null && snapshot.selection().selectsCorridor(corridor.corridorId());
    }

    private boolean isActive(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null || snapshot.activeLocation() == null) {
            return false;
        }
        if (snapshot.activeLocation() instanceof DungeonRuntimeLocation.CorridorComponent corridorComponent) {
            return snapshot.renderData() != null
                    && corridorComponent.componentId().equals(snapshot.renderData().corridorComponentId(corridor.corridorId()));
        }
        return snapshot.activeLocation().matchesCorridor(corridor.corridorId());
    }

    private Long selectedCorridorId() {
        return snapshot.selection() instanceof DungeonSelection.Corridor c ? c.corridorId() : null;
    }

    private void strokeInvalidCorridorLink(GraphicsContext gc, CorridorGeometry geometry) {
        DungeonGridScreenMath.InvalidCorridorLink link = DungeonGridScreenMath.invalidCorridorLink(
                geometry,
                snapshot.layout(),
                snapshot.renderData() != null);
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
        if (room == null || snapshot.layout() == null) {
            return new Point2i(0, 0);
        }
        return DungeonGeometry.roomCenter(snapshot.layout(), room);
    }
}
