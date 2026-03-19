package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonPaneContext;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRules;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.state.ClusterAnchorLayout;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridScreenMath;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonGridRenderer;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.Set;

final class DungeonGridRegionRenderSupport {

    private final DungeonPaneContext context;
    private final DungeonPanePreviewModel previewModel;

    DungeonGridRegionRenderSupport(DungeonPaneContext context, DungeonPanePreviewModel previewModel) {
        this.context = context;
        this.previewModel = previewModel;
    }

    void drawClusterEdges(GraphicsContext gc) {
        if (context.dungeonLayout() == null) {
            return;
        }
        for (DungeonRoomCluster cluster : context.dungeonLayout().clusters()) {
            for (DungeonRoomCluster.EdgeOverride edge : cluster.edgeOverrides()) {
                Point2i start = edgeStart(cluster, edge);
                Point2i end = edgeEnd(cluster, edge);
                if (DungeonClusterEdgeRules.providesWall(edge.type())) {
                    gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
                    gc.setLineWidth(4);
                    gc.strokeLine(
                            previewModel.geometry().previewScreenX(start.x(), cluster.clusterId()),
                            previewModel.geometry().previewScreenY(start.y(), cluster.clusterId()),
                            previewModel.geometry().previewScreenX(end.x(), cluster.clusterId()),
                            previewModel.geometry().previewScreenY(end.y(), cluster.clusterId()));
                }
                if (edge.type() == DungeonRoomCluster.EdgeType.DOOR) {
                    gc.setStroke(DungeonCanvasTheme.Corridor.DOOR);
                    gc.setLineWidth(6);
                    gc.strokeLine(
                            previewModel.geometry().previewScreenX(start.x(), cluster.clusterId()),
                            previewModel.geometry().previewScreenY(start.y(), cluster.clusterId()),
                            previewModel.geometry().previewScreenX(end.x(), cluster.clusterId()),
                            previewModel.geometry().previewScreenY(end.y(), cluster.clusterId()));
                }
            }
        }
    }

    void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster) {
        ClusterAnchorLayout anchorLayout = ClusterAnchorLayout.forCluster(
                context.dungeonLayout(),
                cluster,
                previewModel.geometry()::previewCenter,
                previewModel.geometry()::previewCenter);
        ClusterAnchorLayout.AnchorPosition clusterAnchor = DungeonGridRenderer.clusterAnchorPosition(
                anchorLayout,
                clusterResolver(cluster.clusterId()));
        gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
        gc.fillOval(clusterAnchor.x() - DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_DIAMETER);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(DungeonCanvasTheme.Corridor.ANCHOR_STROKE_WIDTH);
        gc.strokeOval(clusterAnchor.x() - DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_RADIUS, clusterAnchor.y() - DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.CLUSTER_ANCHOR_DIAMETER);

        for (DungeonRoom room : context.dungeonLayout().roomsForCluster(cluster.clusterId())) {
            ClusterAnchorLayout.AnchorPosition roomAnchor = DungeonGridRenderer.roomAnchorPosition(
                    anchorLayout,
                    room,
                    clusterResolver(room.clusterId()),
                    10,
                    11);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(roomAnchor.x() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, roomAnchor.y() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER);
            gc.setStroke(DungeonCanvasTheme.ROOM_SELECTED_STROKE);
            gc.setLineWidth(DungeonCanvasTheme.Corridor.ROOM_ANCHOR_STROKE_WIDTH);
            gc.strokeOval(roomAnchor.x() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, roomAnchor.y() - DungeonCanvasTheme.Corridor.ROOM_ANCHOR_RADIUS, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER, DungeonCanvasTheme.Corridor.ROOM_ANCHOR_DIAMETER);
            DungeonCanvasTheme.Label.drawCenteredLabel(gc, room.name(), roomAnchor.x(), roomAnchor.y());
        }
    }

    void drawRoom(
            GraphicsContext gc,
            Set<Point2i> cells,
            Point2D previewOffset,
            boolean active,
            boolean selected,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        gc.setFill(active ? DungeonCanvasTheme.ROOM_ACTIVE_FILL : DungeonCanvasTheme.ROOM_FILL);
        for (Point2i cell : cells) {
            double x = previewModel.geometry().previewScreenX(cell.x(), previewOffset);
            double y = previewModel.geometry().previewScreenY(cell.y(), previewOffset);
            double width = previewModel.geometry().previewScreenX(cell.x() + 1, previewOffset) - x;
            double height = previewModel.geometry().previewScreenY(cell.y() + 1, previewOffset) - y;
            gc.fillRect(x, y, width, height);
        }

        drawRegion(
                gc,
                cells,
                previewOffset,
                null,
                selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE,
                selected ? 3 : 2,
                openSegments,
                encodedOpenSegments);
    }

    void drawPaintPreview(GraphicsContext gc) {
        if (previewModel.previewPaintCells().isEmpty()) {
            return;
        }
        gc.setFill(DungeonCanvasTheme.ROOM_PREVIEW_FILL);
        gc.setStroke(DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (Point2i cell : previewModel.previewPaintCells()) {
            double x = context.camera().toScreenX(cell.x());
            double y = context.camera().toScreenY(cell.y());
            double size = context.camera().toScreenX(cell.x() + 1) - x;
            double height = context.camera().toScreenY(cell.y() + 1) - y;
            gc.fillRect(x, y, size, height);
            gc.strokeRect(x, y, size, height);
        }
    }

    void drawSelectionPreview(GraphicsContext gc) {
        Point2i startCell = previewModel.selectionStartCell();
        Point2i endCell = previewModel.selectionEndCell();
        if (startCell == null || endCell == null) {
            return;
        }
        int minX = Math.min(startCell.x(), endCell.x());
        int minY = Math.min(startCell.y(), endCell.y());
        int maxX = Math.max(startCell.x(), endCell.x());
        int maxY = Math.max(startCell.y(), endCell.y());
        double x = context.camera().toScreenX(minX);
        double y = context.camera().toScreenY(minY);
        double width = context.camera().toScreenX(maxX + 1) - x;
        double height = context.camera().toScreenY(maxY + 1) - y;
        gc.setFill(DungeonCanvasTheme.SELECTION_FILL);
        gc.fillRect(x, y, width, height);
        gc.setStroke(DungeonCanvasTheme.SELECTION_STROKE);
        gc.setLineWidth(2);
        gc.strokeRect(x, y, width, height);
    }

    Set<Long> encodeSegments(Set<CorridorRenderKeys.CorridorSegmentKey> segments) {
        return DungeonGridScreenMath.encodeSegments(segments);
    }

    void drawRegion(
            GraphicsContext gc,
            Set<Point2i> cells,
            Point2D previewOffset,
            Color fill,
            Color stroke,
            double lineWidth,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        if (fill != null) {
            gc.setFill(fill);
        }
        DungeonGridRenderer.drawRegion(
                gc,
                cells,
                fill,
                stroke,
                lineWidth,
                encodedOpenSegments,
                previewResolver(previewOffset));
    }

    private Point2i edgeStart(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = previewModel.geometry().previewClusterCell(cluster, edge.cell());
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x(), cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y());
            case SOUTH -> new Point2i(cell.x() + 1, cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y() + 1);
        };
    }

    private Point2i edgeEnd(DungeonRoomCluster cluster, DungeonRoomCluster.EdgeOverride edge) {
        Point2i cell = previewModel.geometry().previewClusterCell(cluster, edge.cell());
        return switch (edge.direction()) {
            case NORTH -> new Point2i(cell.x() + 1, cell.y());
            case EAST -> new Point2i(cell.x() + 1, cell.y() + 1);
            case SOUTH -> new Point2i(cell.x(), cell.y() + 1);
            case WEST -> new Point2i(cell.x(), cell.y());
        };
    }

    private DungeonGridScreenMath.ScreenPointResolver previewResolver(Point2D previewOffset) {
        return new DungeonGridScreenMath.ScreenPointResolver() {
            @Override
            public double screenX(double worldX) {
                return previewModel.geometry().previewScreenX(worldX, previewOffset);
            }

            @Override
            public double screenY(double worldY) {
                return previewModel.geometry().previewScreenY(worldY, previewOffset);
            }
        };
    }

    private DungeonGridScreenMath.ScreenPointResolver clusterResolver(Long clusterId) {
        return new DungeonGridScreenMath.ScreenPointResolver() {
            @Override
            public double screenX(double worldX) {
                return previewModel.geometry().previewScreenX(worldX, clusterId);
            }

            @Override
            public double screenY(double worldY) {
                return previewModel.geometry().previewScreenY(worldY, clusterId);
            }
        };
    }
}
