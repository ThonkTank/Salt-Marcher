package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneContext;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.editor.workspace.ui.wallpath.WallPathInteractionController;
import features.world.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.dungeonmap.rooms.model.DungeonClusterVertexRef;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonCanvasTheme;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

final class DungeonGridWallPathSupport {

    private final DungeonPaneContext context;
    private final DungeonPaneRenderState renderState;
    private final WallPathInteractionController wallPathController;

    DungeonGridWallPathSupport(
            DungeonPaneContext context,
            DungeonPaneRenderState renderState,
            WallPathInteractionController wallPathController
    ) {
        this.context = context;
        this.renderState = renderState;
        this.wallPathController = wallPathController;
    }

    void drawWallPathPreview(GraphicsContext gc) {
        if (!renderState.editorTool().isWallTool()) {
            return;
        }
        if (wallPathController.activeAnchor() != null) {
            drawWallAnchor(gc, wallPathController.activeAnchor(), DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        }
        if (wallPathController.previewPath().isEmpty()) {
            return;
        }
        gc.setStroke(DungeonCanvasTheme.ROOM_PREVIEW_STROKE);
        gc.setLineWidth(4);
        for (DungeonClusterEdgeRef edgeRef : wallPathController.previewPath()) {
            EdgeVertices vertices = edgeVertices(edgeRef);
            if (vertices == null) {
                continue;
            }
            gc.strokeLine(
                    context.camera().toScreenX(vertices.start().x()),
                    context.camera().toScreenY(vertices.start().y()),
                    context.camera().toScreenX(vertices.end().x()),
                    context.camera().toScreenY(vertices.end().y()));
        }
    }

    private void drawWallAnchor(GraphicsContext gc, DungeonClusterVertexRef vertexRef, Color color) {
        if (vertexRef == null || vertexRef.point() == null) {
            return;
        }
        double centerX = context.camera().toScreenX(vertexRef.point().x());
        double centerY = context.camera().toScreenY(vertexRef.point().y());
        gc.setFill(color);
        gc.fillOval(centerX - DungeonCanvasTheme.WALL_PATH_VERTEX_RADIUS, centerY - DungeonCanvasTheme.WALL_PATH_VERTEX_RADIUS, DungeonCanvasTheme.WALL_PATH_VERTEX_DIAMETER, DungeonCanvasTheme.WALL_PATH_VERTEX_DIAMETER);
        gc.setStroke(DungeonCanvasTheme.ROOM_STROKE);
        gc.setLineWidth(DungeonCanvasTheme.ANCHOR_STROKE_WIDTH);
        gc.strokeOval(centerX - DungeonCanvasTheme.WALL_PATH_VERTEX_RADIUS, centerY - DungeonCanvasTheme.WALL_PATH_VERTEX_RADIUS, DungeonCanvasTheme.WALL_PATH_VERTEX_DIAMETER, DungeonCanvasTheme.WALL_PATH_VERTEX_DIAMETER);
    }

    EdgeVertices edgeVertices(DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null) {
            return null;
        }
        Point2i cell = edgeRef.cell();
        return switch (edgeRef.direction()) {
            case NORTH -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            case EAST -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            case SOUTH -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y() + 1), new Point2i(cell.x(), cell.y() + 1));
            case WEST -> new EdgeVertices(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x(), cell.y()));
        };
    }

    record EdgeVertices(Point2i start, Point2i end) {
    }
}
