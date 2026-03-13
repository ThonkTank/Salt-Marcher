package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonLinkAnchorType;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.domain.PassageDirection;
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
    private static final Color PENDING_LINK_STROKE = Color.web("#f4d35e");
    private static final Color INVALID_EDGE_STROKE = Color.web("#e53935", 0.90);
    private static final Color BOUNDARY_STROKE = Color.web("#4a5560", 0.55);
    private static final Color WALL_COLOR = Color.web("#3a2a1a");
    private static final Color PARTY_TOKEN_FILL = Color.web("#f5efe1");
    private static final Color PARTY_TOKEN_STROKE = Color.web("#2f7fd1");

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
    private static final Color[] AREA_PALETTE = {
        Color.web("#78583d"),
        Color.web("#4d6179"),
        Color.web("#536f47"),
        Color.web("#7a5162"),
        Color.web("#827247"),
        Color.web("#3f6d70"),
        Color.web("#65507d"),
        Color.web("#8a654b"),
    };

    private final Canvas gridCanvas;
    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private DungeonCanvasColorMode colorRenderMode = DungeonCanvasColorMode.ROOMS;

    DungeonGridRenderer(Canvas gridCanvas, Canvas selectionCanvas, DungeonCanvasModel model, DungeonViewport viewport) {
        this.gridCanvas = gridCanvas;
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
    }

    void setColorRenderMode(DungeonCanvasColorMode colorRenderMode) {
        this.colorRenderMode = colorRenderMode == null ? DungeonCanvasColorMode.ROOMS : colorRenderMode;
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
        if (state == null || state.map() == null) {
            return;
        }

        DungeonSelection selection = model.selection();
        if (selection != null) {
            if (selection.type() == DungeonSelection.SelectionType.SQUARE && selection.square() != null) {
                drawSquareSelection(gc, selection.square(), state);
            } else if (selection.type() == DungeonSelection.SelectionType.ROOM && selection.room() != null) {
                drawRoomSelection(gc, selection.room().roomId(), state);
            } else if (selection.type() == DungeonSelection.SelectionType.AREA && selection.area() != null) {
                drawAreaSelection(gc, selection.area().areaId(), state);
            } else if (selection.type() == DungeonSelection.SelectionType.PASSAGE && selection.passage() != null) {
                drawPassageSelection(gc, selection.passage(), SELECTION_STROKE);
            }
        }
        drawPendingLinkStart(gc);
        drawInvalidEdge(gc);
        drawPartyToken(gc);
    }

    private void drawSquareSelection(GraphicsContext gc, DungeonSquare square, DungeonMapState state) {
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

    private void drawRoomSelection(GraphicsContext gc, Long roomId, DungeonMapState state) {
        if (roomId == null) {
            return;
        }
        gc.setStroke(SELECTION_STROKE);
        gc.setLineWidth(Math.max(2.0, 3.0 * viewport.strokeScale()));
        for (DungeonSquare square : state.squares()) {
            if (!roomId.equals(square.roomId())) {
                continue;
            }
            drawRoomSelectionEdges(gc, square, roomId);
        }
    }

    private void drawAreaSelection(GraphicsContext gc, Long areaId, DungeonMapState state) {
        if (areaId == null) {
            return;
        }
        gc.setStroke(SELECTION_STROKE);
        gc.setLineWidth(Math.max(2.0, 3.0 * viewport.strokeScale()));
        for (DungeonSquare square : state.squares()) {
            if (!areaId.equals(square.areaId())) {
                continue;
            }
            drawAreaSelectionEdges(gc, square, areaId);
        }
    }

    private void drawRoomSelectionEdges(GraphicsContext gc, DungeonSquare square, Long roomId) {
        double x0 = viewport.screenX(square.x());
        double y0 = viewport.screenY(square.y());
        double x1 = viewport.screenX(square.x() + 1);
        double y1 = viewport.screenY(square.y() + 1);

        if (!sameRoom(square.x(), square.y() - 1, roomId)) {
            gc.strokeLine(x0, y0, x1, y0);
        }
        if (!sameRoom(square.x(), square.y() + 1, roomId)) {
            gc.strokeLine(x0, y1, x1, y1);
        }
        if (!sameRoom(square.x() - 1, square.y(), roomId)) {
            gc.strokeLine(x0, y0, x0, y1);
        }
        if (!sameRoom(square.x() + 1, square.y(), roomId)) {
            gc.strokeLine(x1, y0, x1, y1);
        }
    }

    private boolean sameRoom(int x, int y, Long roomId) {
        DungeonSquare square = model.squareAt(x, y);
        return square != null && roomId.equals(square.roomId());
    }

    private void drawAreaSelectionEdges(GraphicsContext gc, DungeonSquare square, Long areaId) {
        double x0 = viewport.screenX(square.x());
        double y0 = viewport.screenY(square.y());
        double x1 = viewport.screenX(square.x() + 1);
        double y1 = viewport.screenY(square.y() + 1);

        if (!sameArea(square.x(), square.y() - 1, areaId)) {
            gc.strokeLine(x0, y0, x1, y0);
        }
        if (!sameArea(square.x(), square.y() + 1, areaId)) {
            gc.strokeLine(x0, y1, x1, y1);
        }
        if (!sameArea(square.x() - 1, square.y(), areaId)) {
            gc.strokeLine(x0, y0, x0, y1);
        }
        if (!sameArea(square.x() + 1, square.y(), areaId)) {
            gc.strokeLine(x1, y0, x1, y1);
        }
    }

    private boolean sameArea(int x, int y, Long areaId) {
        DungeonSquare square = model.squareAt(x, y);
        return square != null && areaId.equals(square.areaId());
    }

    private void drawInvalidEdge(GraphicsContext gc) {
        Integer edgeX = model.invalidEdgeX();
        Integer edgeY = model.invalidEdgeY();
        PassageDirection edgeDirection = model.invalidEdgeDirection();
        if (edgeX == null || edgeY == null || edgeDirection == null) {
            return;
        }
        gc.setStroke(INVALID_EDGE_STROKE);
        gc.setLineWidth(Math.max(3.0, 4.0 * viewport.strokeScale()));
        if (edgeDirection == PassageDirection.EAST) {
            double sx = viewport.screenX(edgeX + 1);
            double sy = viewport.screenY(edgeY);
            double ey = viewport.screenY(edgeY + 1);
            gc.strokeLine(sx, sy, sx, ey);
            return;
        }
        double sx = viewport.screenX(edgeX);
        double sy = viewport.screenY(edgeY + 1);
        double ex = viewport.screenX(edgeX + 1);
        gc.strokeLine(sx, sy, ex, sy);
    }

    private void drawPartyToken(GraphicsContext gc) {
        Long partySquareId = model.partySquareId();
        if (partySquareId == null || model.state() == null) {
            return;
        }
        DungeonSquare square = model.state().index().findSquare(partySquareId);
        if (square == null) {
            return;
        }
        double size = viewport.scaledCellSize();
        double centerX = viewport.screenX(square.x()) + size / 2.0;
        double centerY = viewport.screenY(square.y()) + size / 2.0;
        double radius = Math.max(5.0, size * 0.24);
        gc.setFill(PARTY_TOKEN_FILL);
        gc.fillOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
        gc.setStroke(PARTY_TOKEN_STROKE);
        gc.setLineWidth(Math.max(2.0, 3.0 * viewport.strokeScale()));
        gc.strokeOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
    }

    private void drawPendingLinkStart(GraphicsContext gc) {
        DungeonLinkAnchor pendingAnchor = model.pendingLinkStart();
        if (pendingAnchor == null || pendingAnchor.type() != DungeonLinkAnchorType.PASSAGE) {
            return;
        }
        DungeonPassage passage = model.passagesById().get(pendingAnchor.anchorId());
        if (passage == null) {
            return;
        }
        drawPassageSelection(gc, passage, PENDING_LINK_STROKE);
    }

    private void drawPassageSelection(GraphicsContext gc, DungeonPassage passage, Color stroke) {
        gc.setStroke(stroke);
        gc.setLineWidth(Math.max(3.0, 4.0 * viewport.strokeScale()));
        if (passage.direction() == PassageDirection.EAST) {
            double sx = viewport.screenX(passage.x() + 1);
            double sy = viewport.screenY(passage.y());
            double ey = viewport.screenY(passage.y() + 1);
            gc.strokeLine(sx, sy, sx, ey);
            return;
        }
        double sx = viewport.screenX(passage.x());
        double sy = viewport.screenY(passage.y() + 1);
        double ex = viewport.screenX(passage.x() + 1);
        gc.strokeLine(sx, sy, ex, sy);
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

        boolean northFilled = hasFilledSquare(x, y - 1);
        boolean southFilled = hasFilledSquare(x, y + 1);
        boolean westFilled = hasFilledSquare(x - 1, y);
        boolean eastFilled = hasFilledSquare(x + 1, y);

        if (!northFilled) {
            drawEdge(gc, PassageDirection.SOUTH.edgeKey(x, y - 1),
                    sx, sy, ex, sy, true, wallWidth);
        }
        drawEdge(gc, PassageDirection.SOUTH.edgeKey(x, y),
                sx, ey, ex, ey, true, wallWidth);
        if (!westFilled) {
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
        DungeonEdgeSummary edge = model.edgeAt(edgeKey);
        if (edge == null) {
            return;
        }
        DungeonPassage passage = edge.passage();
        if (passage != null) {
            drawPassageEdge(gc, ax, ay, bx, by, horizontal);
            return;
        }
        if (edge.wallPresent()) {
            gc.setStroke(WALL_COLOR);
            gc.strokeLine(ax, ay, bx, by);
        }
    }

    private void drawPassageEdge(
            GraphicsContext gc,
            double ax,
            double ay,
            double bx,
            double by,
            boolean horizontal
    ) {
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
    }

    private boolean hasFilledSquare(int x, int y) {
        return model.squaresByCoord().get(x + ":" + y) != null;
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
            fill = resolveFilledRoomColor(square);
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

    private Color resolveFilledRoomColor(DungeonSquare square) {
        long paletteKey = colorRenderMode == DungeonCanvasColorMode.AREAS && square.areaId() != null
                ? square.areaId()
                : square.roomId();
        Color[] palette = colorRenderMode == DungeonCanvasColorMode.AREAS ? AREA_PALETTE : ROOM_PALETTE;
        int idx = (int) (Math.abs(paletteKey) % palette.length);
        return palette[idx];
    }
}
