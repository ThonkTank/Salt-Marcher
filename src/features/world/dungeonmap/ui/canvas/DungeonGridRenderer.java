package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

final class DungeonGridRenderer {

    private static final Color EMPTY_FILL = Color.web("#1f1912", 0.30);
    private static final Color EMPTY_STROKE = Color.web("#40372c");
    private static final Color FILLED_FILL = Color.web("#75614d");
    private static final Color FILLED_STROKE = Color.web("#b89060");
    private static final Color ROOM_STROKE = Color.web("#c8966a");
    private static final Color SELECTION_STROKE = Color.web("#d9c36a");
    private static final Color BOUNDARY_STROKE = Color.web("#4a5560", 0.55);

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
        gc.clearRect(screenX - 1, screenY - 1, size + 2, size + 2);
        drawCell(gc, x, y);
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
