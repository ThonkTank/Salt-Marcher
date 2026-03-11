package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.BrushShape;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseButton;
import javafx.scene.paint.Color;

import java.util.function.Consumer;
import java.util.function.Supplier;

final class DungeonInteractionController {

    private static final Color HOVER_PAINT_FILL = Color.web("#d9a030", 0.35);
    private static final Color HOVER_ERASE_FILL = Color.web("#e53935", 0.35);
    private static final Color HOVER_EDGE_STROKE = Color.web("#d9a030", 0.70);

    private final Canvas selectionCanvas;
    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;
    private final Runnable redrawAll;
    private Runnable redrawSelection;

    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private String lastDraggedCellKey;
    private int hoverCellX = -1;
    private int hoverCellY = -1;
    private int hoverEdgeX = -1;
    private int hoverEdgeY = -1;
    private PassageDirection hoverEdgeDir;
    private Supplier<Integer> brushSizeSupplier;
    private Supplier<BrushShape> brushShapeSupplier;
    private Consumer<DungeonMapPane.CellInteraction> onCellClicked;
    private Consumer<DungeonMapPane.CellInteraction> onCellPainted;
    private Runnable onPaintStrokeFinished;
    private Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked;

    DungeonInteractionController(
            Canvas selectionCanvas,
            DungeonCanvasModel model,
            DungeonViewport viewport,
            Runnable redrawAll
    ) {
        this.selectionCanvas = selectionCanvas;
        this.model = model;
        this.viewport = viewport;
        this.redrawAll = redrawAll;
        bind();
    }

    void setRedrawSelection(Runnable redrawSelection) {
        this.redrawSelection = redrawSelection;
    }

    void setActiveTool(DungeonEditorTool activeTool) {
        this.activeTool = activeTool == null ? DungeonEditorTool.SELECT : activeTool;
        lastDraggedCellKey = null;
        if (this.activeTool.isBrushTool()) {
            drawHover();
        } else {
            clearHover();
        }
        if (this.activeTool.edgeHoverEnabled()) {
            drawEdgeHover();
        } else {
            clearEdgeHover();
        }
        updateCursor();
    }

    void setOnEdgeClicked(Consumer<DungeonMapPane.EdgeInteraction> onEdgeClicked) {
        this.onEdgeClicked = onEdgeClicked;
    }

    void setBrushSizeSupplier(Supplier<Integer> supplier) {
        this.brushSizeSupplier = supplier;
    }

    void setBrushShapeSupplier(Supplier<BrushShape> supplier) {
        this.brushShapeSupplier = supplier;
    }

    void setOnCellClicked(Consumer<DungeonMapPane.CellInteraction> onCellClicked) {
        this.onCellClicked = onCellClicked;
    }

    void setOnCellPainted(Consumer<DungeonMapPane.CellInteraction> onCellPainted) {
        this.onCellPainted = onCellPainted;
    }

    void setOnPaintStrokeFinished(Runnable onPaintStrokeFinished) {
        this.onPaintStrokeFinished = onPaintStrokeFinished;
    }

    private void bind() {
        selectionCanvas.setOnScroll(event -> {
            viewport.zoomAt(event.getX(), event.getY(), event.getDeltaY());
            redrawAll.run();
            event.consume();
        });
        selectionCanvas.setOnMousePressed(event -> {
            if (event.getButton() == MouseButton.SECONDARY) {
                viewport.startPan(event.getX(), event.getY());
                return;
            }
            if (event.getButton() == MouseButton.PRIMARY && activeTool.isBrushTool()) {
                handlePaintAt(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseDragged(event -> {
            if (viewport.isPanning()) {
                viewport.panTo(event.getX(), event.getY());
                clearHover();
                redrawAll.run();
                return;
            }
            if (activeTool.isBrushTool() && event.isPrimaryButtonDown()) {
                handlePaintAt(event.getX(), event.getY());
            }
            if (activeTool.isBrushTool()) {
                updateHover(event.getX(), event.getY());
            } else if (activeTool.edgeHoverEnabled()) {
                updateEdgeHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseReleased(event -> {
            viewport.endPan();
            lastDraggedCellKey = null;
            if (activeTool.isBrushTool() && event.getButton() == MouseButton.PRIMARY && onPaintStrokeFinished != null) {
                onPaintStrokeFinished.run();
            }
        });
        selectionCanvas.setOnMouseMoved(event -> {
            if (activeTool.isBrushTool()) {
                updateHover(event.getX(), event.getY());
            } else if (activeTool.edgeHoverEnabled()) {
                updateEdgeHover(event.getX(), event.getY());
            }
        });
        selectionCanvas.setOnMouseExited(event -> {
            if (activeTool.isBrushTool()) {
                clearHover();
            } else if (activeTool.edgeHoverEnabled()) {
                clearEdgeHover();
            }
        });
        selectionCanvas.setOnMouseClicked(event -> {
            if (event.getButton() != MouseButton.PRIMARY || !event.isStillSincePress()) {
                return;
            }
            if (activeTool == DungeonEditorTool.PASSAGE) {
                handleEdgeClick(event.getX(), event.getY());
                return;
            }
            if (activeTool.isBrushTool()) {
                return;
            }
            DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, event.getX(), event.getY());
            if (interaction != null && onCellClicked != null) {
                onCellClicked.accept(interaction);
            }
        });
    }

    private void handlePaintAt(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        if (interaction == null || onCellPainted == null) {
            return;
        }
        int size = currentBrushSize();
        int radius = size - 1;
        if (radius == 0) {
            String cellKey = interaction.x() + ":" + interaction.y();
            if (!cellKey.equals(lastDraggedCellKey)) {
                lastDraggedCellKey = cellKey;
                onCellPainted.accept(interaction);
            }
        } else {
            BrushShape shape = currentBrushShape();
            for (int dy = -radius; dy <= radius; dy++) {
                for (int dx = -radius; dx <= radius; dx++) {
                    if (!inShape(shape, dx, dy, radius)) continue;
                    DungeonMapPane.CellInteraction shifted =
                            model.interactionAt(viewport,
                                    viewport.screenCenterX(interaction.x() + dx),
                                    viewport.screenCenterY(interaction.y() + dy));
                    if (shifted != null) {
                        onCellPainted.accept(shifted);
                    }
                }
            }
            lastDraggedCellKey = interaction.x() + ":" + interaction.y();
        }
    }

    private void updateHover(double screenX, double screenY) {
        DungeonMapPane.CellInteraction interaction = model.interactionAt(viewport, screenX, screenY);
        int newX = interaction == null ? -1 : interaction.x();
        int newY = interaction == null ? -1 : interaction.y();
        if (newX == hoverCellX && newY == hoverCellY) {
            return;
        }
        hoverCellX = newX;
        hoverCellY = newY;
        drawHover();
    }

    private void clearHover() {
        hoverCellX = -1;
        hoverCellY = -1;
        drawHover();
    }

    private void drawHover() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        // Restore selection rect after clearing the canvas
        if (redrawSelection != null) {
            redrawSelection.run();
        }
        if (hoverCellX < 0 || hoverCellY < 0) {
            return;
        }
        Color fill = activeTool == DungeonEditorTool.ERASE ? HOVER_ERASE_FILL : HOVER_PAINT_FILL;
        gc.setFill(fill);
        int size = currentBrushSize();
        int radius = size - 1;
        double cellSize = viewport.scaledCellSize();
        BrushShape shape = currentBrushShape();
        for (int dy = -radius; dy <= radius; dy++) {
            for (int dx = -radius; dx <= radius; dx++) {
                if (!inShape(shape, dx, dy, radius)) continue;
                int cx = hoverCellX + dx;
                int cy = hoverCellY + dy;
                if (model.interactionAt(viewport, viewport.screenCenterX(cx), viewport.screenCenterY(cy)) != null) {
                    gc.fillRect(viewport.screenX(cx), viewport.screenY(cy), cellSize - 1, cellSize - 1);
                }
            }
        }
    }

    private void updateEdgeHover(double screenX, double screenY) {
        int[] edge = findEdgeAt(screenX, screenY);
        int newX = edge == null ? -1 : edge[0];
        int newY = edge == null ? -1 : edge[1];
        PassageDirection newDir = edge == null ? null : (edge[2] == 0 ? PassageDirection.EAST : PassageDirection.SOUTH);
        if (newX == hoverEdgeX && newY == hoverEdgeY && newDir == hoverEdgeDir) {
            return;
        }
        hoverEdgeX = newX;
        hoverEdgeY = newY;
        hoverEdgeDir = newDir;
        drawEdgeHover();
    }

    private void clearEdgeHover() {
        hoverEdgeX = -1;
        hoverEdgeY = -1;
        hoverEdgeDir = null;
        drawEdgeHover();
    }

    private void drawEdgeHover() {
        GraphicsContext gc = selectionCanvas.getGraphicsContext2D();
        gc.clearRect(0, 0, selectionCanvas.getWidth(), selectionCanvas.getHeight());
        if (redrawSelection != null) redrawSelection.run();
        if (hoverEdgeX < 0 || hoverEdgeDir == null) return;
        gc.setStroke(HOVER_EDGE_STROKE);
        gc.setLineWidth(Math.max(3.0, 5.0 * viewport.strokeScale()));
        if (hoverEdgeDir == PassageDirection.EAST) {
            double sx = viewport.screenX(hoverEdgeX + 1);
            double sy = viewport.screenY(hoverEdgeY);
            double ey = viewport.screenY(hoverEdgeY + 1);
            gc.strokeLine(sx, sy, sx, ey);
        } else {
            double sx = viewport.screenX(hoverEdgeX);
            double sy = viewport.screenY(hoverEdgeY + 1);
            double ex = viewport.screenX(hoverEdgeX + 1);
            gc.strokeLine(sx, sy, ex, sy);
        }
    }

    private void handleEdgeClick(double screenX, double screenY) {
        int[] edge = findEdgeAt(screenX, screenY);
        if (edge == null || onEdgeClicked == null) return;
        PassageDirection dir = edge[2] == 0 ? PassageDirection.EAST : PassageDirection.SOUTH;
        String edgeKey = dir.edgeKey(edge[0], edge[1]);
        DungeonPassage existing = model.passagesByEdge().get(edgeKey);
        onEdgeClicked.accept(new DungeonMapPane.EdgeInteraction(edge[0], edge[1], dir, existing));
    }

    /** Returns [canonicalX, canonicalY, dirOrdinal(0=EAST,1=SOUTH)] or null if no valid edge. */
    private int[] findEdgeAt(double screenX, double screenY) {
        if (model.state() == null || model.state().map() == null) return null;
        double cellSize = viewport.scaledCellSize();
        // fractional cell coordinates
        double fx = (screenX - viewport.screenX(0)) / cellSize;
        double fy = (screenY - viewport.screenY(0)) / cellSize;
        int cx = (int) Math.floor(fx);
        int cy = (int) Math.floor(fy);
        double rx = fx - cx; // 0..1 within cell
        double ry = fy - cy;

        int canonX, canonY;
        PassageDirection dir;
        if (rx < ry && rx < 1.0 - ry) {
            // closest to west edge → EAST of (cx-1, cy)
            canonX = cx - 1; canonY = cy; dir = PassageDirection.EAST;
        } else if (rx > ry && rx > 1.0 - ry) {
            // closest to east edge → EAST of (cx, cy)
            canonX = cx; canonY = cy; dir = PassageDirection.EAST;
        } else if (ry < rx && ry < 1.0 - rx) {
            // closest to north edge → SOUTH of (cx, cy-1)
            canonX = cx; canonY = cy - 1; dir = PassageDirection.SOUTH;
        } else {
            // closest to south edge → SOUTH of (cx, cy)
            canonX = cx; canonY = cy; dir = PassageDirection.SOUTH;
        }

        // Validate both adjacent cells are filled
        String keyA, keyB;
        if (dir == PassageDirection.EAST) {
            keyA = canonX + ":" + canonY;
            keyB = (canonX + 1) + ":" + canonY;
        } else {
            keyA = canonX + ":" + canonY;
            keyB = canonX + ":" + (canonY + 1);
        }
        if (model.squaresByCoord().get(keyA) == null || model.squaresByCoord().get(keyB) == null) {
            return null;
        }
        return new int[]{canonX, canonY, dir == PassageDirection.EAST ? 0 : 1};
    }

    private void updateCursor() {
        selectionCanvas.setCursor(activeTool.cursor());
    }

    private int currentBrushSize() {
        if (brushSizeSupplier != null) {
            Integer val = brushSizeSupplier.get();
            if (val != null) {
                return val;
            }
        }
        return 1;
    }

    private BrushShape currentBrushShape() {
        if (brushShapeSupplier != null) {
            BrushShape shape = brushShapeSupplier.get();
            if (shape != null) return shape;
        }
        return BrushShape.SQUARE;
    }

    private static boolean inShape(BrushShape shape, int dx, int dy, int radius) {
        return switch (shape) {
            case SQUARE -> true;
            case CIRCLE -> dx * dx + dy * dy <= radius * radius;
            case DIAMOND -> Math.abs(dx) + Math.abs(dy) <= radius;
        };
    }
}
