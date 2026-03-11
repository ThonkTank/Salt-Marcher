package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.model.PassageType;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.Map;

final class DungeonGridRenderer {

    private static final Color EMPTY_FILL = Color.web("#1f1912", 0.30);
    private static final Color EMPTY_STROKE = Color.web("#40372c");
    private static final Color FILLED_FILL = Color.web("#75614d");
    private static final Color FILLED_STROKE = Color.web("#b89060");
    private static final Color ROOM_STROKE = Color.web("#c8966a");
    private static final Color SELECTION_STROKE = Color.web("#d9c36a");
    private static final Color BOUNDARY_STROKE = Color.web("#4a5560", 0.55);
    private static final Color WALL_COLOR = Color.web("#3a2a1a");
    private static final Color PASSAGE_DOOR = Color.web("#c8966a");
    private static final Color PASSAGE_WINDOW = Color.web("#88aacc");
    private static final Color PASSAGE_HOLE = Color.web("#5a5a5a");

    private static final Color[] ROOM_PALETTE = {
        Color.web("#5a4a36"),
        Color.web("#3d4a5a"),
        Color.web("#3d5a3d"),
        Color.web("#5a3d4a"),
        Color.web("#5a5a3d"),
        Color.web("#3d5a5a"),
        Color.web("#4a3d5a"),
        Color.web("#5a4a3d"),
    };

    private final Canvas gridCanvas;
    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;

    DungeonGridRenderer(Canvas gridCanvas, Canvas selectionCanvas, DungeonCanvasModel model, DungeonViewport viewport) {
        this.gridCanvas = gridCanvas;
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
    }

    void redrawGrid() {
        GraphicsContext gc = gridCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, gridCanvas.getWidth(), gridCanvas.getHeight());

        DungeonMapState state = model.state();
        if (state == null || state.map() == null) {
            return;
        }

        int minX = viewport.minVisibleX(gridCanvas.getWidth(), state.map().width());
        int minY = viewport.minVisibleY(gridCanvas.getHeight(), state.map().height());
        int maxX = viewport.maxVisibleX(gridCanvas.getWidth(), state.map().width());
        int maxY = viewport.maxVisibleY(gridCanvas.getHeight(), state.map().height());
        if (maxX < minX || maxY < minY) {
            return;
        }

        for (int y = minY; y <= maxY; y++) {
            for (int x = minX; x <= maxX; x++) {
                drawCell(gc, x, y);
            }
        }

        drawWalls(gc, minX, minY, maxX, maxY);

        // draw a visible boundary around the full map extent
        double bx = viewport.screenX(0);
        double by = viewport.screenY(0);
        double bw = state.map().width() * viewport.scaledCellSize();
        double bh = state.map().height() * viewport.scaledCellSize();
        gc.setStroke(BOUNDARY_STROKE);
        gc.setLineWidth(Math.max(1.0, 1.5 * viewport.strokeScale()));
        gc.strokeRect(bx, by, bw, bh);
    }

    void redrawVisibleCell(int x, int y) {
        DungeonMapState state = model.state();
        if (state == null || state.map() == null) {
            return;
        }
        double screenX = viewport.screenX(x);
        double screenY = viewport.screenY(y);
        double size = viewport.scaledCellSize();
        if (screenX + size < 0 || screenY + size < 0
                || screenX > gridCanvas.getWidth() || screenY > gridCanvas.getHeight()) {
            return;
        }
        GraphicsContext gc = gridCanvas.getGraphicsContext2D();
        double clearPad = Math.max(2.0, 2.5 * viewport.strokeScale());
        gc.clearRect(screenX - clearPad, screenY - clearPad, size + clearPad * 2, size + clearPad * 2);
        drawCell(gc, x, y);
        drawWallsForCell(gc, x, y);
    }

    void redrawSelection() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());

        DungeonMapState state = model.state();
        DungeonSelection selection = model.selection();
        if (selection == null || selection.type() != DungeonSelection.SelectionType.SQUARE || selection.square() == null) {
            return;
        }
        if (state == null || state.map() == null) {
            return;
        }

        DungeonSquare square = selection.square();
        if (square.x() < 0 || square.y() < 0
                || square.x() >= state.map().width()
                || square.y() >= state.map().height()) {
            return;
        }

        double size = viewport.scaledCellSize();
        gc.setStroke(SELECTION_STROKE);
        gc.setLineWidth(Math.max(2.0, 3.0 * viewport.strokeScale()));
        gc.strokeRect(viewport.screenX(square.x()), viewport.screenY(square.y()), size - 1, size - 1);
    }

    private void drawWalls(GraphicsContext gc, int minX, int minY, int maxX, int maxY) {
        double wallWidth = Math.max(1.5, 2.0 * viewport.strokeScale());
        gc.setStroke(WALL_COLOR);
        gc.setLineWidth(wallWidth);
        for (int y = minY; y <= maxY; y++) {
            for (int x = minX; x <= maxX; x++) {
                if (!hasFilledSquare(x, y)) {
                    continue;
                }
                drawWallEdges(gc, x, y, wallWidth);
            }
        }
    }

    void drawWallsForCell(GraphicsContext gc, int cx, int cy) {
        double wallWidth = Math.max(1.5, 2.0 * viewport.strokeScale());
        gc.setStroke(WALL_COLOR);
        gc.setLineWidth(wallWidth);
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                int x = cx + dx;
                int y = cy + dy;
                if (!hasFilledSquare(x, y)) {
                    continue;
                }
                drawWallEdges(gc, x, y, wallWidth);
            }
        }
    }

    private void drawWallEdges(GraphicsContext gc, int x, int y, double wallWidth) {
        double sx = viewport.screenX(x);
        double sy = viewport.screenY(y);
        double ex = viewport.screenX(x + 1);
        double ey = viewport.screenY(y + 1);

        if (!hasFilledSquare(x, y - 1)) {
            drawEdge(gc, PassageDirection.SOUTH.edgeKey(x, y - 1),
                    sx, sy, ex, sy, true, wallWidth);
        }
        drawEdge(gc, PassageDirection.SOUTH.edgeKey(x, y),
                sx, ey, ex, ey, true, wallWidth);
        if (!hasFilledSquare(x - 1, y)) {
            drawEdge(gc, PassageDirection.EAST.edgeKey(x - 1, y),
                    sx, sy, sx, ey, false, wallWidth);
        }
        drawEdge(gc, PassageDirection.EAST.edgeKey(x, y),
                ex, sy, ex, ey, false, wallWidth);
    }

    private void drawEdge(
            GraphicsContext gc,
            String edgeKey,
            double ax,
            double ay,
            double bx,
            double by,
            boolean horizontal,
            double wallWidth
    ) {
        DungeonPassage passage = model.passagesByEdge().get(edgeKey);
        if (passage == null || passage.type() == PassageType.SECRET) {
            gc.setStroke(WALL_COLOR);
            gc.strokeLine(ax, ay, bx, by);
            return;
        }
        double gapStart = 0.30;
        double gapEnd = 0.70;
        if (horizontal) {
            double totalLen = bx - ax;
            double g0 = ax + totalLen * gapStart;
            double g1 = ax + totalLen * gapEnd;
            gc.setStroke(WALL_COLOR);
            gc.strokeLine(ax, ay, g0, ay);
            gc.strokeLine(g1, ay, bx, ay);
        } else {
            double totalLen = by - ay;
            double g0 = ay + totalLen * gapStart;
            double g1 = ay + totalLen * gapEnd;
            gc.setStroke(WALL_COLOR);
            gc.strokeLine(ax, ay, ax, g0);
            gc.strokeLine(ax, g1, ax, by);
        }
        // Draw passage marker
        Color passageColor = passageColor(passage.type());
        if (passageColor != null) {
            gc.setStroke(passageColor);
            gc.setLineWidth(Math.max(2.5, 3.5 * viewport.strokeScale()));
            if (horizontal) {
                double totalLen = bx - ax;
                double g0 = ax + totalLen * gapStart;
                double g1 = ax + totalLen * gapEnd;
                gc.strokeLine(g0, ay, g1, ay);
            } else {
                double totalLen = by - ay;
                double g0 = ay + totalLen * gapStart;
                double g1 = ay + totalLen * gapEnd;
                gc.strokeLine(ax, g0, ax, g1);
            }
            gc.setStroke(WALL_COLOR);
            gc.setLineWidth(wallWidth);
        }
    }

    private boolean hasFilledSquare(int x, int y) {
        return model.squaresByCoord().get(x + ":" + y) != null;
    }

    private static Color passageColor(PassageType type) {
        return switch (type) {
            case DOOR -> PASSAGE_DOOR;
            case WINDOW -> PASSAGE_WINDOW;
            case HOLE -> PASSAGE_HOLE;
            case OPEN -> null;    // transparent gap
            case SECRET -> null;  // visually closed — already drawn as wall
        };
    }

    private void drawCell(GraphicsContext gc, int x, int y) {
        DungeonSquare square = model.squaresByCoord().get(x + ":" + y);
        double screenX = viewport.screenX(x);
        double screenY = viewport.screenY(y);
        double size = viewport.scaledCellSize();
        Color fill;
        Color stroke;
        if (square == null) {
            fill = EMPTY_FILL;
            stroke = EMPTY_STROKE;
        } else if (square.roomId() != null) {
            int idx = (int) (Math.abs(square.roomId()) % ROOM_PALETTE.length);
            fill = ROOM_PALETTE[idx];
            stroke = ROOM_STROKE;
        } else {
            fill = FILLED_FILL;
            stroke = FILLED_STROKE;
        }

        gc.setFill(fill);
        gc.fillRect(screenX, screenY, size - 1, size - 1);
        gc.setStroke(stroke);
        gc.setLineWidth(Math.max(0.6, viewport.strokeScale()));
        gc.strokeRect(screenX, screenY, size - 1, size - 1);
    }
}
